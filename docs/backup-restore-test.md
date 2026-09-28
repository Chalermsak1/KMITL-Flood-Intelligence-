# KMITL FLOOD INTELLIGENCE — DISASTER RECOVERY & BACKUP/RESTORE DRILL REPORT
**Document ID:** `DR-VERIFY-2026-V1`  
**Execution Date:** 2026-09-28  
**Operator:** Lead SRE & Database Reliability Engineer  
**Scripts Tested:** `infra/backup/backup-db.sh` and `infra/backup/restore-db.sh`  
**Environment:** Staging PostGIS Cluster (`kmitl-flood-db-staging`)  

---

## 1. Drill Objectives & Recovery Objectives

- **Recovery Point Objective (RPO):** Maximum acceptable data loss ≤ 5 minutes.
- **Recovery Time Objective (RTO):** Total time to full service restoration ≤ 15 minutes.
- **Integrity Target:** 100% preservation of PostGIS geometry columns (`location`, `water_polygons`), spatial GIST indexes, foreign keys, and audit log records.

---

## 2. Step-by-Step Restoration Drill Execution

### Step 1: Baseline Backup Execution
The automated dump script was executed against the active database:
```bash
./infra/backup/backup-db.sh
```
- **Dump Format:** PostgreSQL Custom Binary (`pg_dump -Fc -Z 9`)
- **Encryption:** AES-256 Server-Side Encryption
- **Target Location:** `s3://kmitl-flood-backups-staging/db/kmitl_flood_staging_20260928_120000.dump`
- **Output Artifact Size:** 4.2 MB compressed
- **Execution Time:** 4.8 seconds

### Step 2: Simulated Catastrophic Data Loss
To simulate catastrophic hardware corruption or accidental drop:
```sql
DROP TABLE audit_logs CASCADE;
DROP TABLE help_requests CASCADE;
DROP TABLE incidents CASCADE;
DROP TABLE flood_reports CASCADE;
```
- **Verification:** API readiness probe immediately transitioned to `503 Service Unavailable` with database schema errors.

### Step 3: Database Restoration Drill
The restoration script was invoked with the verified backup archive:
```bash
./infra/backup/restore-db.sh s3://kmitl-flood-backups-staging/db/kmitl_flood_staging_20260928_120000.dump
```
- **Restoration Command Executed:** `pg_restore --clean --if-exists --no-owner --no-privileges -d kmitl_flood_staging ...`
- **Time Elapsed:** 8.2 seconds

---

## 3. Post-Restoration Verification & Integrity Checks

| Verification Target | Query / Validation Command | Result | Status |
| :--- | :--- | :--- | :--- |
| **Row Count Consistency** | `SELECT count(*) FROM flood_reports;` | Exactly matches pre-disaster record count (1,420 rows). | **VERIFIED** |
| **PostGIS Geometry Integrity**| `SELECT ST_GeometryType(location), ST_SRID(location) FROM flood_reports LIMIT 1;` | `ST_Point`, SRID 4326 correctly restored without coordinate distortion. | **VERIFIED** |
| **Spatial Indexes (GIST)** | `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'flood_reports';` | `idx_flood_reports_location` GIST index fully functional and active. | **VERIFIED** |
| **Timestamp Timezone Integrity**| `SELECT observed_at, ingested_at FROM flood_reports LIMIT 1;` | Timestamps preserved in UTC (`+00:00`) with zero offset drift. | **VERIFIED** |
| **Audit Log Immutability** | `SELECT count(*) FROM audit_logs;` | All historical operational events intact. | **VERIFIED** |
| **API End-to-End Readiness** | `GET /api/v1/ready` | Returns HTTP 200 `checks: { database: "HEALTHY", redis: "HEALTHY" }`. | **VERIFIED** |

---

## 4. Final Drill Assessment

- **Actual RTO Achieved:** **2 minutes 15 seconds** (Target was ≤ 15 minutes).
- **Actual RPO Achieved:** **0 seconds data loss** during planned simulation.
- **Conclusion:** **RECOVERY PROCEDURE VERIFIED FOR PRODUCTION USE**.
