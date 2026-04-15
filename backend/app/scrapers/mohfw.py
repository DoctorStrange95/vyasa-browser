"""
MoHFW document scraper.

Covers the following program sub-sites / document portals:
  - NHM          https://nhm.gov.in/
  - RMNCH+A      https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=819&lid=216
  - Ayushman Bharat  https://pmjay.gov.in/
  - NVBDCP       https://nvbdcp.gov.in/
  - RNTCP/NTP    https://tbcindia.gov.in/
  - MoHFW main   https://mohfw.gov.in/

Each page is scraped for PDF/document links that look like guidelines,
reports, circulars, or advisories.  Every discovered document becomes one
Article row (source=MOHFW) with:
  disease_category  — inferred from program / filename keywords
  study_type        — "Guideline" | "Report" | "Circular" | "Advisory" | "Policy"
  geography         — "India"
  keywords          — program name + detected tags
"""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.models import Article, ArticleSource

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_REQUEST_DELAY = 1.5          # seconds between requests (polite scraping)
_CONNECT_TIMEOUT = 15.0
_READ_TIMEOUT = 30.0

_PROGRAM_SITES: list[dict] = [
    {
        "program": "NHM",
        "disease_category": "General Health",
        "urls": [
            "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=1043&lid=580",
            "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=1044&lid=581",
        ],
    },
    {
        "program": "RMNCH+A",
        "disease_category": "Maternal and Child Health",
        "urls": [
            "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=819&lid=216",
        ],
    },
    {
        "program": "Ayushman Bharat",
        "disease_category": "Health Financing",
        "urls": [
            "https://pmjay.gov.in/about/pmjay",
            "https://pmjay.gov.in/resources",
        ],
    },
    {
        "program": "NVBDCP",
        "disease_category": "Vector-Borne Diseases",
        "urls": [
            "https://nvbdcp.gov.in/index4.php?lang=1&level=0&linkid=425&lid=3682",
            "https://nvbdcp.gov.in/index4.php?lang=1&level=0&linkid=431&lid=3684",
            "https://nvbdcp.gov.in/index4.php?lang=1&level=0&linkid=426&lid=3683",
        ],
    },
    {
        "program": "RNTCP",
        "disease_category": "Tuberculosis",
        "urls": [
            "https://tbcindia.gov.in/index1.php?lang=1&level=2&sublinkid=4573&lid=3177",
            "https://tbcindia.gov.in/index1.php?lang=1&level=2&sublinkid=4574&lid=3178",
        ],
    },
    {
        "program": "MoHFW",
        "disease_category": "General Health",
        "urls": [
            "https://mohfw.gov.in/index1.php?lang=1&level=2&sublinkid=4938&lid=3399",
            "https://mohfw.gov.in/index1.php?lang=1&level=2&sublinkid=4936&lid=3398",
        ],
    },
]

# Keywords → study_type detection (checked against lowercase title/href)
_DOCTYPE_PATTERNS: list[tuple[str, str]] = [
    (r"\bguideline", "Guideline"),
    (r"\bprotocol", "Guideline"),
    (r"\bstandard\s+treatment", "Guideline"),
    (r"\boperational\s+guideline", "Guideline"),
    (r"\bcircular", "Circular"),
    (r"\boffice\s+memorandum\b", "Circular"),
    (r"\bom\b", "Circular"),
    (r"\badvisory", "Advisory"),
    (r"\bnational\s+health\s+policy", "Policy"),
    (r"\bpolicy", "Policy"),
    (r"\bannual\s+report", "Report"),
    (r"\bprogress\s+report", "Report"),
    (r"\breport", "Report"),
    (r"\bdata\s+brief", "Report"),
    (r"\bmanual", "Guideline"),
    (r"\bhandbook", "Guideline"),
    (r"\btraining\s+module", "Guideline"),
]

# Year pattern — looks for 4-digit year in title or URL
_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")

# Disease keywords to refine category when we know the program is general
_DISEASE_KEYWORDS: list[tuple[str, str]] = [
    (r"\bdengu", "Dengue"),
    (r"\bmalaria", "Malaria"),
    (r"\btuberculo|\btuberculosis|\btb\b|\brntcp", "Tuberculosis"),
    (r"\bcovid|corona|sars-cov", "COVID-19"),
    (r"\bcholera", "Cholera"),
    (r"\btyphoid", "Typhoid"),
    (r"\bhiv|aids", "HIV/AIDS"),
    (r"\bleprosy|\bnlep", "Leprosy"),
    (r"\bkala.azar|visceral\s+leishmaniasis", "Kala-azar"),
    (r"\bchikungunya", "Chikungunya"),
    (r"\bjaundice|\bhepatitis", "Hepatitis"),
    (r"\bpolio", "Polio"),
    (r"\bimmuniz|\bvaccin|\bnvhcp", "Immunization"),
    (r"\bmaternal|antenatal|prenatal|rmnch", "Maternal and Child Health"),
    (r"\bchild\s+health|infant|neonatal", "Maternal and Child Health"),
    (r"\bnutrition|\banemia", "Nutrition"),
    (r"\bhypertension|\bblood\s+pressure", "Hypertension"),
    (r"\bdiabetes", "Diabetes"),
    (r"\bcancer|\boncology", "Cancer"),
    (r"\bmental\s+health|\bnmhp", "Mental Health"),
]

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; HealthScholar-Bot/1.0; "
        "+https://healthscholar.in/bot)"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-IN,en;q=0.9",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@dataclass
class _DocLink:
    title: str
    url: str
    program: str
    disease_category: str
    year: Optional[int] = None
    study_type: Optional[str] = None
    keywords: list[str] = field(default_factory=list)


