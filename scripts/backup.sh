#!/bin/sh
# ============================================
# Aegis NGFW - Automated Database Backup
# Runs inside the backup container via cron
# ============================================

set -e

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/aegis_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup..."

# Create backup directory if not exists
mkdir -p "${BACKUP_DIR}"

# Dump database with compression
pg_dump \
  --format=custom \
  --compress=9 \
  --verbose \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_FILE}" \
  2>&1

# Verify backup
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[$(date)] Backup complete: ${BACKUP_FILE} (${SIZE})"
else
  echo "[$(date)] ERROR: Backup file is empty or missing!"
  exit 1
fi

# Cleanup old backups
echo "[$(date)] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "aegis_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# List remaining backups
TOTAL=$(ls -1 ${BACKUP_DIR}/aegis_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Total backups retained: ${TOTAL}"

echo "[$(date)] Backup job finished."
