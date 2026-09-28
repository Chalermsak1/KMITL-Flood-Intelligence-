# Runbook: Redis / Valkey Cache & PubSub Outage
**Runbook ID:** `RB-INFRA-REDIS-006`  
**Service:** AWS ElastiCache Valkey / Redis Cluster  
**Alert:** `AlertRedisUnreachable`  

---

### 1. Symptoms & Trigger
- API readiness probe `/api/v1/ready` fails with `checks.redis = "FAILED"`.
- Real-time SSE / WebSocket event broadcasts cease propagating to web clients.
- Rate limiting and session caching fail open or emit connection warnings.

### 2. Operational Impact
- **Non-authoritative state only:** Redis does NOT store persistent database records.
- Real-time updates stall; browser clients must fall back to polling snapshots every 15–30 seconds.
- Database query volume may spike due to cache misses.

### 3. Diagnostic Steps
1. Verify Redis cluster status:
   ```bash
   aws elasticache describe-replication-groups --replication-group-id kmitl-flood-redis-prod
   ```
2. Check memory usage and eviction rate in CloudWatch: `BytesUsedForCache`, `EngineCPUUtilization`.

### 4. Remediation Procedure
1. If ElastiCache node has failed:
   - Allow AWS ElastiCache automatic Multi-AZ failover to promote replica (~30 seconds).
   - If node is stuck in memory exhaustion, flush volatile caches:
     ```bash
     redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD FLUSHDB ASYNC
     ```
2. If temporary network partition:
   - Verify security group rules allowing inbound port 6379 from ECS tasks.
   - The API is designed with graceful fallbacks; core database reads will serve traffic while Redis reconnects.

### 5. Verification
- Confirm `/api/v1/ready` reports `checks.redis: "HEALTHY"`.
- Confirm SSE event stream connects and delivers heartbeats via `/api/v1/realtime/events`.
