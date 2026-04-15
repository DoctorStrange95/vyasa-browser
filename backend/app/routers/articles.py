from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Article, ArticleSource, UserLibrary
from app.routers.auth import CurrentUser, get_current_user, _oauth2_scheme

# ---------------------------------------------------------------------------
# Optional-auth dependency
# Returns the current User if a valid Bearer token is present, else None.
# Used on public endpoints that show personalised data when logged in.
# ---------------------------------------------------------------------------

from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select as sa_select


async def get_optional_user(
    token: Annotated[str | None, Depends(
        OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
    )],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if token is None:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None


OptionalUser = Annotated[object, Depends(get_optional_user)]

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ArticleResponse(BaseModel):
    id: int
    title: str
    abstract: str | None
    authors: list[str] | None
    journal: str | None
    year: int | None
    volume: str | None
    issue: str | None
    pages: str | None
    doi: str | None
    pmid: str | None
    url: str | None
    full_text_url: str | None
    source: ArticleSource
    disease_category: str | None
    study_type: str | None
    geography: str | None
    keywords: list[str] | None
    scraped_at: datetime
    indexed_at: datetime | None

    model_config = {"from_attributes": True}


class PaginatedArticles(BaseModel):
    items: list[ArticleResponse]
    total: int
    page: int
    limit: int
    pages: int


class ArticleCreate(BaseModel):
    title: str
    abstract: str | None = None
    authors: list[str] | None = None
    journal: str | None = None
    year: int | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    doi: str | None = None
    pmid: str | None = None
    url: str | None = None
    full_text_url: str | None = None
    source: ArticleSource
    disease_category: str | None = None
    study_type: str | None = None
    geography: str | None = None
    keywords: list[str] | None = None


class LibrarySaveRequest(BaseModel):
    notes: str | None = None
    tags: list[str] | None = None


class LibraryEntryResponse(BaseModel):
    saved: bool
    article_id: int
    notes: str | None = None
    tags: list[str] | None = None
    added_at: datetime | None = None


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/articles", tags=["articles"])


# ------------------------------------------------------------------
# GET /articles
# Publicly browsable. Full-text search via PostgreSQL tsvector.
# Elasticsearch integration point: replace the FTS block below with
# an ES query and map result IDs back to ORM rows for a consistent
# response shape.
# ------------------------------------------------------------------

@router.get(
    "",
    response_model=PaginatedArticles,
    summary="List and search articles with optional filters",
)
async def list_articles(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str | None = Query(None, description="Full-text search across title and abstract"),
    source: ArticleSource | None = Query(None, description="Filter by data source"),
    year_min: int | None = Query(None, ge=1900),
    year_max: int | None = Query(None, le=2100),
    disease_category: str | None = Query(None),
    study_type: str | None = Query(None),
    geography: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedArticles:

    stmt = select(Article)
    count_stmt = select(func.count()).select_from(Article)

    # --- filters ---
    if source is not None:
        stmt = stmt.where(Article.source == source)
        count_stmt = count_stmt.where(Article.source == source)

    if year_min is not None:
        stmt = stmt.where(Article.year >= year_min)
        count_stmt = count_stmt.where(Article.year >= year_min)

    if year_max is not None:
        stmt = stmt.where(Article.year <= year_max)
        count_stmt = count_stmt.where(Article.year <= year_max)

    if disease_category:
        stmt = stmt.where(Article.disease_category.ilike(f"%{disease_category}%"))
        count_stmt = count_stmt.where(Article.disease_category.ilike(f"%{disease_category}%"))

    if study_type:
        stmt = stmt.where(Article.study_type.ilike(f"%{study_type}%"))
        count_stmt = count_stmt.where(Article.study_type.ilike(f"%{study_type}%"))

    if geography:
        stmt = stmt.where(Article.geography.ilike(f"%{geography}%"))
        count_stmt = count_stmt.where(Article.geography.ilike(f"%{geography}%"))

    # --- full-text search ---
    # PostgreSQL plainto_tsquery handles multi-word phrases and stopwords
    # without needing the caller to supply boolean operators.
    # A GIN index on to_tsvector(title || abstract) should be added via
    # Alembic migration for production performance.
    if q:
        tsv = func.to_tsvector(
            "english",
            func.coalesce(Article.title, "")
            + " "
            + func.coalesce(Article.abstract, ""),
        )
        tsquery = func.plainto_tsquery("english", q)
        match = tsv.op("@@")(tsquery)
        rank = func.ts_rank_cd(tsv, tsquery)

        stmt = stmt.where(match).order_by(rank.desc())
        count_stmt = count_stmt.where(match)
    else:
        stmt = stmt.order_by(Article.scraped_at.desc())

    # --- pagination ---
    total: int = (await db.execute(count_stmt)).scalar_one()
    offset = (page - 1) * limit
    rows = (await db.execute(stmt.offset(offset).limit(limit))).scalars().all()

    return PaginatedArticles(
        items=rows,
        total=total,
        page=page,
        limit=limit,
        pages=max(1, -(-total // limit)),  # ceiling division
    )


# ------------------------------------------------------------------
# GET /articles/{id}
# ------------------------------------------------------------------

@router.get(
    "/{article_id}",
    response_model=ArticleResponse,
    summary="Get a single article by ID",
)
async def get_article(
    article_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Article:
    article = await db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


# ------------------------------------------------------------------
# POST /articles
# Intended for scraper workers and admin tooling, not end-user UI.
# Enforces uniqueness on (doi, pmid) before inserting.
# ------------------------------------------------------------------

@router.post(
    "",
    response_model=ArticleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a new article (scraper / admin)",
)
async def create_article(
    body: ArticleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> Article:
    from app.models import UserRole

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    # Deduplicate on DOI or PMID if provided
    if body.doi:
        clash = await db.execute(select(Article).where(Article.doi == body.doi))
        if clash.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Article with DOI {body.doi!r} already exists",
            )
    if body.pmid:
        clash = await db.execute(select(Article).where(Article.pmid == body.pmid))
        if clash.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Article with PMID {body.pmid!r} already exists",
            )

    article = Article(**body.model_dump())
    db.add(article)
    await db.flush()
    return article


# ------------------------------------------------------------------
# POST /articles/{id}/library   — save article to user's library
# ------------------------------------------------------------------

@router.post(
    "/{article_id}/library",
    response_model=LibraryEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save an article to the authenticated user's library",
)
async def save_to_library(
    article_id: int,
    body: LibrarySaveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> LibraryEntryResponse:
    # Confirm article exists
    if not await db.get(Article, article_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    # Idempotent: update notes/tags if entry already exists
    result = await db.execute(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id,
            UserLibrary.article_id == article_id,
        )
    )
    entry = result.scalar_one_or_none()

    if entry is None:
        entry = UserLibrary(
            user_id=current_user.id,
            article_id=article_id,
            notes=body.notes,
            tags=body.tags,
        )
        db.add(entry)
        await db.flush()
    else:
        if body.notes is not None:
            entry.notes = body.notes
        if body.tags is not None:
            entry.tags = body.tags

    return LibraryEntryResponse(
        saved=True,
        article_id=article_id,
        notes=entry.notes,
        tags=entry.tags,
        added_at=entry.added_at,
    )


# ------------------------------------------------------------------
# DELETE /articles/{id}/library — remove article from library
# ------------------------------------------------------------------

@router.delete(
    "/{article_id}/library",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an article from the authenticated user's library",
)
async def remove_from_library(
    article_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> None:
    result = await db.execute(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id,
            UserLibrary.article_id == article_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article is not in your library",
        )
    await db.delete(entry)


# ------------------------------------------------------------------
# GET /articles/{id}/library — check library status for one article
# ------------------------------------------------------------------

@router.get(
    "/{article_id}/library",
    response_model=LibraryEntryResponse,
    summary="Check whether an article is saved in the user's library",
)
async def get_library_status(
    article_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> LibraryEntryResponse:
    result = await db.execute(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id,
            UserLibrary.article_id == article_id,
        )
    )
    entry = result.scalar_one_or_none()

    if entry is None:
        return LibraryEntryResponse(saved=False, article_id=article_id)

    return LibraryEntryResponse(
        saved=True,
        article_id=article_id,
        notes=entry.notes,
        tags=entry.tags,
        added_at=entry.added_at,
    )
