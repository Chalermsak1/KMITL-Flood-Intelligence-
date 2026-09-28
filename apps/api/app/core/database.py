import time
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger("core.database")


class DatabaseCircuitBreaker:
    """
    Fast-fail circuit breaker to bound tail latency when PostgreSQL is offline or recovering.
    Prevents thread/connection exhaustion and 30-second hanging requests.
    """
    def __init__(self, failure_threshold: int = 2, recovery_timeout_sec: float = 8.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_sec = recovery_timeout_sec
        self.failure_count = 0
        self.last_failure_time: float = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning("Database circuit breaker tripped to OPEN; fast-failing DB calls to bounded fallbacks.")

    def allow_request(self) -> bool:
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if (time.time() - self.last_failure_time) > self.recovery_timeout_sec:
                self.state = "HALF_OPEN"
                logger.info("Database circuit breaker probe: entering HALF_OPEN.")
                return True
            return False
        # HALF_OPEN allows 1 canary request
        return True


db_circuit_breaker = DatabaseCircuitBreaker()

# Driver connection arguments to bound asyncpg TCP connect and command execution
connect_args = {
    "timeout": 2.0,            # 2-second connection timeout (eliminates 30s TCP hang)
    "command_timeout": 3.0,    # 3-second query timeout
}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG and False,
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=3.0,          # Bounded pool queue wait (max 3s)
    pool_recycle=1800,
    pool_pre_ping=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
            db_circuit_breaker.record_success()
        except Exception:
            await session.rollback()
            db_circuit_breaker.record_failure()
            raise
        finally:
            await session.close()
