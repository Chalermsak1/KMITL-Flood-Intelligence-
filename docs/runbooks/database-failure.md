# Runbook: PostgreSQL / PostGIS Database Failure
**Runbook ID:** `RB-INFRA-DB-005`  
**Service:** AWS RDS PostgreSQL + PostGIS Cluster  
**Alert:** `AlertDatabaseDown` / `AlertDatabaseConnectionSpike`  

---

### 1. Symptoms & Trigger
- API readiness probe `/api/v1/ready` fails (`checks.database = "FAILED"`).
- Database CPU exceeds 90% or `DatabaseConnections` reaches connection limit (> 400).
- User reports or SOS submissions encounter SQLAlchemy timeout errors.

### 2. Operational Impact
- **CRITICAL SEV-1:** Reports cannot persist, incidents cannot be calculated, and SOS records cannot be stored.
- Mitigation must execute immediately.

### 3. Diagnostic Steps
1. Check RDS instance status in AWS Console or CLI:
   ```bash
   aws rds describe-db-instances --db-instance-identifier kmitl-flood-rds-prod --query "DBInstances[0].DBInstanceStatus"
   ```
2. Inspect active locks and connections:
   ```sql
   SELECT pid, age(clock_timestamp(), query_start), usename, query, state 
   FROM pg_stat_activity 
   WHERE state != 'idle' AND query NOT ILIKE '%pg_stat%'
   ORDER BY age(clock_timestamp(), query_start) DESC LIMIT 10;
   ```
3. Inspect disk space and IOPS metrics in CloudWatch.

### 4. Remediation Procedure
1. **Connection Exhaustion:**
   - Terminate long-running blocking spatial queries:
     ```sql
     SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE age(clock_timestamp(), query_start) > interval '30 seconds';
     ```
   - Restart API task containers in rolling batches to release leaked connection pools.
2. **Multi-AZ Automatic Failover:**
   - If primary RDS instance is unresponsive, trigger manual reboot with failover:
     ```bash
     aws rds reboot-db-instance --db-instance-identifier kmitl-flood-rds-prod --force-failover
     ```
   - Failover completes in ~60-120 seconds.
3. **Catastrophic Data Recovery:**
   - Execute Point-in-Time Recovery (PITR) to a target timestamp:
     ```bash
     ./infra/backup/restore-db.sh s3://kmitl-flood-backups-prod/db/kmitl_flood_prod_latest.dump
     ```

### 5. Verification
- Run `curl https://api.flood.kmitl.ac.th/api/v1/ready` and confirm `status: "READY"`.
- Verify database latency in `/api/v1/metrics` drops below 10ms.
