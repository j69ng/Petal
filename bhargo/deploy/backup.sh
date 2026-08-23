#!/usr/bin/env bash
# Nightly backup of the books.
#
# Uses SQLite's own .backup, which takes a consistent copy while the app is
# running — copying the file with cp can catch it mid-write and produce a
# backup that will not open. Keeps 30 days.
#
#   sudo cp deploy/backup.sh /usr/local/bin/bhargo-backup
#   sudo chmod +x /usr/local/bin/bhargo-backup
#   sudo crontab -e   ->   15 2 * * * /usr/local/bin/bhargo-backup

set -euo pipefail

DB="${BHARGO_DB:-/var/lib/bhargo/bhargo.db}"
DEST="${BHARGO_BACKUP_DIR:-/var/backups/bhargo}"
KEEP_DAYS="${BHARGO_BACKUP_KEEP:-30}"
STAMP="$(date +%Y-%m-%d)"

mkdir -p "$DEST"
sqlite3 "$DB" ".backup '$DEST/bhargo-$STAMP.db'"
gzip -f "$DEST/bhargo-$STAMP.db"

# Prove the newest backup actually opens. A backup nobody has read is a rumour.
gunzip -c "$DEST/bhargo-$STAMP.db.gz" > /tmp/bhargo-verify.db
sqlite3 /tmp/bhargo-verify.db "select count(*) from purchases;" > /dev/null
rm -f /tmp/bhargo-verify.db

find "$DEST" -name 'bhargo-*.db.gz' -mtime "+$KEEP_DAYS" -delete

echo "Backed up $DB -> $DEST/bhargo-$STAMP.db.gz"
