const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { fromPath } = require('pdf2pic');
const { createWorker } = require('tesseract.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'kirby-taskboard-2025-elvis';

// Initialize SQLite database path
const dbPath = process.env.DATABASE_PATH || './tasks.db';

// Log database info on startup
console.log('🔍 Starting database diagnostics...');
console.log('   Database path:', dbPath);
console.log('   Database dir exists:', fs.existsSync(path.dirname(dbPath)));
console.log('   Database file exists:', fs.existsSync(dbPath));
if (fs.existsSync(dbPath)) {
    console.log('   Database file size:', fs.statSync(dbPath).size, 'bytes');
}

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

// Initialize SQLite database connection
const db = new sqlite3.Database(dbPath);

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
    
    // Log task count on startup
    db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
        if (err) {
            console.error('Error counting tasks:', err);
        } else {
            console.log('📊 Tasks in database:', row.count);
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

// Health check with database diagnostics
app.get('/api/health', (req, res) => {
    const dbExists = fs.existsSync(dbPath);
    const dbSize = dbExists ? fs.statSync(dbPath).size : 0;
    
    db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
        const taskCount = err ? 0 : row.count;
        
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            database: {
                path: dbPath,
                exists: dbExists,
                size: dbSize,
                taskCount: taskCount
            }
        });
    });
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
    
    console.log(`📝 Creating task: "${title.substring(0, 50)}..." at ${new Date().toISOString()}`);
    
    const sql = `INSERT INTO tasks (title, priority, assignee, notes, column, due_date, attachment) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [title, priority, assignee, notes, column, due_date, attachment], function(err) {
        if (err) {
            console.error('❌ Create error:', err);
            return res.status(500).json({ error: 'Failed to create task' });
        }
        
        console.log(`✅ Task created with ID: ${this.lastID}`);
        
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
    
    // Log deletion for debugging
    console.log(`🗑️ Deleting task ID: ${id} at ${new Date().toISOString()}`);
    
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ Delete error:', err);
            return res.status(500).json({ error: 'Failed to delete task' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        console.log(`✅ Task ${id} deleted successfully`);
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

// Parse PDF endpoint with OCR fallback
app.post('/api/parse-pdf', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'File must be a PDF' });
    }
    
    const filePath = req.file.path;
    let worker = null;
    
    try {
        // First try regular PDF text extraction
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        
        // If text is found, return it
        if (pdfData.text && pdfData.text.trim().length > 50) {
            return res.json({
                text: pdfData.text,
                numPages: pdfData.numpages,
                info: pdfData.info,
                filename: req.file.originalname,
                source: 'text-extraction'
            });
        }
        
        // If no text or minimal text, try OCR
        console.log('No text found in PDF, attempting OCR...');
        
        // Convert PDF to images
        const outputDir = path.join(uploadsDir, 'ocr-temp');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const convert = fromPath(filePath, {
            density: 150,
            saveFilename: 'page',
            savePath: outputDir,
            format: 'png',
            width: 1200
        });
        
        const images = await convert.bulk(-1); // Convert all pages
        
        // OCR each image
        worker = await createWorker('eng');
        let fullText = '';
        
        for (const image of images) {
            const { data: { text } } = await worker.recognize(image.path);
            fullText += text + '\n\n';
        }
        
        await worker.terminate();
        
        // Clean up temp images
        images.forEach(img => {
            try { fs.unlinkSync(img.path); } catch (e) {}
        });
        
        res.json({
            text: fullText,
            numPages: images.length,
            info: pdfData.info,
            filename: req.file.originalname,
            source: 'ocr'
        });
        
    } catch (error) {
        console.error('PDF parsing/OCR error:', error);
        if (worker) await worker.terminate().catch(() => {});
        res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
    }
});

// Backup endpoint - exports database as SQL and JSON
app.get('/api/backup', requireAuth, (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'backups');
        
        // Ensure backups directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const sqlFile = path.join(backupDir, `backup-${timestamp}.sql`);
        const jsonFile = path.join(backupDir, `tasks-${timestamp}.json`);
        
        // Export SQL
        const { exec } = require('child_process');
        exec(`sqlite3 "${dbPath}" ".dump" > "${sqlFile}"`, (error) => {
            if (error) {
                console.error('SQL backup error:', error);
                return res.status(500).json({ error: 'Failed to create SQL backup' });
            }
            
            // Export JSON
            db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    console.error('JSON backup error:', err);
                    return res.status(500).json({ error: 'Failed to create JSON backup' });
                }
                
                fs.writeFileSync(jsonFile, JSON.stringify(rows, null, 2));
                
                res.json({
                    message: 'Backup created successfully',
                    timestamp: timestamp,
                    taskCount: rows.length,
                    files: {
                        sql: `/backups/backup-${timestamp}.sql`,
                        json: `/backups/tasks-${timestamp}.json`
                    }
                });
            });
        });
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ error: 'Failed to create backup', details: error.message });
    }
});

// Serve backup files
app.use('/backups', express.static(path.join(__dirname, 'backups')));

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
