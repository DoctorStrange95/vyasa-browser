"""Alembic environment — async SQLAlchemy (asyncpg) edition.

DATABASE_URL is read from the environment (same variable the app uses).
The url must use the asyncpg driver scheme:
  postgresql+asyncpg://user:pass@host/dbname

Running migrations:
  alembic upgrade head                               # apply all pending
  alembic revision --autogenerate -m "description"  # generate new migration
  alembic downgrade -1                               # roll back one step
"""
from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Load .env so DATABASE_URL is available when running alembic from the CLI
load_dotenv()

# ---------------------------------------------------------------------------
# Alembic config
# ---------------------------------------------------------------------------

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import app metadata so autogenerate can diff against actual models
from app.models import Base  # noqa: E402

target_metadata = Base.metadata

# Override the placeholder sqlalchemy.url with the real DATABASE_URL
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])


# ---------------------------------------------------------------------------
# Offline mode (generates SQL script without connecting)
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode (connects and applies migrations)
# ---------------------------------------------------------------------------

def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