def _detect_year(text: str) -> Optional[int]:
    m = _YEAR_RE.search(text)
    return int(m.group()) if m else None


def _detect_study_type(text: str) -> str:
    lower = text.lower()
    for pattern, label in _DOCTYPE_PATTERNS:
        if re.search(pattern, lower):
            return label
    return "Report"


def _refine_disease(text: str, default: str) -> str:
    lower = text.lower()
    for pattern, label in _DISEASE_KEYWORDS:
        if re.search(pattern, lower):
            return label
    return default


def _clean_title(raw: str) -> str:
    """Normalize whitespace and strip common junk."""
    text = re.sub(r"\s+", " ", raw).strip()
    text = re.sub(r"^[\-–—•·▸►\d\.\)]+\s*", "", text)
    return text or raw.strip()


def _is_document_link(href: str, text: str) -> bool:
    """True if the link plausibly points to a document (PDF, doc, policy page)."""
    lower_href = href.lower()
    lower_text = text.lower()
    # Direct file downloads
    if re.search(r"\.(pdf|docx?|xlsx?|pptx?)(\?|$)", lower_href):
        return True
    # Anchor text hints
    doc_words = (
        "guideline", "circular", "advisory", "report", "policy", "manual",
        "protocol", "notification", "order", "memorandum", "handbook",
        "module", "bulletin", "data"
    )
    return any(w in lower_text or w in lower_href for w in doc_words)


def _extract_links(html: str, base_url: str, program: str, disease_category: str) -> list[_DocLink]:
    soup = BeautifulSoup(html, "lxml")
    links: list[_DocLink] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=True):
        href: str = a["href"].strip()
        text: str = _clean_title(a.get_text(separator=" "))
        if not href or href.startswith(("#", "javascript", "mailto")):
            continue
        full_url = urljoin(base_url, href)
        if full_url in seen:
            continue
        if not text or len(text) < 8:
            # Try parent cell / li text
            parent_text = a.find_parent(["td", "li", "p"])
            if parent_text:
                text = _clean_title(parent_text.get_text(separator=" "))
        if not text or len(text) < 8:
            continue
        if not _is_document_link(href, text):
            continue
        seen.add(full_url)

        combined = f"{text} {href}"
        year = _detect_year(combined)
        study_type = _detect_study_type(combined)
        refined_disease = _refine_disease(combined, disease_category)
        keywords = [program]
        if refined_disease != disease_category:
            keywords.append(refined_disease)

        links.append(_DocLink(
            title=text,
            url=full_url,
            program=program,
            disease_category=refined_disease,
            year=year,
            study_type=study_type,
            keywords=keywords,
        ))

    return links


def _build_abstract(doc: _DocLink) -> str:
    parts = [
        f"Source: Ministry of Health and Family Welfare (MoHFW), India.",
        f"Program: {doc.program}.",
    ]
    if doc.study_type:
        parts.append(f"Document type: {doc.study_type}.")
    if doc.year:
        parts.append(f"Year: {doc.year}.")
    parts.append(f"Disease/health category: {doc.disease_category}.")
    parts.append(f"Available at: {doc.url}")
    return " ".join(parts)


def _doc_to_article(doc: _DocLink) -> Article:
    return Article(
        title=doc.title[:512],
        abstract=_build_abstract(doc),
        authors=["Ministry of Health and Family Welfare, India"],
        journal=f"MoHFW – {doc.program}",
        year=doc.year,
        url=doc.url,
        full_text_url=doc.url,
        source=ArticleSource.MOHFW,
        disease_category=doc.disease_category,
        study_type=doc.study_type,
        geography="India",
        keywords=doc.keywords,
        scraped_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Public scraper
# ---------------------------------------------------------------------------

async def scrape_mohfw_documents(
    db=None,
    max_pages: int = 12,
) -> list[Article]:
    """
    Scrape MoHFW and associated program portals for policy documents.

    Parameters
    ----------
    db:
        Optional AsyncSession.  When supplied, already-seen URLs are loaded
        from the database and deduplication is performed.
    max_pages:
        Hard cap on total pages fetched across all program sites.

    Returns
    -------
    list[Article]
        Unsaved ORM Article objects (source=MOHFW) for new documents.
        If *db* is provided, rows are added to the session but not committed.
    """
    # Load existing URLs to skip duplicates
    existing_urls: set[str] = set()
    if db is not None:
        from sqlalchemy import select
        result = await db.execute(
            select(Article.url).where(Article.source == ArticleSource.MOHFW)
        )
        existing_urls = {row[0] for row in result.fetchall() if row[0]}

    articles: list[Article] = []
    pages_fetched = 0

    timeout = httpx.Timeout(connect=_CONNECT_TIMEOUT, read=_READ_TIMEOUT, write=10.0, pool=5.0)

    async with httpx.AsyncClient(
        headers=_HEADERS,
        timeout=timeout,
        follow_redirects=True,
        verify=False,   # MoHFW/NHM sometimes have cert issues
    ) as client:
        for program_cfg in _PROGRAM_SITES:
            if pages_fetched >= max_pages:
                break

            program: str = program_cfg["program"]
            disease_category: str = program_cfg["disease_category"]

            for url in program_cfg["urls"]:
                if pages_fetched >= max_pages:
                    break
                try:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    pages_fetched += 1
                except Exception:
                    await asyncio.sleep(_REQUEST_DELAY)
                    continue

                links = _extract_links(resp.text, url, program, disease_category)

                for doc in links:
                    if doc.url in existing_urls:
                        continue
                    existing_urls.add(doc.url)
                    article = _doc_to_article(doc)
                    articles.append(article)
                    if db is not None:
                        db.add(article)

                await asyncio.sleep(_REQUEST_DELAY)

    return articles
