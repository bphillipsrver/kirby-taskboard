# Kirby Task Board - Local Setup

## Quick Start

### 1. Install Dependencies
```bash
cd C:\Users\king\.openclaw\workspace\kirby-taskboard
npm install
```

### 2. Set Environment Variables
Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

Edit `.env` if needed (defaults are fine for local use):
```
API_KEY=kirby-taskboard-2025-elvis
PORT=3000
DATABASE_PATH=./tasks.db
```

### 3. Start the Server
```bash
npm start
```

Server will be available at:
- **Local:** http://localhost:3000
- **Network:** http://192.168.1.151:3000

### 4. Enable Auto-Start (Optional)

**Option A: Run PowerShell script (Recommended)**
```powershell
# Run as Administrator
.\setup-autostart.ps1
```

**Option B: Manual setup**
1. Press `Win + R`, type `shell:startup`, press Enter
2. Right-click → New → Shortcut
3. Target: `wscript.exe "C:\Users\king\.openclaw\workspace\kirby-taskboard\start-server.vbs"`
4. Name it "Kirby Task Board"

## Access from Other Devices

Any device on your network (same WiFi) can access:
```
http://192.168.1.151:3000
```

## Backup

The database is a single file: `tasks.db`
- Copy this file to backup
- Store in Synology Drive, Dropbox, etc.
- Database is automatically created if missing

## API Key

All write operations (create, update, delete) require the API key:
```
X-API-Key: kirby-taskboard-2025-elvis
```

## Troubleshooting

**Port 3000 already in use:**
Edit `.env` and change `PORT` to another number (e.g., 3001)

**Firewall blocking access:**
Run PowerShell as Administrator:
```powershell
New-NetFirewallRule -DisplayName "Kirby Task Board" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

**Server not accessible from other devices:**
1. Check Windows Firewall settings
2. Verify devices are on the same network
3. Check IP hasn't changed: run `ipconfig` and look for IPv4 Address
