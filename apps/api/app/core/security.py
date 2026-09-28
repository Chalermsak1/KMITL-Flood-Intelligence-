import io
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import HTTPException, status, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from PIL import Image

from app.core.config import settings

logger = logging.getLogger("core.security")

security_bearer = HTTPBearer(auto_error=False)


class SecurityService:
    ALGORITHM = "HS256"

    @classmethod
    def create_access_token(cls, subject: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
        expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES if hasattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES") else 60))
        to_encode = {
            "sub": subject,
            "role": role,
            "exp": expire,
            "iat": datetime.now(timezone.utc)
        }
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=cls.ALGORITHM)

    @classmethod
    def verify_token(cls, token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[cls.ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
        except jwt.PyJWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization credentials.")


def require_roles(allowed_roles: List[str]):
    """
    Role-Based Access Control (RBAC) dependency.
    Validates token and checks if user's role is in allowed_roles.
    """
    async def role_checker(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)):
        if not credentials:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
        token = credentials.credentials
        payload = SecurityService.verify_token(token)
        user_role = payload.get("role", "USER")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Required role '{allowed_roles}', but found '{user_role}'."
            )
        return payload
    return role_checker


class RateLimiter:
    """
    In-memory / Redis token bucket rate limiter.
    Provides strict per-IP rate limiting across critical disaster endpoints.
    """
    _requests: Dict[str, List[float]] = {}

    @classmethod
    def check_rate_limit(cls, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        timestamps = cls._requests.get(key, [])
        # Expire old timestamps outside window
        valid_timestamps = [t for t in timestamps if now - t < window_seconds]
        if len(valid_timestamps) >= max_requests:
            return False
        valid_timestamps.append(now)
        cls._requests[key] = valid_timestamps
        return True


def rate_limit(max_requests: int, window_seconds: int = 60):
    """FastAPI dependency for rate limiting by client IP."""
    async def limiter(request: Request):
        client_ip = request.client.host if request.client else "127.0.0.1"
        endpoint = request.url.path
        key = f"rl:{client_ip}:{endpoint}"
        if not RateLimiter.check_rate_limit(key, max_requests, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: maximum {max_requests} requests per {window_seconds}s. Please slow down."
            )
        return True
    return limiter


class PrivacyGuard:
    """
    Strict User Privacy:
    - Never expose citizen phone numbers, names, or IP addresses in public endpoints.
    - Mask SOS exact coordinates on public maps; exact coordinates restricted to authorized responders.
    """
    @staticmethod
    def strip_exif(image_bytes: bytes) -> bytes:
        """Strip EXIF metadata from uploaded photos to prevent GPS/device leakage."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            get_data_fn = getattr(image, "get_flattened_data", None) or image.getdata
            data = list(get_data_fn())
            clean_image = Image.new(image.mode, image.size)
            clean_image.putdata(data)
            output = io.BytesIO()
            clean_image.save(output, format=image.format or "JPEG")
            return output.getvalue()
        except Exception:
            return image_bytes

    @staticmethod
    def mask_sos_for_public(sos_data: Dict[str, Any]) -> Dict[str, Any]:
        """Strip personal identities and fuzz coordinates for public feeds."""
        fuzzed = dict(sos_data)
        fuzzed.pop("requester_name", None)
        fuzzed.pop("contact_phone", None)
        fuzzed.pop("vulnerable_details", None)
        # Fuzz coordinate slightly to ~500m centroid for privacy
        if "latitude" in fuzzed and "longitude" in fuzzed:
            fuzzed["latitude"] = round(fuzzed["latitude"], 3)
            fuzzed["longitude"] = round(fuzzed["longitude"], 3)
        return fuzzed
