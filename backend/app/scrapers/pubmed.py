"""
PubMed scraper — NCBI E-utilities pipeline.

Flow:
    esearch.fcgi  →  list of PMIDs
    efetch.fcgi   →  full PubmedArticle XML records (batched, 20 per request)
    lxml parser   →  Article ORM objects (unsaved; caller owns the session)

Rate limit: 10 req/s with API key (NCBI_API_KEY env var), 3 req/s without.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any

import httpx
from lxml import etree

from app.models import Article, ArticleSource

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
_EFETCH_URL  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
_BATCH_SIZE  = 20   # NCBI recommended max per efetch request

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
# A simple token-bucket that serialises outgoing requests so we never exceed
# the allowed rate.  All coroutines in this process share the same instance.
# ---------------------------------------------------------------------------

class _RateLimiter:
    def __init__(self, rate: float) -> None:
        self._interval = 1.0 / rate
        self._lock = asyncio.Lock()
        self._last: float = 0.0

    async def wait(self) -> None:
        async with self._lock:
            gap = self._interval - (time.monotonic() - self._last)
            if gap > 0:
                await asyncio.sleep(gap)
            self._last = time.monotonic()


# Instantiated at import time; reconfigured by _get_limiter() on first call.
_limiter: _RateLimiter | None = None


def _get_limiter() -> _RateLimiter:
    global _limiter
    if _limiter is None:
        rate = 10.0 if os.getenv("NCBI_API_KEY") else 3.0
        _limiter = _RateLimiter(rate)
    return _limiter


# ---------------------------------------------------------------------------
# MeSH descriptor → disease_category
# ---------------------------------------------------------------------------
# Covers the major disease burdens tracked by IDSP and NHM India, plus common
# global conditions found in PubMed.  Entries are checked in order against the
# first matching MeSH term on a record.
# ---------------------------------------------------------------------------

_MESH_TO_DISEASE: dict[str, str] = {
    # ── Vector-borne ────────────────────────────────────────────────────────
    "Dengue":                               "Dengue",
    "Dengue Fever":                         "Dengue",
    "Dengue Virus":                         "Dengue",
    "Severe Dengue":                        "Dengue",
    "Malaria":                              "Malaria",
    "Malaria, Falciparum":                  "Malaria",
    "Malaria, Vivax":                       "Malaria",
    "Plasmodium falciparum":                "Malaria",
    "Plasmodium vivax":                     "Malaria",
    "Chikungunya Fever":                    "Chikungunya",
    "Chikungunya virus":                    "Chikungunya",
    "Japanese Encephalitis":               "Japanese Encephalitis",
    "Encephalitis, Japanese":              "Japanese Encephalitis",
    "Filariasis":                           "Filariasis",
    "Elephantiasis, Filarial":             "Filariasis",
    "Lymphatic Filariasis":                "Filariasis",
    "Leishmaniasis":                        "Leishmaniasis",
    "Leishmaniasis, Visceral":             "Leishmaniasis",
    "Kala-Ibo Disease":                    "Leishmaniasis",
    "Scrub Typhus":                         "Scrub Typhus",
    # ── Respiratory ─────────────────────────────────────────────────────────
    "COVID-19":                             "COVID-19",
    "SARS-CoV-2":                           "COVID-19",
    "Coronavirus Infections":              "COVID-19",
    "Severe Acute Respiratory Syndrome":   "COVID-19",
    "Influenza, Human":                    "Influenza",
    "Influenza A virus":                   "Influenza",
    "Pneumonia":                            "Pneumonia",
    "Tuberculosis":                         "Tuberculosis",
    "Tuberculosis, Pulmonary":             "Tuberculosis",
    "Mycobacterium tuberculosis":          "Tuberculosis",
    "Asthma":                               "Respiratory Disease",
    "Chronic Obstructive Pulmonary Disease":"Respiratory Disease",
    "Pulmonary Disease, Chronic Obstructive":"Respiratory Disease",
    # ── Enteric / waterborne ─────────────────────────────────────────────────
    "Cholera":                              "Cholera",
    "Vibrio cholerae":                      "Cholera",
    "Typhoid Fever":                        "Typhoid",
    "Salmonella typhi":                     "Typhoid",
    "Diarrhea":                             "Diarrhoeal Disease",
    "Gastroenteritis":                      "Diarrhoeal Disease",
    "Hepatitis A":                          "Hepatitis A",
    "Hepatitis E":                          "Hepatitis E",
    "Leptospirosis":                        "Leptospirosis",
    "Amoebiasis":                           "Amoebiasis",
    # ── Bloodborne ───────────────────────────────────────────────────────────
    "Hepatitis B":                          "Hepatitis B",
    "Hepatitis C":                          "Hepatitis C",
    "Hepatitis, Viral, Human":             "Viral Hepatitis",
    "HIV Infections":                       "HIV/AIDS",
    "Acquired Immunodeficiency Syndrome":  "HIV/AIDS",
    "HIV-1":                                "HIV/AIDS",
    # ── NTDs ─────────────────────────────────────────────────────────────────
    "Leprosy":                              "Leprosy",
    "Mycobacterium leprae":                "Leprosy",
    "Snakebites":                           "Snakebite",
    "Rabies":                               "Rabies",
    "Fluorosis":                            "Fluorosis",
    # ── Non-communicable ─────────────────────────────────────────────────────
    "Diabetes Mellitus":                   "Diabetes",
    "Diabetes Mellitus, Type 2":           "Diabetes",
    "Diabetes Mellitus, Type 1":           "Diabetes",
    "Cardiovascular Diseases":             "Cardiovascular Disease",
    "Heart Diseases":                       "Cardiovascular Disease",
    "Myocardial Infarction":               "Cardiovascular Disease",
    "Coronary Artery Disease":             "Cardiovascular Disease",
    "Hypertension":                         "Hypertension",
    "Stroke":                               "Stroke",
    "Cerebrovascular Disorders":           "Stroke",
    "Neoplasms":                            "Cancer",
    "Carcinoma":                            "Cancer",
    "Breast Neoplasms":                    "Cancer",
    "Lung Neoplasms":                      "Cancer",
    "Colorectal Neoplasms":               "Cancer",
    "Cervix Uteri":                        "Cancer",
    "Kidney Failure, Chronic":             "Chronic Kidney Disease",
    "Renal Insufficiency, Chronic":        "Chronic Kidney Disease",
    # ── Maternal & child ─────────────────────────────────────────────────────
    "Maternal Mortality":                  "Maternal Health",
    "Maternal Death":                       "Maternal Health",
    "Pregnancy Complications":             "Maternal Health",
    "Eclampsia":                            "Maternal Health",
    "Infant Mortality":                    "Child Health",
    "Child Nutrition Disorders":           "Malnutrition",
    "Malnutrition":                         "Malnutrition",
    "Protein-Energy Malnutrition":         "Malnutrition",
    "Anemia":                               "Anaemia",
    "Anemia, Iron-Deficiency":             "Anaemia",
    # ── Mental health ────────────────────────────────────────────────────────
    "Mental Disorders":                    "Mental Health",
    "Depression":                           "Mental Health",
    "Depressive Disorder":                 "Mental Health",
    "Anxiety Disorders":                   "Mental Health",
    "Schizophrenia":                        "Mental Health",
    "Suicide":                              "Mental Health",
    "Substance-Related Disorders":         "Substance Use",
    "Alcoholism":                           "Substance Use",
}

# ---------------------------------------------------------------------------
# PublicationType → study_type
# Checked in priority order: more specific types first.
# ---------------------------------------------------------------------------

_PUBTYPE_PRIORITY: list[tuple[str, str]] = [
    ("Randomized Controlled Trial",        "RCT"),
    ("Clinical Trial, Phase III",          "Clinical Trial"),
    ("Clinical Trial, Phase IV",           "Clinical Trial"),
    ("Clinical Trial, Phase II",           "Clinical Trial"),
    ("Clinical Trial, Phase I",            "Clinical Trial"),
    ("Clinical Trial",                     "Clinical Trial"),
    ("Pragmatic Clinical Trial",           "Clinical Trial"),
    ("Meta-Analysis",                      "Meta-Analysis"),
    ("Systematic Review",                  "Systematic Review"),
    ("Observational Study",                "Observational Study"),
    ("Case-Control Studies",               "Case-Control Study"),
    ("Cohort Studies",                     "Cohort Study"),
    ("Cross-Sectional Studies",            "Cross-Sectional Study"),
    ("Case Reports",                       "Case Report"),
    ("Review",                             "Review"),
    ("Comparative Study",                  "Comparative Study"),
    ("Multicenter Study",                  "Multicenter Study"),
    ("Surveillance",                       "Surveillance Report"),
    ("Epidemiologic Study",                "Epidemiological Study"),
    ("Journal Article",                    "Journal Article"),  # fallback
]

_PUBTYPE_MAP: dict[str, str] = dict(_PUBTYPE_PRIORITY)
_PUBTYPE_ORDER: list[str]    = [k for k, _ in _PUBTYPE_PRIORITY]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _text(el: Any, path: str) -> str | None:
    """Find a sub-element by XPath and return its stripped text, or None."""
    found = el.find(path)
    if found is None:
        return None
    txt = "".join(found.itertext()).strip()
    return txt or None


def _build_params(extra: dict[str, str]) -> dict[str, str]:
    params: dict[str, str] = {"db": "pubmed", **extra}
    api_key = os.getenv("NCBI_API_KEY")
    if api_key:
        params["api_key"] = api_key
    return params


async def _fetch(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, str],
) -> bytes:
    """Rate-limited GET; raises httpx.HTTPStatusError on 4xx/5xx."""
    await _get_limiter().wait()
    response = await client.get(url, params=params, timeout=30.0)
    response.raise_for_status()
    return response.content


# ---------------------------------------------------------------------------
# Step 1 — esearch: query → list[pmid]
# ---------------------------------------------------------------------------

async def _esearch(
    client: httpx.AsyncClient,
    query: str,
    max_results: int,
) -> list[str]:
    params = _build_params({
        "term":       query,
        "retmax":     str(max_results),
        "retmode":    "json",
        "usehistory": "n",
        "sort":       "relevance",
    })
    raw = await _fetch(client, _ESEARCH_URL, params)
    data: dict = json.loads(raw)
    return data.get("esearchresult", {}).get("idlist", [])


# ---------------------------------------------------------------------------
# Step 2 — efetch: batch of PMIDs → raw XML bytes
# ---------------------------------------------------------------------------

async def _efetch_batch(
    client: httpx.AsyncClient,
    pmids: list[str],
) -> bytes:
    params = _build_params({
        "id":      ",".join(pmids),
        "rettype": "xml",
        "retmode": "xml",
    })
    return await _fetch(client, _EFETCH_URL, params)


# ---------------------------------------------------------------------------
# Step 3 — XML parsing
# ---------------------------------------------------------------------------

def _extract_year(medline_citation: Any) -> int | None:
    """Try several paths in order; fall back to regex on MedlineDate."""
    for path in (
        ".//JournalIssue/PubDate/Year",
        ".//PubDate/Year",
        ".//ArticleDate/Year",
    ):
        raw = _text(medline_citation, path)
        if raw and raw.isdigit():
            return int(raw)

    # MedlineDate e.g. "2021 Jan-Feb", "2019 Winter", "2020"
    medline_date = _text(medline_citation, ".//JournalIssue/PubDate/MedlineDate")
    if medline_date:
        m = re.search(r"\b(19|20)\d{2}\b", medline_date)
        if m:
            return int(m.group())

    return None


def _extract_abstract(article_el: Any) -> str | None:
    """
    Handles both plain AbstractText and structured abstracts (BACKGROUND /
    METHODS / RESULTS / CONCLUSIONS labels).  Sections are joined with a
    blank line.
    """
    parts: list[str] = []
    for ab in article_el.findall(".//AbstractText"):
        text = "".join(ab.itertext()).strip()
        if not text:
            continue
        label = ab.get("Label")
        parts.append(f"{label}\n{text}" if label else text)
    return "\n\n".join(parts) or None


def _extract_authors(article_el: Any) -> list[str] | None:
    names: list[str] = []
    for author in article_el.findall(".//Author"):
        collective = _text(author, "CollectiveName")
        if collective:
            names.append(collective)
            continue
        last = _text(author, "LastName")
        if last is None:
            continue
        initials = _text(author, "Initials")
        names.append(f"{last} {initials}" if initials else last)
    return names or None


def _extract_doi(pubmed_article: Any) -> str | None:
    """
    Check two locations: ELocationID inside Article, then ArticleIdList
    inside PubmedData.  Strip a leading "doi:" prefix if present.
    """
    for path in (
        ".//Article/ELocationID[@EIdType='doi']",
        ".//PubmedData/ArticleIdList/ArticleId[@IdType='doi']",
    ):
        el = pubmed_article.find(path)
        if el is not None and el.text:
            raw = el.text.strip()
            return raw.removeprefix("doi:").strip() or None
    return None


def _extract_study_type(article_el: Any) -> str | None:
    pub_types: list[str] = [
        (pt.text or "").strip()
        for pt in article_el.findall(".//PublicationTypeList/PublicationType")
    ]
    # Walk priority list so more-specific types win
    for candidate in _PUBTYPE_ORDER:
        if candidate in pub_types:
            return _PUBTYPE_MAP[candidate]
    return None


def _mesh_to_disease(medline_citation: Any) -> str | None:
    for descriptor in medline_citation.findall(
        ".//MeshHeadingList/MeshHeading/DescriptorName"
    ):
        term = (descriptor.text or "").strip()
        if term in _MESH_TO_DISEASE:
            return _MESH_TO_DISEASE[term]
    return None


def _parse_pubmed_article(pubmed_article: Any) -> Article | None:
    """
    Parse a single <PubmedArticle> element into an (unsaved) Article ORM
    object.  Returns None if the record has no usable title.
    """
    mc      = pubmed_article.find("MedlineCitation")
    art_el  = pubmed_article.find(".//Article")
    if mc is None or art_el is None:
        return None

    title = _text(art_el, "ArticleTitle")
    if not title:
        return None

    # ── Identifiers ──────────────────────────────────────────────────────────
    pmid_el = mc.find("PMID")
    pmid    = (pmid_el.text or "").strip() or None if pmid_el is not None else None
    doi     = _extract_doi(pubmed_article)

    # ── Bibliographic ────────────────────────────────────────────────────────
    journal = (
        _text(art_el, ".//Journal/Title")
        or _text(mc, ".//MedlineTA")
    )
    year    = _extract_year(mc)
    volume  = _text(art_el, ".//Volume")
    issue   = _text(art_el, ".//Issue")
    pages   = (
        _text(art_el, ".//MedlinePgn")
        or _text(art_el, ".//Pagination/MedlinePgn")
    )

    # ── Keywords & MeSH ──────────────────────────────────────────────────────
    # Author-provided keywords (KeywordList)
    author_keywords: list[str] = [
        kw.text.strip()
        for kw in mc.findall(".//KeywordList/Keyword")
        if kw.text and kw.text.strip()
    ]
    # MeSH descriptor names (Major + minor topics)
    mesh_terms: list[str] = [
        el.text.strip()
        for el in mc.findall(".//MeshHeadingList/MeshHeading/DescriptorName")
        if el.text and el.text.strip()
    ]
    # Deduplicate preserving order: author keywords first, MeSH second
    seen: set[str] = set()
    all_keywords: list[str] = []
    for kw in author_keywords + mesh_terms:
        if kw not in seen:
            seen.add(kw)
            all_keywords.append(kw)

    # ── Classification ───────────────────────────────────────────────────────
    disease_category = _mesh_to_disease(mc)
    study_type       = _extract_study_type(art_el)

    # ── URLs ─────────────────────────────────────────────────────────────────
    url           = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else None
    full_text_url = f"https://doi.org/{doi}" if doi else None

    return Article(
        title            = title,
        abstract         = _extract_abstract(art_el),
        authors          = _extract_authors(art_el),
        journal          = journal,
        year             = year,
        volume           = volume,
        issue            = issue,
        pages            = pages,
        doi              = doi,
        pmid             = pmid,
        url              = url,
        full_text_url    = full_text_url,
        source           = ArticleSource.PUBMED,
        disease_category = disease_category,
        study_type       = study_type,
        geography        = None,  # not in PubMed XML; callers may enrich later
        keywords         = all_keywords or None,
    )


def _parse_xml_batch(xml_bytes: bytes) -> list[Article]:
    """Parse a raw efetch XML response into a list of Article objects."""
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError:
        logger.warning("Failed to parse efetch XML batch — skipping")
        return []

    articles: list[Article] = []
    for pa in root.findall(".//PubmedArticle"):
        try:
            article = _parse_pubmed_article(pa)
            if article is not None:
                articles.append(article)
        except Exception:
            logger.exception("Unexpected error parsing PubmedArticle — skipping record")

    return articles


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def search_pubmed(
    query: str,
    max_results: int = 50,
) -> list[Article]:
    """
    Search PubMed and return a list of unsaved ``Article`` ORM objects.

    The caller is responsible for deduplication against the database
    (check ``pmid`` and ``doi`` before inserting) and for adding the
    returned objects to an ``AsyncSession``.

    Args:
        query:       NCBI E-utilities search string — supports full MeSH,
                     Boolean, and field-tag syntax, e.g.
                     ``"dengue[MeSH] AND India[ad] AND 2015:2024[dp]"``
        max_results: Maximum number of records to fetch (NCBI caps at 10 000
                     per request; practical default is 50).

    Returns:
        Parsed ``Article`` instances in relevance order, with ``source``
        set to ``ArticleSource.PUBMED``.
    """
    if not query.strip():
        return []

    headers = {
        "User-Agent": (
            "HealthScholar/0.1 (health research platform; "
            "contact: admin@healthscholar.in)"
        )
    }

    async with httpx.AsyncClient(headers=headers) as client:
        # ── Step 1: get PMIDs ────────────────────────────────────────────────
        try:
            pmids = await _esearch(client, query, max_results)
        except httpx.HTTPStatusError as exc:
            logger.error("esearch failed: %s", exc)
            return []

        if not pmids:
            logger.info("esearch returned no results for query: %r", query)
            return []

        logger.info("esearch found %d PMIDs for query: %r", len(pmids), query)

        # ── Step 2: efetch in batches ────────────────────────────────────────
        batches = [
            pmids[i : i + _BATCH_SIZE]
            for i in range(0, len(pmids), _BATCH_SIZE)
        ]

        # asyncio.gather lets all batches run concurrently; the rate limiter
        # serialises the actual HTTP requests at 10 req/s.
        raw_results = await asyncio.gather(
            *[_efetch_batch(client, batch) for batch in batches],
            return_exceptions=True,
        )

        # ── Step 3: parse ────────────────────────────────────────────────────
        articles: list[Article] = []
        for i, result in enumerate(raw_results):
            if isinstance(result, Exception):
                logger.error(
                    "efetch batch %d/%d failed: %s", i + 1, len(batches), result
                )
                continue
            parsed = _parse_xml_batch(result)
            logger.debug("Batch %d/%d → %d articles", i + 1, len(batches), len(parsed))
            articles.extend(parsed)

        logger.info(
            "search_pubmed(%r) → %d articles parsed from %d PMIDs",
            query, len(articles), len(pmids),
        )
        return articles
