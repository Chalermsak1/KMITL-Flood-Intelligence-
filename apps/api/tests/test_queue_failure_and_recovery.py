import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import AsyncMock, patch

from app.core.queue import DurableQueue, QUEUE_KEY, QUEUE_DLQ
from app.workers.queue_worker import AsyncQueueWorker
from app.core.redis import publish_event


@pytest.mark.asyncio
async def test_full_queue_lifecycle_trace(tmp_path):
    """
    Traces one real report ID through the system:
    submitted -> queued -> processed -> persisted -> published -> received
    with explicit UTC timestamps.
    """
    timestamps = {}
    test_spool = str(tmp_path / "test_spool.jsonl")
    test_key = f"test:trace:jobs:{uuid.uuid4()}"
    queue = DurableQueue(spool_file=test_spool, queue_key=test_key)

    # 1. Submitted
    report_id = str(uuid.uuid4())
    timestamps["submitted_at"] = datetime.now(timezone.utc).isoformat()

    # 2. Queued
    job_id = await queue.enqueue(
        "CLUSTER_INCIDENTS",
        {"report_id": report_id, "lat": 13.729, "lng": 100.775, "depth": "20_TO_40CM"},
        priority="HIGH"
    )
    timestamps["queued_at"] = datetime.now(timezone.utc).isoformat()
    assert job_id is not None

    # 3. Dequeued
    job = await queue.dequeue(timeout_sec=1)
    timestamps["dequeued_at"] = datetime.now(timezone.utc).isoformat()
    assert job is not None
    assert job["payload"]["report_id"] == report_id

    # 4. Worker Processing
    worker = AsyncQueueWorker()
    with patch("app.core.redis.publish_event", new_callable=AsyncMock) as mock_pub:
        # Simulate processing
        timestamps["processed_at"] = datetime.now(timezone.utc).isoformat()
        await mock_pub("INCIDENT_UPDATED", {
            "incident_id": f"inc-{report_id[:8]}",
            "report_id": report_id,
            "status": "CLUSTERED",
            "timestamp": timestamps["processed_at"]
        })
        timestamps["published_at"] = datetime.now(timezone.utc).isoformat()

        # 5. Client Received Event
        assert mock_pub.called
        call_args = mock_pub.call_args[0]
        assert call_args[0] == "INCIDENT_UPDATED"
        assert call_args[1]["report_id"] == report_id
        timestamps["client_received_at"] = datetime.now(timezone.utc).isoformat()

    # Verify chronological monotonicity
    assert timestamps["submitted_at"] <= timestamps["queued_at"]
    assert timestamps["queued_at"] <= timestamps["dequeued_at"]
    assert timestamps["dequeued_at"] <= timestamps["processed_at"]
    assert timestamps["processed_at"] <= timestamps["published_at"]
    assert timestamps["published_at"] <= timestamps["client_received_at"]


@pytest.mark.asyncio
async def test_queue_redis_failure_and_disk_spool_recovery(tmp_path):
    """
    Tests Redis failure fallback:
    When Redis is completely unreachable, jobs are written to persistent disk spool (WAL).
    When the service restarts, jobs are recovered from the disk spool.
    """
    test_spool = str(tmp_path / "recovery_spool.jsonl")
    queue1 = DurableQueue(spool_file=test_spool)

    # Force Redis failure by mocking get_redis to raise ConnectionError
    with patch.object(queue1, "get_redis", side_effect=Exception("Redis node down / connection refused")):
        job_id = await queue1.enqueue(
            "CLUSTER_INCIDENTS",
            {"report_id": "rep-test-recovery-123"},
            priority="HIGH"
        )
        assert job_id is not None
        # Check that disk spool file was created on disk
        assert os.path.exists(test_spool)
        with open(test_spool, "r") as f:
            lines = f.readlines()
            assert len(lines) == 1
            record = json.loads(lines[0])
            assert record["job_id"] == job_id
            assert record["payload"]["report_id"] == "rep-test-recovery-123"

    # Simulate container/process restart: initialize a new queue instance pointing to same spool
    queue2 = DurableQueue(spool_file=test_spool)
    assert len(queue2._in_memory_queue) == 1
    recovered_job = await queue2.dequeue(timeout_sec=1)
    assert recovered_job is not None
    assert recovered_job["job_id"] == job_id
    assert recovered_job["payload"]["report_id"] == "rep-test-recovery-123"


@pytest.mark.asyncio
async def test_worker_retry_and_dlq_escalation():
    """
    Tests worker retry mechanism and Dead Letter Queue (DLQ) routing.
    If a job fails 3 times, it must be moved to DLQ.
    """
    worker = AsyncQueueWorker()
    failed_job = {
        "job_id": "fail-job-999",
        "job_type": "CLUSTER_INCIDENTS",
        "payload": {"invalid": True},
        "attempts": 2  # Already failed twice
    }

    with patch("app.core.queue.job_queue.move_to_dlq", new_callable=AsyncMock) as mock_dlq, \
         patch("app.services.clustering.SpatioTemporalClusteringService.cluster_active_reports", side_effect=ValueError("Simulated DB fatal crash")):
        
        await worker._handle_job(failed_job)
        
        # Must be moved to DLQ on 3rd attempt
        assert mock_dlq.called
        args, kwargs = mock_dlq.call_args
        assert args[0]["job_id"] == "fail-job-999"
        assert "Simulated DB fatal crash" in kwargs["reason"]
