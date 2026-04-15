"""
Google Scholar scraper via SerpAPI.

SerpAPI endpoint: https://serpapi.com/google-scholar-api
Requires env var: SERPAPI_KEY

Each result maps to one Article (source=SCHOLAR).
Snippet is stored as abstract when no real abstract is available.
Pagination is handled via the `start` parameter (10 results/page).
"""
from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.models import Article, ArticleSource

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_SERPAPI_BASE = "https://serpapi.com/search.json"
_RESULTS_PER_PAGE = 10
_MAX_RETRIES = 2
_RETRY_DELAY = 2.0
_REQUEST_DELAY = 1.0   # seconds between pages (SerpAPI has per-second limits)

_CONNECT_TIMEOUT = 10.0
_READ_TIMEOUT = 30.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_year(publication_info: str) -> Optional[int]:
    """
    SerpAPI returns publication_info as a string like:
      "A Smith, B Jones - Journal Name, 2022 - publisher.com"
    Extract the 4-digit year.
    """
    m = re.search(r"\b(19|20)\d{2}\b", publication_info or "")
    return int(m.group()) if m else None


def _extract_authors(publication_info: str) -> list[str]:
    """
    Parse author names from the publication_info string.
    Authors appear before the first ' - '.
    """
    if not publication_info:
        return []
    parts = publication_info.split(" - ", 1)
    if not parts:
        return []
    raw_authors = parts[0].strip()
    # SerpAPI truncates long author lists with "…"
    raw_authors = raw_authors.replace("…", "").strip(", ")
    authors = [a.strip() for a in raw_authors.split(",") if a.strip()]
    return authors


def _extract_journal(publication_info: str) -> Optional[str]:
    """
    Extract journal name: the segment between the first and second ' - '.
    Example: "A Smith - Lancet, 2022 - thelancet.com" → "Lancet"
    """
    if not publication_info:
        return None
    segments = publication_info.split(" - ")
    if len(segments) < 2:
        return None
    middle = segments[1].strip()
    # Strip trailing year and comma
    middle = re.sub(r",?\s*\b(19|20)\d{2}\b.*$", "", middle).strip()
    return middle or None


def _extract_doi(links: dict) -> Optional[str]:
    """
    SerpAPI may include a 'link' field pointing to DOI resolver or DOI directly.
    """
    for key in ("link", "pdf_link"):
        url: str = links.get(key, "")
        m = re.search(r"10\.\d{4,9}/[^\s\"'>]+", url)
        if m:
            return m.group().rstrip(".")
    return None


def _result_to_article(result: dict) -> Article:
    pub_info: str = result.get("publication_info", {}).get("summary", "")
    inline_links: dict = result.get("inline_links", {})

    title: str = result.get("title", "Untitled").strip()
    snippet: str = result.get("snippet", "")
    link: str = result.get("link", "")
    resource: dict = result.get("resources", [{}])[0] if result.get("resources") else {}
    full_text_url: Optional[str] = resource.get("link") or link or None

    authors = _extract_authors(pub_info)
    journal = _extract_journal(pub_info)
    year = _extract_year(pub_info)
    doi = _extract_doi({"link": link, **inline_links})

    cited_by: Optional[int] = None
    cited_info = inline_links.get("cited_by", {})
    if isinstance(cited_info, dict):
        cited_by = cited_info.get("total")

    # Build a richer abstract by combining snippet + citation count signal
    abstract_parts = [snippet] if snippet else []
    if cited_by is not None:
        abstract_parts.append(f"[Cited by {cited_by} on Google Scholar]")
    abstract = " ".join(abstract_parts) or None

    return Article(
        title=title[:512],
        abstract=abstract,
        authors=authors or None,
        journal=journal,
        year=year,
        doi=doi,
        url=link or None,
        full_text_url=full_text_url,
        source=ArticleSource.SCHOLAR,
        geography=None,
        keywords=None,
        scraped_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Public scraper
# ---------------------------------------------------------------------------

async def search_scholar(
    query: str,
    max_results: int = 50,
) -> list[Article]:
    """
    Search Google Scholar via SerpAPI and return Article ORM objects.

    Parameters
    ----------
    query:
        Free-text search query (same as you'd type in Scholar).
    max_results:
        Upper bound on results fetched.  SerpAPI returns 10/page, so
        up to ceil(max_results/10) requests are made.

    Returns
    -------
    list[Article]
        Unsaved ORM objects (source=SCHOLAR).  De-duplicates on DOI within
        the current batch; DB-level dedup is the caller's responsibility.

    Raises
    ------
    RuntimeError
        If SERPAPI_KEY is not set.
    """
    api_key = os.getenv("SERPAPI_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "SERPAPI_KEY environment variable is not set. "
            "Get a key at https://serpapi.com/"
        )

    articles: list[Article] = []
    seen_dois: set[str] = set()
    seen_titles: set[str] = set()

    timeout = httpx.Timeout(connect=_CONNECT_TIMEOUT, read=_READ_TIMEOUT, write=10.0, pool=5.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        start = 0
        while len(articles) < max_results:
            params = {
                "engine": "google_scholar",
                "q": query,
                "api_key": api_key,
                "num": _RESULTS_PER_PAGE,
                "start": start,
                "hl": "en",
            }

            resp = None
            for attempt in range(_MAX_RETRIES):
                try:
                    resp = await client.get(_SERPAPI_BASE, params=params)
                    resp.raise_for_status()
                    break
                except httpx.HTTPStatusError as e:
                    if e.response.status_code in (429, 503) and attempt < _MAX_RETRIES - 1:
                        await asyncio.sleep(_RETRY_DELAY * (attempt + 1))
                    else:
                        raise
                except httpx.RequestError:
                    if attempt < _MAX_RETRIES - 1:
                        await asyncio.sleep(_RETRY_DELAY)
                    else:
                        raise

            if resp is None:
                break

            data: dict = resp.json()
            results: list[dict] = data.get("organic_results", [])
            if not results:
                break   # No more pages

            for result in results:
                if len(articles) >= max_results:
                    break

                article = _result_to_article(result)

                # Dedup within batch
                dedup_key = article.doi or article.title.lower()[:80]
                if article.doi and article.doi in seen_dois:
                    continue
                if article.title.lower()[:80] in seen_titles:
                    continue
                if article.doi:
                    seen_dois.add(article.doi)
                seen_titles.add(article.title.lower()[:80])

                articles.append(article)

            # SerpAPI pagination
            if "serpapi_pagination" not in data or not data["serpapi_pagination"].get("next"):
                break

            start += _RESULTS_PER_PAGE
            await asyncio.sleep(_REQUEST_DELAY)

    return articles
