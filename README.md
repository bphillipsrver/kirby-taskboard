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

## License

MIT
# Trigger deploy Tue Feb  3 23:50:45 EST 2026
