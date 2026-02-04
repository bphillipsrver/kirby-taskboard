#!/bin/bash
# Restore script for Kirby Task Board database
# Usage: ./restore.sh backup-file.sql

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup-file.sql>"
    echo ""
    echo "Available backups:"
    ls -la backups/backup-*.sql 2>/dev/null || echo "  No local backups found"
    exit 1
fi

BACKUP_FILE="$1"
DB_PATH="${DATABASE_PATH:-./tasks.db}"

echo "🔄 Restoring database..."
echo "📁 Backup file: $BACKUP_FILE"
echo "💾 Database path: $DB_PATH"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create backup of current database before restore
if [ -f "$DB_PATH" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    echo "📋 Creating safety backup of current database..."
    cp "$DB_PATH" "${DB_PATH}.pre-restore-${TIMESTAMP}"
fi

# Restore database
echo "💾 Restoring from backup..."
sqlite3 "$DB_PATH" < "$BACKUP_FILE"

echo "✅ Database restored successfully!"
echo "🚀 Restart the server to apply changes"
