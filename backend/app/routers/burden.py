"""
Disease Burden router.

GET  /api/burden/diseases           — list diseases we have records for
GET  /api/burden/search             — query burden records (disease, country, state, year range, metric)
GET  /api/burden/metrics            — list metrics available for a disease
GET  /api/burden/research-gap       — burden vs research volume comparison
POST /api/burden/contextual         — burden stats relevant to a paper (by paper_id or free text)
POST /api/burden/refresh            — trigger live re-scrape from WHO GHO / IHME / India sources
GET  /api/burden/states             — list states with burden data
"""
from __future__ import annotations

import logging
import os
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Article, BurdenRecord, BurdenSource, Paper
from app.routers.auth import CurrentUser

router = APIRouter(prefix="/api/burden", tags=["burden"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BurdenRecordOut(BaseModel):
    id: int
    disease: str
    metric: str
    country_code: str | None
    state: str | None
    year: int
    value: float | None
    lower_ci: float | None
    upper_ci: float | None
    unit: str | None
    age_group: str | None
    sex: str | None
    source: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_ext(cls, rec: BurdenRecord) -> "BurdenRecordOut":
        return cls(
            id=rec.id,
            disease=rec.disease,
            metric=rec.metric,
            country_code=rec.country_code,
            state=rec.state,
            year=rec.year,
            value=rec.value,
            lower_ci=rec.lower_ci,
            upper_ci=rec.upper_ci,
            unit=rec.unit,
            age_group=rec.age_group,
            sex=rec.sex,
            source=rec.source.value if rec.source else "",
        )


class ResearchGapOut(BaseModel):
    disease: str
    burden_records: int
    latest_daly_rate: float | None
    latest_deaths: float | None
    pubmed_articles: int
    scholar_articles: int
    total_research: int
    gap_score: float
    gap_label: str


class ContextualBurdenOut(BaseModel):
    disease: str
    stats: list[BurdenRecordOut]
    summary: str


# ---------------------------------------------------------------------------
# Background re-scrape task
# ---------------------------------------------------------------------------

async def _do_refresh(db: AsyncSession) -> None:
    """Pull fresh data from all burden sources and upsert into DB."""
    from app.scrapers.who_gho import fetch_who_burden
    from app.scrapers.ihme_gbd import fetch_gbd_burden
    from app.scrapers.india_burden import fetch_india_burden

    ogd_key = os.getenv("OGD_API_KEY")

    try:
        who_recs = await fetch_who_burden()
        gbd_recs = await fetch_gbd_burden()
        india_recs = await fetch_india_burden(ogd_api_key=ogd_key)
    except Exception as exc:
        logger.error("Burden refresh failed: %s", exc)
        return

    all_records = who_recs + gbd_recs + india_recs

    # Simple upsert strategy: delete existing records from same source then re-insert.
    # For a production system, use ON CONFLICT upsert via raw SQL.
    sources_seen: set[BurdenSource] = {r.source for r in all_records}
    for src in sources_seen:
        await db.execute(
            # SQLAlchemy delete expression
            BurdenRecord.__table__.delete().where(BurdenRecord.source == src)  # type: ignore[attr-defined]
        )

    for rec in all_records:
        db.add(rec)

    await db.commit()
    logger.info("Burden refresh complete: %d records upserted", len(all_records))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/diseases")
async def list_diseases(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[str]:
    """Return sorted list of disease names present in the burden database."""
    result = await db.execute(
        select(distinct(BurdenRecord.disease)).order_by(BurdenRecord.disease)
    )
    return [row[0] for row in result.all()]


@router.get("/states")
async def list_states(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[str]:
    """Return sorted list of Indian states that have burden data."""
    result = await db.execute(
        select(distinct(BurdenRecord.state))
        .where(BurdenRecord.state.isnot(None))
        .order_by(BurdenRecord.state)
    )
    return [row[0] for row in result.all()]


@router.get("/metrics")
async def list_metrics(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
    disease: str = Query(..., description="Disease name to filter metrics for"),
) -> list[str]:
    result = await db.execute(
        select(distinct(BurdenRecord.metric))
        .where(BurdenRecord.disease.ilike(f"%{disease}%"))
        .order_by(BurdenRecord.metric)
    )
    return [row[0] for row in result.all()]


@router.get("/search", response_model=list[BurdenRecordOut])
async def search_burden(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
    disease: str | None = Query(None, description="Disease name (partial match)"),
    metric: str | None = Query(None, description="Metric name (partial match)"),
    country_code: str | None = Query(None, description="ISO-3 country code, e.g. IND"),
    state: str | None = Query(None, description="Indian state name (partial match)"),
    year_from: int | None = Query(None),
    year_to: int | None = Query(None),
    source: str | None = Query(None, description="who_gho | ihme_gbd | icmr | nfhs"),
    sex: str | None = Query(None, description="both | male | female"),
    limit: int = Query(100, le=500),
) -> list[BurdenRecordOut]:
    q = select(BurdenRecord).order_by(BurdenRecord.year.desc(), BurdenRecord.disease)

    if disease:
        q = q.where(BurdenRecord.disease.ilike(f"%{disease}%"))
    if metric:
        q = q.where(BurdenRecord.metric.ilike(f"%{metric}%"))
    if country_code:
        q = q.where(BurdenRecord.country_code == country_code.upper())
    if state:
        q = q.where(BurdenRecord.state.ilike(f"%{state}%"))
    if year_from:
        q = q.where(BurdenRecord.year >= year_from)
    if year_to:
        q = q.where(BurdenRecord.year <= year_to)
    if source:
        try:
            src_enum = BurdenSource(source)
            q = q.where(BurdenRecord.source == src_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown source: {source}")
    if sex:
        q = q.where(BurdenRecord.sex == sex)

    q = q.limit(limit)
    result = await db.execute(q)
    recs = result.scalars().all()
    return [BurdenRecordOut.from_orm_ext(r) for r in recs]


@router.get("/research-gap", response_model=list[ResearchGapOut])
async def research_gap(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
    country_code: str = Query("IND"),
    year: int = Query(2022),
) -> list[ResearchGapOut]:
    """
    For each disease in the burden database, compare the burden magnitude
    against the volume of research literature.  Returns a ranked list with
    a gap_score where higher = more under-researched relative to burden.
    """
    # Burden: distinct diseases with latest values
    burden_result = await db.execute(
        select(BurdenRecord.disease, BurdenRecord.metric, BurdenRecord.value)
        .where(BurdenRecord.country_code == country_code)
        .where(BurdenRecord.year == year)
    )
    burden_rows = burden_result.all()

    # Build disease → {metric: value} map
    disease_data: dict[str, dict[str, float | None]] = {}
    for disease, metric, value in burden_rows:
        if disease not in disease_data:
            disease_data[disease] = {"records": 0, "daly_rate": None, "deaths": None}
        disease_data[disease]["records"] = disease_data[disease].get("records", 0) + 1
        if value is not None:
            if "daly" in metric.lower():
                disease_data[disease]["daly_rate"] = value
            if "death" in metric.lower() and "risk" not in metric.lower():
                disease_data[disease]["deaths"] = value

    # Research volume from articles table
    article_result = await db.execute(
        select(Article.disease_category, Article.source, func.count().label("cnt"))
        .where(Article.disease_category.isnot(None))
        .group_by(Article.disease_category, Article.source)
    )
    research_rows = article_result.all()

    research_map: dict[str, dict[str, int]] = {}
    for disease_cat, source, cnt in research_rows:
        if disease_cat not in research_map:
            research_map[disease_cat] = {"pubmed": 0, "scholar": 0}
        src_val = source.value if hasattr(source, "value") else str(source)
        if "pubmed" in src_val.lower():
            research_map[disease_cat]["pubmed"] += cnt
        elif "scholar" in src_val.lower():
            research_map[disease_cat]["scholar"] += cnt

    # Compute gap scores
    gaps: list[ResearchGapOut] = []
    for disease, data in disease_data.items():
        pub = research_map.get(disease, {}).get("pubmed", 0)
        sch = research_map.get(disease, {}).get("scholar", 0)
        total_research = pub + sch

        daly = data.get("daly_rate") or 0.0
        deaths_val = data.get("deaths") or 0.0

        # Gap score: normalise burden by research volume
        # High burden + low research = high gap
        burden_proxy = (daly / 1000.0) + (deaths_val / 100000.0)
        research_proxy = max(total_research, 1)
        gap_score = round(burden_proxy / research_proxy * 1000, 2)

        if gap_score >= 50:
            label = "Critical Gap"
        elif gap_score >= 10:
            label = "Significant Gap"
        elif gap_score >= 2:
            label = "Moderate Gap"
        else:
            label = "Well Researched"

        gaps.append(ResearchGapOut(
            disease=disease,
            burden_records=int(data.get("records", 0)),
            latest_daly_rate=data.get("daly_rate"),
            latest_deaths=data.get("deaths"),
            pubmed_articles=pub,
            scholar_articles=sch,
            total_research=total_research,
            gap_score=gap_score,
            gap_label=label,
        ))

    gaps.sort(key=lambda x: x.gap_score, reverse=True)
    return gaps


@router.post("/contextual", response_model=ContextualBurdenOut)
async def contextual_burden(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
    paper_id: int | None = Query(None, description="Paper ID to derive disease context from"),
    disease_query: str | None = Query(None, description="Free-text disease/topic query"),
    country_code: str = Query("IND"),
    limit: int = Query(10, le=50),
) -> ContextualBurdenOut:
    """
    Return burden statistics contextually relevant to a paper.
    Uses the paper's title + abstract or a free-text query to identify
    disease categories, then fetches matching burden records.
    """
    # ── Resolve disease query ────────────────────────────────────────────────
    query_text = disease_query or ""

    if paper_id:
        paper = await db.get(Paper, paper_id)
        if paper and (paper.user_id == current_user.id):
            parts = [paper.title or ""]
            if paper.abstract:
                parts.append(paper.abstract[:500])
            query_text = " ".join(parts)

    if not query_text.strip():
        raise HTTPException(status_code=400, detail="Provide paper_id or disease_query")

    # ── Find matching diseases in burden DB ──────────────────────────────────
    # Extract keywords from query via simple word match against known diseases
    all_diseases_result = await db.execute(
        select(distinct(BurdenRecord.disease))
    )
    all_diseases = [row[0] for row in all_diseases_result.all()]

    q_lower = query_text.lower()
    matched_diseases = [d for d in all_diseases if d.lower() in q_lower or
                        any(w in q_lower for w in d.lower().split())]

    if not matched_diseases:
        matched_diseases = all_diseases[:5]  # fallback: top diseases

    # ── Fetch records ────────────────────────────────────────────────────────
    stmt = (
        select(BurdenRecord)
        .where(BurdenRecord.disease.in_(matched_diseases))
        .where(BurdenRecord.country_code == country_code)
        .order_by(BurdenRecord.year.desc(), BurdenRecord.metric)
        .limit(limit)
    )
    result = await db.execute(stmt)
    recs = result.scalars().all()

    # ── Build plain-language summary ─────────────────────────────────────────
    lines: list[str] = []
    for r in recs[:5]:
        if r.value is not None:
            lines.append(
                f"{r.disease} — {r.metric}: {r.value:,.1f} {r.unit or ''} "
                f"({r.year}, {r.state or r.country_code or 'India'})"
            )
    summary = "; ".join(lines) if lines else "No burden data found for this topic."

    disease_label = matched_diseases[0] if matched_diseases else "Unknown"
    return ContextualBurdenOut(
        disease=disease_label,
        stats=[BurdenRecordOut.from_orm_ext(r) for r in recs],
        summary=summary,
    )


@router.post("/refresh", status_code=status.HTTP_202_ACCEPTED)
async def refresh_burden_data(
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> dict:
    """
    Trigger a background re-scrape of WHO GHO, IHME GBD, and India burden sources.
    Returns immediately; data is refreshed in the background.
    """
    background_tasks.add_task(_do_refresh, db)
    return {"status": "refresh_started", "message": "Burden data refresh initiated in background"}
