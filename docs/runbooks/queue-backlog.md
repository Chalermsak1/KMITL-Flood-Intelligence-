# Runbook: SQS / Job Queue Backlog & Dead Letter Queue (DLQ) Spike
**Runbook ID:** `RB-ASYNC-QUEUE-007`  
**Service:** AWS SQS (`kmitl-flood-jobs`), SQS DLQ (`kmitl-flood-jobs-dlq`), Worker Fleet  
**Alert:** `AlertQueueBacklogExceeded` (> 500 messages) or `AlertDLQNotEmpty` (> 0 messages)  

---

### 1. Symptoms & Trigger
- CloudWatch Alarm: `ApproximateNumberOfMessagesVisible` on `kmitl-flood-jobs` exceeds 500.
- DLQ depth > 0 indicates unhandled job processing exceptions after 3 retries.
- Newly submitted flood reports take > 2 minutes to show up in DBSCAN incident clusters.

### 2. Operational Impact
- Delay in asynchronous AI image verification, incident clustering recalculation, and situation risk scoring.
- **Immediate citizen report submissions and SOS registrations remain fast and unaffected** because the ingestion API responds in < 200ms before offloading to queue.

### 3. Diagnostic Steps
1. Query current queue depths:
   ```bash
   aws sqs get-queue-attributes --queue-url $SQS_QUEUE_URL --attribute-names ApproximateNumberOfMessagesVisible ApproximateNumberOfMessagesNotVisible
   aws sqs get-queue-attributes --queue-url $SQS_DLQ_URL --attribute-names ApproximateNumberOfMessagesVisible
   ```
2. Check ECS worker service logs for task timeouts or errors:
   ```bash
   aws logs tail /ecs/kmitl-flood-workers-prod --follow
   ```
3. Inspect DLQ payloads to identify failing job types (e.g. `AI_VERIFY` failing on corrupted images).

### 4. Remediation Procedure
1. **Queue Backlog (High Throughput Surge):**
   - Auto-scale worker fleet:
     ```bash
     aws ecs update-service --cluster kmitl-flood-prod --service kmitl-flood-workers-prod --desired-count 10
     ```
   - If AI vision inference is the bottleneck, enable batch mode or bypass non-critical image verification for low-priority reports.
2. **DLQ Message Triage:**
   - Extract messages from DLQ for post-mortem:
     ```bash
     aws sqs receive-message --queue-url $SQS_DLQ_URL --max-number-of-messages 10
     ```
   - Fix underlying schema or timeout bug, deploy patch, and redrive messages back to main queue.

### 5. Verification
- Verify `/api/v1/metrics` displays `queue.backlog_jobs < 50` and `queue.dead_letter_jobs == 0`.
- Verify incident clustering updates promptly after new report submissions.
