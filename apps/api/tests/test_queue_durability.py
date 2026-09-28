import pytest
import os
import json
import tempfile
from unittest.mock import patch
from app.core.queue import DurableQueue


@pytest.mark.asyncio
async def test_queue_survives_process_restart():
    """
    Queue Durability Validation:
    When Redis is offline, jobs must persist to a disk-backed write-ahead log (spool)
    so that if the API or Worker process restarts, pending jobs are NOT lost.
    """
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tmp:
        spool_path = tmp.name

    try:
        # 1. API Process 1: Redis is offline, client submits report
        q1 = DurableQueue(spool_file=spool_path)
        with patch.object(q1, "get_redis", side_effect=Exception("Redis node offline")):
            job_id = await q1.enqueue(
                job_type="REPORT_CLUSTER",
                payload={"report_id": "rpt-dur-001", "water_depth": "20_TO_40CM"},
                priority="HIGH"
            )
            assert job_id is not None

        # Verify job was written to persistent disk spool
        assert os.path.exists(spool_path)
        with open(spool_path, "r", encoding="utf-8") as f:
            lines = [json.loads(line) for line in f if line.strip()]
        assert len(lines) == 1
        assert lines[0]["job_id"] == job_id
        assert lines[0]["job_type"] == "REPORT_CLUSTER"

        # 2. Process Crash / Restart: Simulate new container/worker boot
        # q2 represents the new process starting up from clean memory
        q2 = DurableQueue(spool_file=spool_path)
        # Should have restored 1 pending job from disk spool
        assert len(q2._in_memory_queue) == 1

        # 3. Worker dequeues and processes the job
        with patch.object(q2, "get_redis", side_effect=Exception("Redis still offline")):
            dequeued = await q2.dequeue()
            assert dequeued is not None
            assert dequeued["job_id"] == job_id
            assert dequeued["payload"]["report_id"] == "rpt-dur-001"
            assert dequeued["acknowledged"] is True

            # Next dequeue is empty
            assert await q2.dequeue() is None

    finally:
        if os.path.exists(spool_path):
            os.remove(spool_path)


@pytest.mark.asyncio
async def test_queue_dlq_routing_and_attributes():
    """
    Queue Durability Validation:
    Poison messages that fail repeatedly must be routed to DLQ with failure metadata.
    """
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tmp:
        spool_path = tmp.name

    try:
        q = DurableQueue(spool_file=spool_path)
        poison_job = {
            "job_id": "job-poison-999",
            "job_type": "AI_INFERENCE",
            "payload": {"image_url": "corrupt_data"}
        }
        await q.move_to_dlq(poison_job, reason="Corrupt image bytes - unparseable magic bytes")

        assert "failed_at" in poison_job
        assert poison_job["failure_reason"] == "Corrupt image bytes - unparseable magic bytes"
    finally:
        if os.path.exists(spool_path):
            os.remove(spool_path)
