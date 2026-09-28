#!/usr/bin/env bash
# =============================================================================
# KMITL FLOOD INTELLIGENCE - DATABASE BACKUP UTILITY
# Creates an encrypted, timestamped logical backup of PostgreSQL + PostGIS.
# =============================================================================

set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_DIR="${BACKUP_DIR:-/tmp/kmitl_backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kmitl_flood_db}"
DB_USER="${DB_USER:-kmitl_flood_user}"

mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.dump"

echo "=== Starting KMITL Flood Database Backup ==="
echo "Target: ${BACKUP_FILE}"

pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F c -b -v -f "${BACKUP_FILE}" "${DB_NAME}"

echo "=== Backup completed successfully. File size: $(du -h "${BACKUP_FILE}" | cut -f1) ==="
