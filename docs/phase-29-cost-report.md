# Phase 29 Production Cost Monitoring & Capacity Economics

**Date**: September 28, 2026  
**Scope**: Projected Monthly Run Rate for Controlled Public Beta (AWS ap-southeast-1 Bangkok/Singapore)  

---

## 1. Projected Monthly Cost Breakdown

| Component | AWS / Infrastructure Service | Beta Allocation | Estimated Monthly Cost (USD) | Notes & Sizing |
| :--- | :--- | :--- | :--- | :--- |
| **API Compute** | AWS ECS Fargate | 2 x 0.5 vCPU, 1 GB RAM | $34.50 | 24/7 dual-task baseline |
| **Database** | AWS RDS PostgreSQL (db.t4g.medium) | Multi-AZ, 50 GB gp3 | $72.00 | PostGIS enabled, automated daily backup |
| **Realtime / Cache** | AWS ElastiCache Valkey (cache.t4g.micro) | 1 Node (Cluster disabled) | $14.80 | Pub/Sub & token bucket rate limiter |
| **Durable Queue** | AWS SQS (FIFO + Standard) | ~500,000 requests / mo | $0.25 | Negligible cost at beta traffic tier |
| **Object Storage** | AWS S3 Standard + Lifecycle | 50 GB images + backups | $1.25 | 30-day transition to Glacier Instant |
| **Network Egress** | AWS CloudFront / Data Transfer | ~120 GB egress / mo | $10.80 | Free tier covers first 1TB on CloudFront |
| **Map Tiles** | Self-hosted vector / PMTiles | CloudFront edge cached | $5.00 | Zero third-party Mapbox/Google API fees |
| **Satellite STAC** | Copernicus Data Space Ecosystem | Open Access STAC API | $0.00 | Free open scientific tier |
| **Logging / Observability** | CloudWatch Logs + Metrics | 10 GB ingested | $5.70 | 14-day retention rule enforced |
| **Total Estimated Run Rate** | | | **~$144.30 / month** | Highly cost-efficient municipal footprint |

---

## 2. Runaway Cost Risks & Enforced Circuit Breakers

### 1. Image Upload Flooding Abuse
- **Risk**: Malicious scripts uploading thousands of 50MB files to inflate S3 storage and egress bills.
- **Enforced Safeguard**: Strict 5MB size limit enforced by Nginx and FastAPI middleware. Upload rate limiter restricts each IP to maximum 15 image checks per minute. Images are transcoded to optimized JPEG (85% quality), stripping 60-80% of raw bytes.

### 2. Runaway SSE Connection Fanout
- **Risk**: Abandoned browser tabs holding millions of idle TCP connections causing memory ballooning on API nodes.
- **Enforced Safeguard**: Client heartbeat timeout disconnects dead sockets after 45 seconds of silence. Connection limiter caps maximum concurrent SSE streams at 500 per container.

### 3. Third-Party Map Tile API Billing Spikes
- **Risk**: OpenStreetMap or Mapbox tile billing surprises during high-traffic flood events.
- **Enforced Safeguard**: System exclusively uses self-hosted static vector tiles cached globally via CloudFront/CDN edges. Zero per-request commercial map API dependencies.

### 4. Excessive CloudWatch / Application Logging
- **Risk**: Debug-level request logging generating gigabytes of CloudWatch log ingestion charges.
- **Enforced Safeguard**: Production log level set to `INFO`. Health check endpoints (`/health/live`, `/health/ready`) are suppressed from access logs to prevent log pollution.
