import json
import logging
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """
    Standardized CloudWatch / Datadog-compliant Structured JSON Log Formatter.
    Fields: timestamp, service, level, event, request_id, source, error.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "kmitl-flood-api",
            "level": record.levelname,
            "event": getattr(record, "event", record.getMessage()),
            "logger": record.name,
            "request_id": getattr(record, "request_id", None),
            "source": getattr(record, "source", None),
        }
        if record.exc_info:
            log_record["error"] = self.formatException(record.exc_info)
        return json.dumps(log_record)


def setup_structured_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers = [handler]
