from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.models import Base  # re-export Base so alembic/scripts can import from here

load_dotenv()

# ---------------------------------------------------------------------------
# Database URL
# ---------------------------------------------------------------------------
# Must use the asyncpg driver scheme:
#   postgresql+asyncpg://user:pass@host/dbname
# ---------------------------------------------------------------------------

DATABASE_URL: str = os.environ["DATABASE_URL"]

if not (DATABASE_URL.startswith("postgresql+asyncpg://") or DATABASE_URL.startswith("sqlite+aiosqlite://")):
    raise ValueError(
        "DATABASE_URL must use asyncpg driver for PostgreSQL or aiosqlite driver for SQLite "
        f"Got: {DATABASE_URL!r}"
    )

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
# pool_size      — baseline connections kept open (tune per deployment)
# max_overflow   — extra connections allowed above pool_size under load
# pool_timeout   — seconds to wait for a connection before raising
# pool_recycle   — recycle connections after N seconds (avoids stale TCP)
# pool_pre_ping  — send a lightweight ping before each checkout to detect
#                  dropped connections (important for long-idle services)
# ---------------------------------------------------------------------------

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
    pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "10")),
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
    pool_pre_ping=True,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
# expire_on_commit=False keeps ORM objects usable after the session commits,
# which is essential for async handlers that return models to Pydantic schemas.
# ---------------------------------------------------------------------------

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an AsyncSession, rolling back on error and always closing."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Table initialisation (dev / testing only)
# ---------------------------------------------------------------------------
# In production, schema changes are managed by Alembic migrations.
# Call init_db() from a startup script or test fixture to create tables
# that don't exist yet without touching existing ones.
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Create all tables defined in Base.metadata (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db() -> None:
    """Drop all tables — for test teardown only, never run in production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
