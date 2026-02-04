const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'kirby-taskboard-2025-elvis';

// Supabase PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Database connected:', res.rows[0].now);
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
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                priority TEXT DEFAULT 'medium',
                assignee TEXT DEFAULT 'Kirby',
                notes TEXT,
                status TEXT DEFAULT 'todo',
                position INTEGER DEFAULT 0,
                due_date DATE,
                attachment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add position column if it doesn't exist (migration)
        try {
            await pool.query('ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0');
            console.log('✅ Added position column');
        } catch (err) {
            // Column already exists
        }
        
        console.log('✅ Database table initialized');
        
        // Log task count
        const result = await pool.query('SELECT COUNT(*) as count FROM tasks');
        console.log('📊 Tasks in database:', result.rows[0].count);
    } catch (err) {
        console.error('❌ Database initialization error:', err);
    }
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
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as count FROM tasks');
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                taskCount: result.rows[0].count
            }
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            error: err.message 
        });
    }
});

// GET all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY status, position ASC, created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// GET single task
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching task:', err);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// CREATE task
app.post('/api/tasks', requireAuth, async (req, res) => {
    const { title, priority = 'medium', assignee = 'Kirby', notes = '', status = 'todo', due_date = null, attachment = null } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }
    
    console.log(`📝 Creating task: "${title.substring(0, 50)}..."`);
    
    try {
        // Get max position for this status to add to end
        const posResult = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 as new_pos FROM tasks WHERE status = $1', [status]);
        const newPosition = posResult.rows[0].new_pos;
        
        const result = await pool.query(
            `INSERT INTO tasks (title, priority, assignee, notes, status, position, due_date, attachment) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [title, priority, assignee, notes, status, newPosition, due_date, attachment]
        );
        
        console.log(`✅ Task created with ID: ${result.rows[0].id} at position ${newPosition}`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('❌ Create error:', err);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// UPDATE task
app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    const { title, priority, assignee, notes, status, due_date, attachment } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (priority !== undefined) { updates.push(`priority = $${paramCount++}`); values.push(priority); }
    if (assignee !== undefined) { updates.push(`assignee = $${paramCount++}`); values.push(assignee); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }
    if (status !== undefined) { updates.push(`status = $${paramCount++}`); values.push(status); }
    if (due_date !== undefined) { updates.push(`due_date = $${paramCount++}`); values.push(due_date); }
    if (attachment !== undefined) { updates.push(`attachment = $${paramCount++}`); values.push(attachment); }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);
    
    try {
        const result = await pool.query(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// DELETE task
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    console.log(`🗑️ Deleting task ID: ${req.params.id}`);
    
    try {
        const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        console.log(`✅ Task ${req.params.id} deleted`);
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        console.error('❌ Delete error:', err);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// REORDER tasks within a status
app.post('/api/tasks/reorder', requireAuth, async (req, res) => {
    const { tasks } = req.body;
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'Tasks array required' });
    }
    
    console.log(`🔄 Reordering ${tasks.length} tasks`);
    
    try {
        // Update positions in a transaction
        await pool.query('BEGIN');
        
        for (let i = 0; i < tasks.length; i++) {
            const { id, position, status } = tasks[i];
            await pool.query(
                'UPDATE tasks SET position = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [position, status, id]
            );
        }
        
        await pool.query('COMMIT');
        
        console.log('✅ Tasks reordered successfully');
        res.json({ message: 'Tasks reordered successfully', count: tasks.length });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('❌ Reorder error:', err);
        res.status(500).json({ error: 'Failed to reorder tasks' });
    }
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

// Start server
app.listen(PORT, () => {
    console.log(`🐶 Kirby Task Board running on port ${PORT}`);
    console.log(`📊 Database: Supabase PostgreSQL`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    pool.end(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
});
