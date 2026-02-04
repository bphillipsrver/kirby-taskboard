const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'kirby-taskboard-2025-elvis';

// Ensure uploads directory exists
const uploadsDir = process.env.DATABASE_PATH ? path.join(path.dirname(process.env.DATABASE_PATH), 'uploads') : './uploads';
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept all file types for now
        cb(null, true);
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));

// Initialize SQLite database
const db = new sqlite3.Database(process.env.DATABASE_PATH || './tasks.db');

// Create tasks table if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        assignee TEXT DEFAULT 'Kirby',
        notes TEXT,
        column TEXT DEFAULT 'todo',
        due_date DATE,
        attachment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Migration: Add due_date column if it doesn't exist
    db.run(`ALTER TABLE tasks ADD COLUMN due_date DATE`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Migration error:', err);
        }
    });
    
    // Migration: Add attachment column if it doesn't exist
    db.run(`ALTER TABLE tasks ADD COLUMN attachment TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Migration error:', err);
        }
    });
});

// API Key middleware
const requireAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' });
    }
    next();
};

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all tasks
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch tasks' });
        }
        res.json(rows);
    });
});

// GET single task
app.get('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch task' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(row);
    });
});

// CREATE task (requires auth)
app.post('/api/tasks', requireAuth, (req, res) => {
    const { title, priority = 'medium', assignee = 'Kirby', notes = '', column = 'todo', due_date = null, attachment = null } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }
    
    const sql = `INSERT INTO tasks (title, priority, assignee, notes, column, due_date, attachment) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [title, priority, assignee, notes, column, due_date, attachment], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to create task' });
        }
        
        db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch created task' });
            }
            res.status(201).json(row);
        });
    });
});

// UPDATE task (requires auth)
app.put('/api/tasks/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, priority, assignee, notes, column, due_date, attachment } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (assignee !== undefined) { updates.push('assignee = ?'); values.push(assignee); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (column !== undefined) { updates.push('column = ?'); values.push(column); }
    if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
    if (attachment !== undefined) { updates.push('attachment = ?'); values.push(attachment); }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(sql, values, function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to update task' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch updated task' });
            }
            res.json(row);
        });
    });
});

// DELETE task (requires auth)
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to delete task' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json({ message: 'Task deleted successfully' });
    });
});

// Bulk update task columns (for drag & drop reordering)
app.post('/api/tasks/reorder', requireAuth, (req, res) => {
    const { tasks } = req.body;
    
    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Tasks array is required' });
    }
    
    const stmt = db.prepare('UPDATE tasks SET column = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    
    let updated = 0;
    db.serialize(() => {
        tasks.forEach(task => {
            if (task.id && task.column) {
                stmt.run(task.column, task.id, function(err) {
                    if (!err) updated++;
                });
            }
        });
        stmt.finalize();
    });
    
    res.json({ message: 'Tasks reordered', updated });
});

// File upload endpoint
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
        message: 'File uploaded successfully',
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: fileUrl,
        size: req.file.size
    });
});

// Parse PDF endpoint
app.post('/api/parse-pdf', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'File must be a PDF' });
    }
    
    try {
        const filePath = req.file.path;
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        
        res.json({
            text: pdfData.text,
            numPages: pdfData.numpages,
            info: pdfData.info,
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('PDF parsing error:', error);
        res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🐶 Kirby Task Board server running on port ${PORT}`);
    console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    db.close(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
});
// Deployed at Tue Feb  3 23:53:29 EST 2026
