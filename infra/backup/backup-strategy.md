# KMITL Flood Intelligence — Disaster Recovery & Backup Strategy

## 1. RPO & RTO Objectives

In the event of an operational crisis, severe flooding, or multi-zone infrastructure loss:

| Metric | Target | Rationale & Mechanism |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 5 minutes** | AWS RDS Automated Continuous Backups + WAL Archiving (Point-In-Time-Recovery) + S3 Versioning for photos. |
| **RTO (Recovery Time Objective)** | **< 30 minutes** | Infrastructure as Code (Terraform) + Containerized Stateless Services on AWS ECS Fargate + RDS Multi-AZ Auto-Failover (< 60s). |

---

## 2. Backup Architecture

### 2.1 Database (PostgreSQL 16 + PostGIS)
- **Continuous Backups:** AWS RDS automated daily snapshots retained for 14 days, plus transaction log streaming every 5 minutes enabling Point-In-Time-Recovery (PITR).
- **Logical Periodic Backups:** Encrypted `pg_dump` taken before any schema migration, saved to an isolated secondary S3 backup bucket with Glacier Instant Retrieval lifecycle.
- **Multi-AZ Replication:** Synchronous standby replica in a secondary Availability Zone automatically assumes master role if Primary AZ encounters hardware or network failure.

### 2.2 Object Storage (User Reports & Evidence)
- **S3 Versioning:** Protects against accidental deletion or malicious overwrite.
- **Cross-Region Replication (CRR):** S3 bucket replicated to secondary region (`ap-southeast-2` / Sydney or `ap-northeast-1` / Tokyo) for disaster recovery.

### 2.3 Secrets & Configurations
- Managed via AWS Secrets Manager / Parameter Store with KMS encryption.
- Local developer copies strictly prohibited from referencing production secrets.

---

## 3. Verification & Routine Testing

> [!IMPORTANT]
> **A backup that has never been restored is not a verified backup.**

- Automated quarterly restoration drills restore the latest snapshot to an isolated staging database.
- Integrity verification script checks PostGIS geometry validity, table row counts, and incident referential integrity.
