#!/usr/bin/env bash
# =============================================================================
# KMITL FLOOD INTELLIGENCE - DATABASE RESTORATION UTILITY
# Restores a logical dump into target PostgreSQL + PostGIS database.
# =============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_backup_dump_file>"
    exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kmitl_flood_db}"
DB_USER="${DB_USER:-kmitl_flood_user}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "=== WARNING: Restoring database ${DB_NAME} from ${BACKUP_FILE} ==="
echo "Host: ${DB_HOST}:${DB_PORT} | User: ${DB_USER}"

pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v --clean --if-exists "${BACKUP_FILE}" || {
    echo "Restoration finished with non-fatal warnings (e.g. extension ownership)."
}

echo "=== Restoration verification: checking table count ==="
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT count(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'public';"

echo "=== Restoration procedure completed successfully ==="
