"""
IDSP scraper — Integrated Disease Surveillance Programme
https://idsp.mohfw.gov.in/

Scrapes weekly outbreak reports and state-wise surveillance data and maps
them to the Article ORM model (source = ArticleSource.IDSP).

Design notes
────────────
• The IDSP site has been redesigned multiple times.  All CSS selectors and
  URL candidates are defined as constants at the top of this file so they
  can be updated without touching parsing logic.

• Parsing uses header-text column detection rather than fixed column indices
  so that minor table structure changes don't break the scraper.

• Caching: pass an AsyncSession to deduplicate against the database.
  Articles whose canonical URL already exists are silently skipped.

• No ORM session is held open during HTTP I/O; the caller owns the session.
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import httpx
from bs4 import BeautifulSoup, Tag
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Article, ArticleSource

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Site-map constants  ← update here when IDSP redesigns
# ---------------------------------------------------------------------------

# Candidate pages tried in order; the first one that returns usable table
# rows is used.  Separate URL sets for different report categories.
_OUTBREAK_URLS: list[str] = [
    "https://idsp.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3689",
    "https://idsp.mohfw.gov.in/outbreak-public.html",
    "https://idsp.mohfw.gov.in/outbreaks",
    "https://idsp.mohfw.gov.in/",
]

# CSS selectors tried in order to locate the data table on each page.
_TABLE_SELECTORS: list[str] = [
    "table.table-striped",
    "table.table-bordered",
    "table.tablesorter",
    "div#outbreak-content table",
    "div.content-area table",
    "div#content table",
    "main table",
    "table",           # final fallback — first table on the page
]

# Header-cell text → normalised column key.
# Matching is case-insensitive substring so minor wording changes are handled.
_HEADER_ALIASES: dict[str, str] = {
    # disease / syndrome
    "disease":     "disease",
    "syndrome":    "disease",
    "ailment":     "disease",
    # state / UT
    "state":       "state",
    " ut":         "state",
    "province":    "state",
    # district / location
    "district":    "district",
    "location":    "district",
    "area":        "district",
    "place":       "district",
    # date / week
    "date":        "date",
    "week":        "week",
    "period":      "date",
    "reported":    "date",
    # cases
    "case":        "cases",
    "affected":    "cases",
    "total case":  "cases",
    # deaths
    "death":       "deaths",
    "fatali":      "deaths",
    "deceased":    "deaths",
    # status
    "status":      "status",
    "remark":      "status",
    "comment":     "status",
    # description / summary
    "summary":     "description",
    "detail":      "description",
    "descripti":   "description",
}

# Pagination: "?page=N" or "&page=N" appended to listing URL
_MAX_PAGES = 8

# Seconds between requests (IDSP is a government server — be polite)
_REQUEST_DELAY = 1.5

# ---------------------------------------------------------------------------
# Disease-name → disease_category
# Matches IDSP's own surveillance category names + common abbreviations.
# ---------------------------------------------------------------------------

_DISEASE_MAP: dict[str, str] = {
    # ── Acute / enteric ──────────────────────────────────────────────────────
    "acute diarrhoeal disease":          "Diarrhoeal Disease",
    "acute diarrheal disease":           "Diarrhoeal Disease",
    "add":                               "Diarrhoeal Disease",
    "diarrhoea":                         "Diarrhoeal Disease",
    "diarrhea":                          "Diarrhoeal Disease",
    "gastroenteritis":                   "Diarrhoeal Disease",
    "cholera":                           "Cholera",
    "typhoid":                           "Typhoid",
    "enteric fever":                     "Typhoid",
    "viral hepatitis":                   "Viral Hepatitis",
    "hepatitis a":                       "Hepatitis A",
    "hepatitis b":                       "Hepatitis B",
    "hepatitis c":                       "Hepatitis C",
    "hepatitis e":                       "Hepatitis E",
    "jaundice":                          "Viral Hepatitis",
    "food poisoning":                    "Food Poisoning",
    "amoebiasis":                        "Amoebiasis",
    # ── Respiratory ──────────────────────────────────────────────────────────
    "acute respiratory infection":       "Respiratory Disease",
    "ari":                               "Respiratory Disease",
    "influenza":                         "Influenza",
    "influenza like illness":            "Influenza",
    "ili":                               "Influenza",
    "h1n1":                              "Influenza",
    "swine flu":                         "Influenza",
    "covid":                             "COVID-19",
    "covid-19":                          "COVID-19",
    "sars-cov-2":                        "COVID-19",
    "coronavirus":                       "COVID-19",
    "pneumonia":                         "Pneumonia",
    "tuberculosis":                      "Tuberculosis",
    "tb":                                "Tuberculosis",
    # ── Vector-borne ─────────────────────────────────────────────────────────
    "dengue":                            "Dengue",
    "dhf":                               "Dengue",
    "dengue haemorrhagic fever":         "Dengue",
    "dengue hemorrhagic fever":          "Dengue",
    "malaria":                           "Malaria",
    "p. falciparum":                     "Malaria",
    "p. vivax":                          "Malaria",
    "chikungunya":                       "Chikungunya",
    "japanese encephalitis":             "Japanese Encephalitis",
    "je":                                "Japanese Encephalitis",
    "acute encephalitis syndrome":       "Japanese Encephalitis",
    "aes":                               "Japanese Encephalitis",
    "filariasis":                        "Filariasis",
    "lymphatic filariasis":              "Filariasis",
    "kala azar":                         "Leishmaniasis",
    "kala-azar":                         "Leishmaniasis",
    "visceral leishmaniasis":            "Leishmaniasis",
    "scrub typhus":                      "Scrub Typhus",
    "typhus":                            "Scrub Typhus",
    # ── Animal-borne / other ─────────────────────────────────────────────────
    "leptospirosis":                     "Leptospirosis",
    "anthrax":                           "Anthrax",
    "plague":                            "Plague",
    "rabies":                            "Rabies",
    "snakebite":                         "Snakebite",
    "snake bite":                        "Snakebite",
    "brucellosis":                       "Brucellosis",
    # ── Vaccine-preventable ──────────────────────────────────────────────────
    "measles":                           "Measles",
    "pertussis":                         "Pertussis",
    "whooping cough":                    "Pertussis",
    "diphtheria":                        "Diphtheria",
    "tetanus":                           "Tetanus",
    "polio":                             "Polio",
    "meningitis":                        "Meningitis",
    # ── NCD / other ──────────────────────────────────────────────────────────
    "fluorosis":                         "Fluorosis",
    "heat stroke":                       "Heat Stroke",
    "heat wave":                         "Heat Stroke",
    "hand foot mouth":                   "Hand, Foot and Mouth Disease",
    "hfmd":                              "Hand, Foot and Mouth Disease",
    "mucormycosis":                      "Mucormycosis",
    "black fungus":                      "Mucormycosis",
}

# ---------------------------------------------------------------------------
# Indian state/UT → canonical name
# ---------------------------------------------------------------------------

_STATE_CANONICAL: dict[str, str] = {
    "ap":                               "Andhra Pradesh",
    "andhra":                           "Andhra Pradesh",
    "ar":                               "Arunachal Pradesh",
    "arunachal":                        "Arunachal Pradesh",
    "as":                               "Assam",
    "br":                               "Bihar",
    "cg":                               "Chhattisgarh",
    "chattisgarh":                      "Chhattisgarh",
    "chhatisgarh":                      "Chhattisgarh",
    "ga":                               "Goa",
    "gj":                               "Gujarat",
    "hr":                               "Haryana",
    "hp":                               "Himachal Pradesh",
    "himachal":                         "Himachal Pradesh",
    "jk":                               "Jammu and Kashmir",
    "j&k":                              "Jammu and Kashmir",
    "jharkhand":                        "Jharkhand",
    "jh":                               "Jharkhand",
    "ka":                               "Karnataka",
    "kl":                               "Kerala",
    "mp":                               "Madhya Pradesh",
    "mh":                               "Maharashtra",
    "mn":                               "Manipur",
    "ml":                               "Meghalaya",
    "mz":                               "Mizoram",
    "nl":                               "Nagaland",
    "od":                               "Odisha",
    "or":                               "Odisha",
    "orissa":                           "Odisha",
    "pb":                               "Punjab",
    "rj":                               "Rajasthan",
    "sk":                               "Sikkim",
    "tn":                               "Tamil Nadu",
    "tamilnadu":                        "Tamil Nadu",
    "tg":                               "Telangana",
    "tr":                               "Tripura",
    "uk":                               "Uttarakhand",
    "uttaranchal":                      "Uttarakhand",
    "up":                               "Uttar Pradesh",
    "wb":                               "West Bengal",
    "dl":                               "Delhi",
    "delhi":                            "Delhi",
    "nct":                              "Delhi",
    "ch":                               "Chandigarh",
    "chandigarh":                       "Chandigarh",
    "ld":                               "Lakshadweep",
    "py":                               "Puducherry",
    "pondicherry":                      "Puducherry",
    "an":                               "Andaman and Nicobar Islands",
    "andaman":                          "Andaman and Nicobar Islands",
    "la":                               "Ladakh",
    "dd":                               "Dadra and Nagar Haveli and Daman and Diu",
    "daman":                            "Dadra and Nagar Haveli and Daman and Diu",
}

# Status markers in report text
_STATUS_ONGOING  = {"ongoing", "active", "open", "under investigation", "continuing"}
_STATUS_CLOSED   = {"closed", "resolved", "controlled", "contained", "over"}
_STATUS_ALERT    = {"alert", "warning", "watch"}

# ---------------------------------------------------------------------------
# Intermediate data class
# ---------------------------------------------------------------------------

@dataclass
class _IDSPRecord:
    disease:     str
    state:       str
    district:    str | None       = None
    year:        int | None       = None
    week:        int | None       = None
    cases:       int | None       = None
    deaths:      int | None       = None
    status:      str | None       = None
    report_date: str | None       = None    # raw date string from page
    description: str | None       = None
    source_url:  str              = ""
    extra:       dict[str, str]   = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _normalise_disease(raw: str) -> str:
    """Return canonical disease_category string, or title-cased raw name."""
    key = raw.lower().strip()
    # Exact match first
    if key in _DISEASE_MAP:
        return _DISEASE_MAP[key]
    # Substring match (longest key wins to avoid "ARI" matching "malaria")
    best_len, best_val = 0, None
    for k, v in _DISEASE_MAP.items():
        if k in key and len(k) > best_len:
            best_len, best_val = len(k), v
    return best_val or raw.strip().title()


def _normalise_state(raw: str) -> str:
    """Return canonical Indian state/UT name, or title-cased raw value."""
    key = raw.lower().strip().rstrip(".")
    if key in _STATE_CANONICAL:
        return _STATE_CANONICAL[key]
    # Try matching against canonical names directly
    for canonical in _STATE_CANONICAL.values():
        if canonical.lower() == key:
            return canonical
    return raw.strip().title()


def _parse_int(text: str | None) -> int | None:
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def _extract_year(text: str) -> int | None:
    m = re.search(r"\b(20\d{2}|19\d{2})\b", text)
    return int(m.group()) if m else None


def _extract_week(text: str) -> int | None:
    m = re.search(r"(?:week|wk)[.\s#-]*(\d{1,2})", text, re.IGNORECASE)
    if m:
        w = int(m.group(1))
        return w if 1 <= w <= 53 else None
    return None


def _normalise_status(text: str) -> str | None:
    low = text.lower()
    if any(s in low for s in _STATUS_ONGOING):
        return "Ongoing"
    if any(s in low for s in _STATUS_CLOSED):
        return "Closed"
    if any(s in low for s in _STATUS_ALERT):
        return "Alert"
    return text.strip().title() or None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; HealthScholar/0.1; "
        "+https://healthscholar.in/bot)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}


async def _get_html(client: httpx.AsyncClient, url: str, retries: int = 3) -> str | None:
    """
    Fetch a URL and return the decoded HTML.  Returns None on permanent failure.
    Retries on transient network / 5xx errors with exponential back-off.
    """
    for attempt in range(1, retries + 1):
        try:
            resp = await client.get(url, headers=_HEADERS, timeout=20.0, follow_redirects=True)
            if resp.status_code == 404:
                logger.debug("404 — %s", url)
                return None
            resp.raise_for_status()
            return resp.text
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500:
                logger.warning("HTTP %s for %s — skipping", exc.response.status_code, url)
                return None
            logger.warning("HTTP 5xx on %s (attempt %d/%d)", url, attempt, retries)
        except httpx.RequestError as exc:
            logger.warning("Network error on %s (attempt %d/%d): %s", url, attempt, retries, exc)
        if attempt < retries:
            await asyncio.sleep(2 ** attempt)
    return None


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------

def _detect_columns(header_row: Tag) -> dict[int, str]:
    """
    Return a mapping of {column_index: normalised_key} by matching header
    cell text against _HEADER_ALIASES.  Unrecognised columns are omitted.
    """
    mapping: dict[int, str] = {}
    cells = header_row.find_all(["th", "td"])
    for i, cell in enumerate(cells):
        raw = cell.get_text(separator=" ", strip=True).lower()
        for alias, key in _HEADER_ALIASES.items():
            if alias in raw:
                if key not in mapping.values():   # first match wins per key
                    mapping[i] = key
                break
    return mapping


def _cell_text(row: Tag, idx: int) -> str | None:
    cells = row.find_all(["td", "th"])
    if idx >= len(cells):
        return None
    return cells[idx].get_text(separator=" ", strip=True) or None


def _find_table(soup: BeautifulSoup) -> Tag | None:
    for selector in _TABLE_SELECTORS:
        tbl = soup.select_one(selector)
        if tbl and tbl.find("tr"):
            return tbl
    return None


def _find_header_row(table: Tag) -> Tag | None:
    """
    Return the first <tr> that looks like a header (contains <th> cells or
    whose text resembles known column names).
    """
    for row in table.find_all("tr")[:5]:
        cells = row.find_all(["th", "td"])
        cell_texts = [c.get_text(strip=True).lower() for c in cells]
        if any("disease" in t or "state" in t or "syndrome" in t for t in cell_texts):
            return row
    return None


def _parse_row(
    row: Tag,
    col_map: dict[int, str],
    source_url: str,
) -> _IDSPRecord | None:
    """Parse one data row into an _IDSPRecord, or return None if unusable."""
    cells = row.find_all(["td", "th"])
    if not cells:
        return None

    def get(key: str) -> str | None:
        for idx, k in col_map.items():
            if k == key:
                return _cell_text(row, idx)
        return None

    raw_disease = get("disease") or ""
    raw_state   = get("state")   or ""

    if not raw_disease.strip() or not raw_state.strip():
        return None
    # Skip rows that are clearly not data (repeated headers, notes)
    if raw_disease.lower() in {"disease", "syndrome", "s.no", "#", "sl.no"}:
        return None

    raw_date  = get("date") or get("week") or ""
    raw_extra = {
        k: _cell_text(row, i) or ""
        for i, k in col_map.items()
        if k not in {"disease", "state", "district", "date", "week",
                     "cases", "deaths", "status", "description"}
    }

    return _IDSPRecord(
        disease     = raw_disease,
        state       = raw_state,
        district    = get("district"),
        year        = _extract_year(raw_date) or date.today().year,
        week        = _extract_week(raw_date),
        cases       = _parse_int(get("cases")),
        deaths      = _parse_int(get("deaths")),
        status      = _normalise_status(get("status") or ""),
        report_date = raw_date or None,
        description = get("description"),
        source_url  = source_url,
        extra       = raw_extra,
    )


def _parse_table(soup: BeautifulSoup, source_url: str) -> list[_IDSPRecord]:
    table = _find_table(soup)
    if table is None:
        logger.debug("No usable table found on %s", source_url)
        return []

    header_row = _find_header_row(table)
    if header_row is None:
        logger.debug("Could not identify header row on %s", source_url)
        return []

    col_map = _detect_columns(header_row)
    if "disease" not in col_map.values() or "state" not in col_map.values():
        logger.debug("Required columns (disease, state) not found on %s", source_url)
        return []

    records: list[_IDSPRecord] = []
    all_rows = table.find_all("tr")
    header_idx = all_rows.index(header_row)

    for row in all_rows[header_idx + 1 :]:
        rec = _parse_row(row, col_map, source_url)
        if rec is not None:
            records.append(rec)

    logger.info("Parsed %d records from %s", len(records), source_url)
    return records


# ---------------------------------------------------------------------------
# ORM conversion
# ---------------------------------------------------------------------------

def _build_url(rec: _IDSPRecord) -> str:
    """Construct a stable canonical URL for deduplication."""
    disease_slug = re.sub(r"\W+", "-", rec.disease.lower()).strip("-")
    state_slug   = re.sub(r"\W+", "-", rec.state.lower()).strip("-")
    year_part    = str(rec.year) if rec.year else "unknown"
    week_part    = f"w{rec.week:02d}" if rec.week else ""
    parts        = filter(None, [disease_slug, state_slug, year_part, week_part])
    return f"{rec.source_url}#{'-'.join(parts)}"


def _build_abstract(rec: _IDSPRecord) -> str:
    """Construct a human-readable abstract from available fields."""
    disease  = _normalise_disease(rec.disease)
    state    = _normalise_state(rec.state)
    location = f"{rec.district}, {state}" if rec.district else state

    lines: list[str] = [
        f"Outbreak of {disease} reported in {location}.",
    ]

    stats: list[str] = []
    if rec.cases  is not None: stats.append(f"Cases: {rec.cases}")
    if rec.deaths is not None: stats.append(f"Deaths: {rec.deaths}")
    if stats:
        lines.append("  ".join(stats))

    if rec.week and rec.year:
        lines.append(f"Surveillance period: Week {rec.week}, {rec.year}.")
    elif rec.year:
        lines.append(f"Year: {rec.year}.")

    if rec.status:
        lines.append(f"Status: {rec.status}.")

    if rec.description:
        lines.append(rec.description.strip())

    return "  ".join(lines)


def _record_to_article(rec: _IDSPRecord) -> Article:
    disease_cat = _normalise_disease(rec.disease)
    state_name  = _normalise_state(rec.state)
    location    = f"{rec.district}, {state_name}" if rec.district else state_name

    week_str    = f"Week {rec.week}, " if rec.week else ""
    title       = (
        f"{disease_cat} Outbreak — {location} "
        f"({week_str}{rec.year or 'Unknown Year'})"
    )

    # keywords: disease name variants + state + "outbreak" + "surveillance"
    keywords: list[str] = list(dict.fromkeys(filter(None, [
        rec.disease.strip(),
        disease_cat,
        state_name,
        rec.district,
        "outbreak",
        "surveillance",
        "IDSP",
        f"India {rec.year}" if rec.year else None,
    ])))

    return Article(
        title            = title,
        abstract         = _build_abstract(rec),
        authors          = None,                   # IDSP reports list no authors
        journal          = "IDSP Outbreak Reports",
        year             = rec.year,
        volume           = None,
        issue            = f"Week {rec.week}" if rec.week else None,
        pages            = None,
        doi              = None,
        pmid             = None,
        url              = _build_url(rec),
        full_text_url    = rec.source_url or None,
        source           = ArticleSource.IDSP,
        disease_category = disease_cat,
        study_type       = "Surveillance Report",
        geography        = location,
        keywords         = keywords,
    )


# ---------------------------------------------------------------------------
# Pagination helper
# ---------------------------------------------------------------------------

def _paginate(base_url: str, page: int) -> str:
    sep = "&" if "?" in base_url else "?"
    return f"{base_url}{sep}page={page}"


# ---------------------------------------------------------------------------
# DB cache
# ---------------------------------------------------------------------------

async def _load_existing_urls(db: AsyncSession) -> set[str]:
    """Return all Article.url values already stored for IDSP source."""
    result = await db.execute(
        select(Article.url).where(Article.source == ArticleSource.IDSP)
    )
    return {row[0] for row in result.all() if row[0]}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def scrape_idsp_reports(
    db: AsyncSession | None = None,
    max_pages: int = _MAX_PAGES,
) -> list[Article]:
    """
    Scrape IDSP outbreak reports and return a list of unsaved ``Article``
    ORM objects representing new records.

    Args:
        db:        Optional AsyncSession used to check for already-stored
                   records (by canonical URL).  When provided, articles
                   already in the database are silently filtered out.
                   The session is read-only here; the caller adds and
                   commits returned objects.
        max_pages: Maximum pagination depth per candidate URL.

    Returns:
        New ``Article`` instances (unsaved) with ``source = IDSP``,
        in the order they appeared on the report pages.
    """
    existing_urls: set[str] = set()
    if db is not None:
        existing_urls = await _load_existing_urls(db)
        logger.info("Cache: %d existing IDSP URLs loaded", len(existing_urls))

    all_records: list[_IDSPRecord] = []
    found_data = False

    async with httpx.AsyncClient() as client:
        for base_url in _OUTBREAK_URLS:
            if found_data:
                break

            for page in range(1, max_pages + 1):
                url = _paginate(base_url, page) if page > 1 else base_url
                await asyncio.sleep(_REQUEST_DELAY)

                html = await _get_html(client, url)
                if html is None:
                    logger.info("No content from %s — trying next URL", url)
                    break

                soup    = BeautifulSoup(html, "html.parser")
                records = _parse_table(soup, source_url=url)

                if not records:
                    if page == 1:
                        logger.info("No parseable table on %s — trying next candidate", url)
                    break   # no more pages for this URL

                found_data = True
                all_records.extend(records)

                # Stop paginating if this page returned fewer rows than a
                # typical page (heuristic: last page of results)
                if len(records) < 10:
                    logger.debug("Fewer than 10 rows on page %d — stopping pagination", page)
                    break

    if not found_data:
        logger.warning(
            "IDSP scraper found no data across all candidate URLs. "
            "The site may have been redesigned — update _OUTBREAK_URLS "
            "and _TABLE_SELECTORS in scrapers/idsp.py."
        )
        return []

    logger.info("Total raw records scraped: %d", len(all_records))

    # Convert to Article objects, deduplicating against DB and within batch
    seen_urls: set[str] = set(existing_urls)
    articles:  list[Article] = []

    for rec in all_records:
        article = _record_to_article(rec)
        if article.url in seen_urls:
            continue
        seen_urls.add(article.url)
        articles.append(article)

    logger.info(
        "scrape_idsp_reports → %d new articles (%d duplicates skipped)",
        len(articles),
        len(all_records) - len(articles),
    )
    return articles
