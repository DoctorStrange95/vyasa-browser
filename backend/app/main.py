from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.database import engine
from app.routers import auth, articles
from app.routers import search, papers, analysis, collections, burden, citations, pdfs

load_dotenv()

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic in production.
    # In development, set DB_AUTO_CREATE=true to create tables on startup.
    if os.getenv("DB_AUTO_CREATE", "false").lower() == "true":
        try:
            from app.database import init_db
            await init_db()
            print("[INFO] Database tables initialized")
        except Exception as e:
            print(f"[WARNING] Failed to initialize DB tables: {e}")
    yield
    try:
        await engine.dispose()
    except Exception as e:
        print(f"[WARNING] Error disposing engine: {e}")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="HealthScholar API",
    description=(
        "Health research platform — literature search across PubMed, Google Scholar, "
        "IDSP, MoHFW, and NHM; statistical analysis; collaborative paper writing; "
        "and DOI minting via Zenodo."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# CORS_ORIGINS is a comma-separated list of allowed origins.
# Default allows the local Vite dev server.
# ---------------------------------------------------------------------------

_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(ValidationError)
async def pydantic_validation_handler(request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log here when a logging framework is wired up
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred"},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(search.router)
app.include_router(papers.router)
app.include_router(analysis.router)
app.include_router(collections.router)
app.include_router(burden.router)
app.include_router(citations.router)
app.include_router(pdfs.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"], summary="Service liveness probe")
async def health() -> dict:
    return {"status": "ok", "version": app.version}
