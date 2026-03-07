const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'kirby-taskboard-2025-elvis';

// SQLite database connection
const dbPath = process.env.DATABASE_PATH || './tasks.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ SQLite database connected:', dbPath);
    }
});

// Ensure uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));

// Initialize database table
function initDatabase() {
    db.serialize(() => {
        // Create tasks table
        db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                priority TEXT DEFAULT 'medium',
                assignee TEXT DEFAULT 'Kirby',
                notes TEXT,
                status TEXT DEFAULT 'todo',
                position INTEGER DEFAULT 0,
                due_date DATE,
                attachment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ Database initialization error:', err);
            } else {
                console.log('✅ Database table initialized');
                // Log task count
                db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
                    if (err) {
                        console.error('❌ Error counting tasks:', err);
                    } else {
                        console.log('📊 Tasks in database:', row.count);
                    }
                });
            }
        });
    });
}

initDatabase();

// API Key middleware
const requireAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' });
    }
    next();
};

// Health check with database diagnostics
app.get('/api/health', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
        if (err) {
            return res.status(500).json({ 
                status: 'error', 
                error: err.message 
            });
        }
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                taskCount: row.count,
                type: 'SQLite'
            }
        });
    });
});

// GET all tasks
app.get('/api/tasks', (req, res) => {
    db.all(`
        SELECT * FROM tasks 
        ORDER BY 
            CASE status 
                WHEN 'todo' THEN 1 
                WHEN 'ready' THEN 2 
                WHEN 'inprogress' THEN 3 
                WHEN 'done' THEN 4 
                ELSE 5 
            END,
            position ASC, 
            created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('Error fetching tasks:', err);
            return res.status(500).json({ error: 'Failed to fetch tasks' });
        }
        res.json(rows);
    });
});

// GET single task
app.get('/api/tasks/:id', (req, res) => {
    db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching task:', err);
            return res.status(500).json({ error: 'Failed to fetch task' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(row);
    });
});

// CREATE task
app.post('/api/tasks', requireAuth, (req, res) => {
    const { title, priority = 'medium', assignee = 'Kirby', notes = '', status = 'todo', due_date = null, attachment = null } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }
    
    console.log(`📝 Creating task: "${title.substring(0, 50)}..."`);
    
    // Get max position for this status to add to end
    db.get('SELECT COALESCE(MAX(position), 0) + 1 as new_pos FROM tasks WHERE status = ?', [status], (err, row) => {
        if (err) {
            console.error('❌ Error getting position:', err);
            return res.status(500).json({ error: 'Failed to create task' });
        }
        
        const newPosition = row.new_pos;
        
        db.run(
            `INSERT INTO tasks (title, priority, assignee, notes, status, position, due_date, attachment) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, priority, assignee, notes, status, newPosition, due_date, attachment],
            function(err) {
                if (err) {
                    console.error('❌ Create error:', err);
                    return res.status(500).json({ error: 'Failed to create task' });
                }
                
                const newId = this.lastID;
                db.get('SELECT * FROM tasks WHERE id = ?', [newId], (err, task) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to fetch created task' });
                    }
                    console.log(`✅ Task created with ID: ${task.id} at position ${newPosition}`);
                    res.status(201).json(task);
                });
            }
        );
    });
});

// UPDATE task
app.put('/api/tasks/:id', requireAuth, (req, res) => {
    const { title, priority, assignee, notes, status, due_date, attachment } = req.body;
    const updates = [];
    const values = [];
    
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (assignee !== undefined) { updates.push('assignee = ?'); values.push(assignee); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
    if (attachment !== undefined) { updates.push('attachment = ?'); values.push(attachment); }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);
    
    db.run(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                console.error('Error updating task:', err);
                return res.status(500).json({ error: 'Failed to update task' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }
            
            db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (err, task) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to fetch updated task' });
                }
                res.json(task);
            });
        }
    );
});

// DELETE task
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    console.log(`🗑️ Deleting task ID: ${req.params.id}`);
    
    db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('❌ Delete error:', err);
            return res.status(500).json({ error: 'Failed to delete task' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        console.log(`✅ Task ${req.params.id} deleted`);
        res.json({ message: 'Task deleted successfully' });
    });
});

// REORDER tasks within a status
app.post('/api/tasks/reorder', requireAuth, (req, res) => {
    const { tasks } = req.body;
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'Tasks array required' });
    }
    
    console.log(`🔄 Reordering ${tasks.length} tasks`);
    
    const stmt = db.prepare('UPDATE tasks SET position = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        for (const task of tasks) {
            const { id, position, status } = task;
            stmt.run(position, status, id);
        }
        
        stmt.finalize();
        
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('❌ Reorder error:', err);
                return res.status(500).json({ error: 'Failed to reorder tasks' });
            }
            console.log('✅ Tasks reordered successfully');
            res.json({ message: 'Tasks reordered successfully', count: tasks.length });
        });
    });
});

// File upload endpoint
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({ 
        message: 'File uploaded successfully',
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server - bind to all interfaces for network access
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🐶 Kirby Task Board running on:`);
    console.log(`   Local: http://localhost:${PORT}`);
    console.log(`   Network: http://192.168.1.151:${PORT}`);
    console.log(`   SQLite: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Closing database connection...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Closing database connection...');
    db.close();
    process.exit(0);
});
