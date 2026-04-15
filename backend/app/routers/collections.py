"""
Collections & Tags router.

Collections are named folders of articles owned by a user.
Tags are user-owned labels that can be applied to articles.

Collections
-----------
GET    /api/collections                         — list user's collections
POST   /api/collections                         — create collection
GET    /api/collections/{id}                    — get collection (with articles)
PUT    /api/collections/{id}                    — rename / toggle public
DELETE /api/collections/{id}                    — delete collection
POST   /api/collections/{id}/articles           — add article to collection
DELETE /api/collections/{id}/articles/{art_id} — remove article

Tags
----
GET    /api/tags                                — list user's tags
POST   /api/tags                                — create tag
PUT    /api/tags/{id}                           — rename / change colour
DELETE /api/tags/{id}                           — delete tag (removes PaperTag rows)
POST   /api/tags/{id}/articles/{art_id}         — tag an article
DELETE /api/tags/{id}/articles/{art_id}         — untag an article
GET    /api/tags/{id}/articles                  — list articles with this tag
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Article, Collection, CollectionPaper, PaperTag, Tag
from app.routers.articles import ArticleResponse
from app.routers.auth import CurrentUser

router = APIRouter(prefix="/api", tags=["collections", "tags"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: str | None = None
    is_public: bool = False


class CollectionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=256)
    description: str | None = None
    is_public: bool | None = None


class CollectionSummary(BaseModel):
    id: int
    name: str
    description: str | None
    is_public: bool
    article_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CollectionDetail(CollectionSummary):
    articles: list[ArticleResponse]


class AddArticleRequest(BaseModel):
    article_id: int
    position: int | None = None


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TagResponse(BaseModel):
    id: int
    name: str
    color: str | None
    article_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# ── COLLECTIONS ──────────────────────────────────────────────────────────────
# ---------------------------------------------------------------------------

@router.get("/collections", response_model=list[CollectionSummary])
async def list_collections(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[CollectionSummary]:
    result = await db.execute(
        select(Collection)
        .where(Collection.user_id == current_user.id)
        .order_by(Collection.updated_at.desc())
        .options(selectinload(Collection.collection_papers))
    )
    collections = result.scalars().all()
    return [
        CollectionSummary(
            id=c.id,
            name=c.name,
            description=c.description,
            is_public=c.is_public,
            article_count=len(c.collection_papers),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in collections
    ]


@router.post("/collections", response_model=CollectionSummary, status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> CollectionSummary:
    collection = Collection(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        is_public=body.is_public,
    )
    db.add(collection)
    await db.flush()
    return CollectionSummary(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        article_count=0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.get("/collections/{collection_id}", response_model=CollectionDetail)
async def get_collection(
    collection_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> CollectionDetail:
    result = await db.execute(
        select(Collection)
        .where(Collection.id == collection_id)
        .options(
            selectinload(Collection.collection_papers)
            .selectinload(CollectionPaper.article)
        )
    )
    collection = result.scalar_one_or_none()
    if collection is None or (
        collection.user_id != current_user.id and not collection.is_public
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    articles = [
        ArticleResponse.model_validate(cp.article)
        for cp in sorted(collection.collection_papers, key=lambda cp: cp.position)
        if cp.article is not None
    ]
    return CollectionDetail(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        article_count=len(articles),
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        articles=articles,
    )


@router.put("/collections/{collection_id}", response_model=CollectionSummary)
async def update_collection(
    collection_id: int,
    body: CollectionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> CollectionSummary:
    result = await db.execute(
        select(Collection)
        .where(Collection.id == collection_id)
        .options(selectinload(Collection.collection_papers))
    )
    collection = result.scalar_one_or_none()
    if collection is None or collection.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    if body.name is not None:
        collection.name = body.name
    if body.description is not None:
        collection.description = body.description
    if body.is_public is not None:
        collection.is_public = body.is_public

    return CollectionSummary(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        article_count=len(collection.collection_papers),
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> None:
    collection = await db.get(Collection, collection_id)
    if collection is None or collection.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    await db.delete(collection)


@router.post(
    "/collections/{collection_id}/articles",
    status_code=status.HTTP_201_CREATED,
    response_model=dict,
)
async def add_article_to_collection(
    collection_id: int,
    body: AddArticleRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> dict:
    collection = await db.get(Collection, collection_id)
    if collection is None or collection.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    article = await db.get(Article, body.article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    # Idempotent — do nothing if already present
    existing = (await db.execute(
        select(CollectionPaper).where(
            CollectionPaper.collection_id == collection_id,
            CollectionPaper.article_id == body.article_id,
        )
    )).scalar_one_or_none()
    if existing:
        return {"collection_id": collection_id, "article_id": body.article_id, "added": False}

    # Assign next position if not specified
    if body.position is None:
        count_result = await db.execute(
            select(CollectionPaper).where(CollectionPaper.collection_id == collection_id)
        )
        position = len(count_result.scalars().all())
    else:
        position = body.position

    cp = CollectionPaper(
        collection_id=collection_id,
        article_id=body.article_id,
        position=position,
    )
    db.add(cp)
    return {"collection_id": collection_id, "article_id": body.article_id, "added": True}


@router.delete(
    "/collections/{collection_id}/articles/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_article_from_collection(
    collection_id: int,
    article_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> None:
    collection = await db.get(Collection, collection_id)
    if collection is None or collection.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    cp = (await db.execute(
        select(CollectionPaper).where(
            CollectionPaper.collection_id == collection_id,
            CollectionPaper.article_id == article_id,
        )
    )).scalar_one_or_none()
    if cp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not in collection")
    await db.delete(cp)


# ---------------------------------------------------------------------------
# ── TAGS ─────────────────────────────────────────────────────────────────────
# ---------------------------------------------------------------------------

async def _get_owned_tag(tag_id: int, user_id: int, db: AsyncSession) -> Tag:
    """Fetch a tag and assert ownership; raises 404 otherwise."""
    tag = await db.get(Tag, tag_id)
    if tag is None or tag.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    return tag


@router.get("/tags", response_model=list[TagResponse])
async def list_tags(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[TagResponse]:
    result = await db.execute(
        select(Tag)
        .where(Tag.user_id == current_user.id)
        .order_by(Tag.name)
        .options(selectinload(Tag.paper_tags))
    )
    tags = result.scalars().all()
    return [
        TagResponse(
            id=t.id,
            name=t.name,
            color=t.color,
            article_count=len(t.paper_tags),
            created_at=t.created_at,
        )
        for t in tags
    ]


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    body: TagCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> TagResponse:
    # Enforce unique name per user (the DB has a UniqueConstraint too, but surface it cleanly)
    clash = (await db.execute(
        select(Tag).where(Tag.user_id == current_user.id, Tag.name == body.name)
    )).scalar_one_or_none()
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag '{body.name}' already exists",
        )

    tag = Tag(user_id=current_user.id, name=body.name, color=body.color)
    db.add(tag)
    await db.flush()
    return TagResponse(id=tag.id, name=tag.name, color=tag.color, article_count=0, created_at=tag.created_at)


@router.put("/tags/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: int,
    body: TagUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> TagResponse:
    result = await db.execute(
        select(Tag)
        .where(Tag.id == tag_id)
        .options(selectinload(Tag.paper_tags))
    )
    tag = result.scalar_one_or_none()
    if tag is None or tag.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    if body.name is not None:
        tag.name = body.name
    if body.color is not None:
        tag.color = body.color

    return TagResponse(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        article_count=len(tag.paper_tags),
        created_at=tag.created_at,
    )


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> None:
    tag = await _get_owned_tag(tag_id, current_user.id, db)
    await db.delete(tag)   # cascade deletes PaperTag rows


@router.post("/tags/{tag_id}/articles/{article_id}", status_code=status.HTTP_201_CREATED, response_model=dict)
async def tag_article(
    tag_id: int,
    article_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> dict:
    tag = await _get_owned_tag(tag_id, current_user.id, db)

    article = await db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    existing = (await db.execute(
        select(PaperTag).where(PaperTag.tag_id == tag_id, PaperTag.article_id == article_id)
    )).scalar_one_or_none()
    if existing:
        return {"tag_id": tag_id, "article_id": article_id, "added": False}

    db.add(PaperTag(tag_id=tag_id, article_id=article_id))
    return {"tag_id": tag_id, "article_id": article_id, "added": True}


@router.delete("/tags/{tag_id}/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def untag_article(
    tag_id: int,
    article_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> None:
    await _get_owned_tag(tag_id, current_user.id, db)

    pt = (await db.execute(
        select(PaperTag).where(PaperTag.tag_id == tag_id, PaperTag.article_id == article_id)
    )).scalar_one_or_none()
    if pt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article does not have this tag")
    await db.delete(pt)


@router.get("/tags/{tag_id}/articles", response_model=list[ArticleResponse])
async def list_tagged_articles(
    tag_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[ArticleResponse]:
    tag = await _get_owned_tag(tag_id, current_user.id, db)

    result = await db.execute(
        select(Article)
        .join(PaperTag, PaperTag.article_id == Article.id)
        .where(PaperTag.tag_id == tag_id)
        .order_by(Article.scraped_at.desc())
    )
    articles = result.scalars().all()
    return [ArticleResponse.model_validate(a) for a in articles]
