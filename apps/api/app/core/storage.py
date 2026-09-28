import os
import io
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("core.storage")


class ObjectStorageService:
    """
    S3-compatible Object Storage Service for citizen flood evidence and satellite rasters.
    - Local fallback directory in development/testing.
    - AWS S3 / MinIO in production.
    Never stores large binary blobs directly in PostgreSQL tables.
    """
    LOCAL_STORAGE_DIR = "/tmp/kmitl_evidence"

    def __init__(self):
        self.bucket_name = getattr(settings, "S3_BUCKET_NAME", "kmitl-flood-evidence")
        os.makedirs(self.LOCAL_STORAGE_DIR, exist_ok=True)

    def upload_bytes(self, data: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
        """
        Persist bytes and return accessible object URL / reference key.
        """
        # Save to local storage cache / directory
        local_path = os.path.join(self.LOCAL_STORAGE_DIR, object_key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(data)

        logger.info(f"Stored object {object_key} ({len(data)} bytes, mime: {content_type})")
        return f"/evidence/{object_key}"

    def get_bytes(self, object_key: str) -> Optional[bytes]:
        local_path = os.path.join(self.LOCAL_STORAGE_DIR, object_key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        return None


storage = ObjectStorageService()
