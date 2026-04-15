"""
Citation resolver.

POST /api/citations/resolve  — resolve DOI, PMID, or raw text → structured reference
"""
from __future__ import annotations

import re
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.routers.auth import CurrentUser

router = APIRouter(prefix="/api/citations", tags=["citations"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ResolveRequest(BaseModel):
    input: str   # DOI, PMID, URL containing DOI, or freeform citation text


class ResolvedCitation(BaseModel):
    title: str | None = None
    authors: list[str] = []
    journal: str | None = None
    year: int | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    doi: str | None = None
    pmid: str | None = None
    # Vancouver-style formatted string for immediate use
    citation_text: str | None = None
    source: str = "crossref"   # crossref | pubmed | unknown


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DOI_RE = re.compile(r'\b(10\.\d{4,}/[^\s"<>]+)', re.IGNORECASE)
_PMID_RE = re.compile(r'^\d{6,9}$')


def _format_vancouver(r: ResolvedCitation, pos: int = 1) -> str:
    authors = ", ".join(r.authors[:3])
    if len(r.authors) > 3:
        authors += " et al"
    parts = [f"{pos}. {authors}."] if authors else [f"{pos}."]
    if r.title:
        parts.append(f" {r.title}.")
    if r.journal:
        vol = f";{r.volume}" if r.volume else ""
        pages = f":{r.pages}" if r.pages else ""
        parts.append(f" {r.journal}. {r.year or ''}{vol}{pages}.")
    if r.doi:
        parts.append(f" doi:{r.doi}")
    return "".join(parts).strip()


async def _resolve_doi(doi: str) -> ResolvedCitation:
    url = f"https://api.crossref.org/works/{doi}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers={"User-Agent": "HealthScholar/0.1 (mailto:admin@healthscholar.app)"})
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"DOI not found: {doi}")
    data = resp.json().get("message", {})
    return _crossref_to_resolved(data)


def _crossref_to_resolved(data: dict) -> ResolvedCitation:
    # Authors
    authors: list[str] = []
    for a in data.get("author", []):
        given = a.get("given", "")
        family = a.get("family", "")
        if family:
            authors.append(f"{family} {given[0]}." if given else family)

    # Year
    year = None
    dp = data.get("published-print") or data.get("published-online") or data.get("issued")
    if dp:
        dp_parts = dp.get("date-parts", [[None]])
        if dp_parts and dp_parts[0]:
            year = dp_parts[0][0]

    # Journal / container
    container = None
    for key in ("container-title", "short-container-title"):
        titles = data.get(key)
        if titles:
            container = titles[0] if isinstance(titles, list) else titles
            break

    doi = data.get("DOI")
    title_list = data.get("title", [])
    title = title_list[0] if title_list else None
    volume = data.get("volume")
    issue = data.get("issue")
    pages = data.get("page")

    r = ResolvedCitation(
        title=title,
        authors=authors,
        journal=container,
        year=year,
        volume=volume,
        issue=issue,
        pages=pages,
        doi=doi,
        source="crossref",
    )
    r.citation_text = _format_vancouver(r)
    return r


async def _resolve_pmid(pmid: str) -> ResolvedCitation:
    url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
        f"?db=pubmed&id={pmid}&retmode=json"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"PMID not found: {pmid}")
    data = resp.json()
    result = data.get("result", {}).get(pmid, {})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"PMID not found: {pmid}")

    authors: list[str] = [a.get("name", "") for a in result.get("authors", []) if a.get("authtype") == "Author"]
    pubdate = result.get("pubdate", "")
    year = None
    if pubdate:
        m = re.match(r"(\d{4})", pubdate)
        if m:
            year = int(m.group(1))

    r = ResolvedCitation(
        title=result.get("title", ""),
        authors=authors,
        journal=result.get("fulljournalname") or result.get("source"),
        year=year,
        volume=result.get("volume"),
        issue=result.get("issue"),
        pages=result.get("pages"),
        doi=result.get("elocationid", "").replace("doi: ", "") or None,
        pmid=pmid,
        source="pubmed",
    )
    r.citation_text = _format_vancouver(r)
    return r


async def _search_crossref(text: str) -> ResolvedCitation:
    """Last resort: full-text query against CrossRef, return top result."""
    url = "https://api.crossref.org/works"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            url,
            params={"query": text[:500], "rows": 1, "select": "DOI,title,author,published-print,published-online,issued,container-title,volume,issue,page"},
            headers={"User-Agent": "HealthScholar/0.1"},
        )
    if resp.status_code != 200:
        return ResolvedCitation(title=text, source="unknown")
    items = resp.json().get("message", {}).get("items", [])
    if not items:
        return ResolvedCitation(title=text, source="unknown")
    r = _crossref_to_resolved(items[0])
    r.source = "crossref"
    return r


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/resolve", response_model=ResolvedCitation)
async def resolve_citation(
    body: ResolveRequest,
    current_user: CurrentUser,
) -> ResolvedCitation:
    """
    Resolve a DOI, PMID, URL containing a DOI, or freeform citation text
    into a structured ResolvedCitation with a pre-formatted citation_text.
    """
    text = body.input.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Input is empty")

    # 1. DOI anywhere in the string
    doi_match = _DOI_RE.search(text)
    if doi_match:
        doi = doi_match.group(1).rstrip(".,;)>\"")
        return await _resolve_doi(doi)

    # 2. Bare PMID
    if _PMID_RE.match(text):
        return await _resolve_pmid(text)

    # 3. Text search via CrossRef
    return await _search_crossref(text)
