# 🐶 Kirby Task Board

A full-stack task board application with backend sync for Elvis and Kirby.

## Features

- 📝 **Kanban Board**: Three columns (To Do, In Progress, Done)
- 🔄 **Real-time Sync**: Tasks sync across all devices
- 🔐 **API Key Auth**: Secure access control for modifications
- 👤 **Assignees**: Tasks can be assigned to Elvis or Kirby
- 🏷️ **Priority Levels**: High, Medium, Low
- 📝 **Notes**: Add details to tasks
- 🖱️ **Drag & Drop**: Move tasks between columns
- 📱 **Mobile Friendly**: Works on all devices

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite
- **Frontend**: Vanilla HTML/CSS/JS
- **Deployment**: Render (free tier)

## API Documentation

### Authentication
All write operations require an API key in the header:
```
X-API-Key: your-secret-api-key
```

### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check | No |
| GET | `/api/tasks` | Get all tasks | No |
| GET | `/api/tasks/:id` | Get single task | No |
| POST | `/api/tasks` | Create task | Yes |
| PUT | `/api/tasks/:id` | Update task | Yes |
| DELETE | `/api/tasks/:id` | Delete task | Yes |
| POST | `/api/tasks/reorder` | Bulk update columns | Yes |

### Example API Usage

```bash
# Get all tasks
curl https://your-app.onrender.com/api/tasks

# Create a task
curl -X POST https://your-app.onrender.com/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "title": "Walk Kirby",
    "priority": "high",
    "assignee": "Elvis",
    "notes": "Take the long route",
    "column": "todo"
  }'

# Update a task
curl -X PUT https://your-app.onrender.com/api/tasks/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{"column": "done"}'

# Delete a task
curl -X DELETE https://your-app.onrender.com/api/tasks/1 \
  -H "X-API-Key: your-secret-api-key"
```

## Deployment

### Render (Recommended)
1. Connect your GitHub repo to Render
2. Create a new Web Service
3. Set environment variable: `API_KEY=your-secret-key`
4. Deploy!

### Railway
1. Connect your GitHub repo to Railway
2. Set environment variable: `API_KEY=your-secret-key`
3. Deploy!

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env and set your API_KEY

# Run server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `API_KEY` | Secret key for write operations | kirby-taskboard-secret-key |
| `DATABASE_PATH` | SQLite database path | ./tasks.db |

## Backup & Restore

### Automatic Backups

The application includes a backup system to protect your task data:

**Features:**
- ✅ Daily automated backups (configurable)
- ✅ 30-day retention policy
- ✅ Multiple backup formats (SQL, JSON)
- ✅ Easy one-click restore

### Manual Backup

**Via API:**
```bash
curl https://your-app.onrender.com/api/backup \
  -H "X-API-Key: your-secret-api-key"
```

**Response:**
```json
{
  "message": "Backup created successfully",
  "timestamp": "2024-02-04T10-30-00-000Z",
  "taskCount": 15,
  "files": {
    "sql": "/backups/backup-2024-02-04T10-30-00-000Z.sql",
    "json": "/backups/tasks-2024-02-04T10-30-00-000Z.json"
  }
}
```

**Download Backup Files:**
```bash
# Download SQL backup
curl https://your-app.onrender.com/backups/backup-2024-02-04T10-30-00-000Z.sql

# Download JSON backup
curl https://your-app.onrender.com/backups/tasks-2024-02-04T10-30-00-000Z.json
```

### Restore from Backup

**Option 1: Using the restore script (Local)**
```bash
# Download backup first
curl -O https://your-app.onrender.com/backups/backup-2024-02-04T10-30-00-000Z.sql

# Restore
./scripts/restore.sh backup-2024-02-04T10-30-00-000Z.sql
```

**Option 2: Manual restore**
```bash
# Stop the server
# Replace database file
sqlite3 tasks.db < backup-file.sql
# Restart the server
```

### Automated Daily Backups

**Setup (GitHub Actions):**

1. Create a `backups` branch in your repo:
   ```bash
   git checkout -b backups
   git push origin backups
   ```

2. Add GitHub Secrets:
   - `BACKUP_API_KEY`: Your API key
   - `API_URL`: Your Render app URL

3. The backup workflow will run daily at 2 AM UTC

**Backup Retention:**
- Backups older than 30 days are automatically deleted
- Each backup includes SQL dump + JSON export
- Stored in GitHub repository (`backups` branch)

## Troubleshooting

### Tasks not persisting?
1. Check sync status indicator (bottom left)
2. Verify database disk is mounted on Render
3. Check server logs for errors

### How to check if backup is working?
```bash
# Trigger manual backup
curl https://your-app.onrender.com/api/backup \
  -H "X-API-Key: your-secret-api-key"

# List backup files
curl https://your-app.onrender.com/backups/
```

## License

MIT
