"""
Unified search router.

GET  /api/search          — search across all sources
GET  /api/search/{id}     — get single article
POST /api/search/save     — save article to library (alias)
GET  /api/library         — user's saved articles
DELETE /api/library/{id}  — remove from library
"""
from __future__ import annotations

from typing import Annotated

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models import Article, ArticleSource, UserLibrary
from app.routers.articles import (
    ArticleResponse,
    LibraryEntryResponse,
    LibrarySaveRequest,
    OptionalUser,
    PaginatedArticles,
)
from app.routers.auth import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["search"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _live_pubmed_search(query: str, limit: int) -> list[Article]:
    """Run a live PubMed search and return unsaved Article objects."""
    try:
        from app.scrapers.pubmed import search_pubmed
        return await search_pubmed(query, max_results=limit)
    except Exception:
        return []


async def _live_scholar_search(query: str, limit: int) -> list[Article]:
    """Run a live Scholar search and return unsaved Article objects."""
    try:
        from app.scrapers.scholar import search_scholar
        return await search_scholar(query, max_results=limit)
    except Exception:
        return []


def _article_to_response(article: Article) -> ArticleResponse:
    return ArticleResponse(
        id=article.id,
        title=article.title,
        abstract=article.abstract,
        authors=article.authors,
        journal=article.journal,
        year=article.year,
        volume=article.volume,
        issue=article.issue,
        pages=article.pages,
        doi=article.doi,
        pmid=article.pmid,
        url=article.url,
        full_text_url=article.full_text_url,
        source=article.source,
        disease_category=article.disease_category,
        study_type=article.study_type,
        geography=article.geography,
        keywords=article.keywords,
        scraped_at=article.scraped_at,
        indexed_at=article.indexed_at,
    )


# ---------------------------------------------------------------------------
# GET /api/search
# ---------------------------------------------------------------------------

@router.get(
    "/search",
    response_model=PaginatedArticles,
    summary="Unified literature search across all sources",
)
async def unified_search(
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
    q: str | None = Query(None, description="Search query"),
    source: str = Query("all", description="all | pubmed | scholar | idsp | mohfw | local"),
    year_from: int | None = Query(None, ge=1900),
    year_to: int | None = Query(None, le=2100),
    category: str | None = Query(None, description="disease_category filter"),
    study_type: str | None = Query(None),
    geography: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    live: bool = Query(False, description="Trigger live scraping when DB results < 5"),
) -> PaginatedArticles:
    """
    Search across the local database.  When `live=true` and DB returns < 5
    results, a live PubMed/Scholar search is triggered in the background
    and results are returned from the DB on the next call.
    """
    # Build base query
    stmt = select(Article)
    count_stmt = select(func.count()).select_from(Article)

    # Source filter
    source_map: dict[str, ArticleSource] = {
        "pubmed": ArticleSource.PUBMED,
        "scholar": ArticleSource.SCHOLAR,
        "idsp": ArticleSource.IDSP,
        "mohfw": ArticleSource.MOHFW,
    }
    if source in source_map:
        src = source_map[source]
        stmt = stmt.where(Article.source == src)
        count_stmt = count_stmt.where(Article.source == src)

    if year_from is not None:
        stmt = stmt.where(Article.year >= year_from)
        count_stmt = count_stmt.where(Article.year >= year_from)

    if year_to is not None:
        stmt = stmt.where(Article.year <= year_to)
        count_stmt = count_stmt.where(Article.year <= year_to)

    if category:
        stmt = stmt.where(Article.disease_category.ilike(f"%{category}%"))
        count_stmt = count_stmt.where(Article.disease_category.ilike(f"%{category}%"))

    if study_type:
        stmt = stmt.where(Article.study_type.ilike(f"%{study_type}%"))
        count_stmt = count_stmt.where(Article.study_type.ilike(f"%{study_type}%"))

    if geography:
        stmt = stmt.where(Article.geography.ilike(f"%{geography}%"))
        count_stmt = count_stmt.where(Article.geography.ilike(f"%{geography}%"))

    if q:
        tsv = func.to_tsvector(
            "english",
            func.coalesce(Article.title, "") + " " + func.coalesce(Article.abstract, ""),
        )
        tsquery = func.plainto_tsquery("english", q)
        match = tsv.op("@@")(tsquery)
        rank = func.ts_rank_cd(tsv, tsquery)
        stmt = stmt.where(match).order_by(rank.desc())
        count_stmt = count_stmt.where(match)
    else:
        stmt = stmt.order_by(Article.scraped_at.desc())

    total: int = (await db.execute(count_stmt)).scalar_one()
    offset = (page - 1) * per_page
    rows = (await db.execute(stmt.offset(offset).limit(per_page))).scalars().all()

    # Live fallback: trigger background search when results are sparse.
    # _background_ingest opens its own session so it is safe to run after
    # the request-scoped session is closed.
    if live and q and total < 5 and source in ("all", "pubmed"):
        background_tasks.add_task(_background_ingest, q)

    return PaginatedArticles(
        items=list(rows),
        total=total,
        page=page,
        limit=per_page,
        pages=max(1, -(-total // per_page)),
    )


async def _background_ingest(query: str) -> None:
    """Scrape PubMed and persist new articles after the request completes."""
    try:
        from app.scrapers.pubmed import search_pubmed
        articles = await search_pubmed(query, max_results=20)

        # Only ingest articles that have at least one unique identifier;
        # without doi or pmid we cannot reliably detect duplicates.
        identifiable = [a for a in articles if a.doi or a.pmid]
        if not identifiable:
            return

        async with AsyncSessionLocal() as db:
            # Bulk-check existing dois and pmids — 2 queries instead of 2×N.
            candidate_dois  = [a.doi  for a in identifiable if a.doi]
            candidate_pmids = [a.pmid for a in identifiable if a.pmid]

            existing_dois: set[str] = set()
            existing_pmids: set[str] = set()
            if candidate_dois:
                existing_dois = set(
                    (await db.execute(
                        select(Article.doi).where(Article.doi.in_(candidate_dois))
                    )).scalars().all()
                )
            if candidate_pmids:
                existing_pmids = set(
                    (await db.execute(
                        select(Article.pmid).where(Article.pmid.in_(candidate_pmids))
                    )).scalars().all()
                )

            new_count = 0
            for art in identifiable:
                if (art.doi and art.doi in existing_dois) or \
                   (art.pmid and art.pmid in existing_pmids):
                    continue
                db.add(art)
                new_count += 1

            await db.commit()
            logger.info("Background ingest for %r: %d new articles persisted", query, new_count)
    except Exception:
        logger.exception("Background ingest failed for query %r", query)


# ---------------------------------------------------------------------------
# GET /api/search/{article_id}
# ---------------------------------------------------------------------------

@router.get(
    "/search/article/{article_id}",
    response_model=ArticleResponse,
    summary="Get single article by ID",
)
async def get_search_article(
    article_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Article:
    article = await db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


# ---------------------------------------------------------------------------
# POST /api/search/save  — save article to authenticated user's library
# ---------------------------------------------------------------------------

class SaveRequest(BaseModel):
    article_id: int
    notes: str | None = None
    tags: list[str] | None = None


@router.post(
    "/search/save",
    response_model=LibraryEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save an article to the user's library",
)
async def save_article(
    body: SaveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> LibraryEntryResponse:
    if not await db.get(Article, body.article_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    result = await db.execute(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id,
            UserLibrary.article_id == body.article_id,
        )
    )
    entry = result.scalar_one_or_none()

    if entry is None:
        entry = UserLibrary(
            user_id=current_user.id,
            article_id=body.article_id,
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
        article_id=body.article_id,
        notes=entry.notes,
        tags=entry.tags,
        added_at=entry.added_at,
    )


# ---------------------------------------------------------------------------
# GET /api/library
# ---------------------------------------------------------------------------

class LibraryArticle(BaseModel):
    article: ArticleResponse
    notes: str | None
    tags: list[str] | None
    added_at: object  # datetime

    model_config = {"from_attributes": True}


@router.get(
    "/library",
    response_model=list[LibraryArticle],
    summary="Get all articles saved in the user's library",
)
async def get_library(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[LibraryArticle]:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(UserLibrary)
        .where(UserLibrary.user_id == current_user.id)
        .order_by(UserLibrary.added_at.desc())
        .options(selectinload(UserLibrary.article))
    )
    entries = result.scalars().all()

    return [
        LibraryArticle(
            article=_article_to_response(entry.article),
            notes=entry.notes,
            tags=entry.tags,
            added_at=entry.added_at,
        )
        for entry in entries
        if entry.article is not None
    ]


# ---------------------------------------------------------------------------
# DELETE /api/library/{article_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/library/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an article from the user's library",
)
async def delete_from_library(
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
