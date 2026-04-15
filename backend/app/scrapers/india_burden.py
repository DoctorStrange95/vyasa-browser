"""
India-specific burden data scraper.

Sources:
1. ICMR National Cancer Registry Programme (NCRP) — public summary tables
2. NFHS-5 (National Family Health Survey) key indicators — static curated data
3. IDSP weekly aggregated summaries from the public dashboard

ICMR and NFHS data below is curated from publicly released reports and loaded as
static seed records.  This avoids scraping fragile PDF/HTML structures and provides
immediate coverage.  The `fetch_india_burden()` function additionally attempts live
scraping from the India Open Government Data portal (data.gov.in) for dynamic data.

All returned BurdenRecord objects are unsaved; caller owns the session.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.models import BurdenRecord, BurdenSource

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static curated data — NFHS-5 (2019-21) key health indicators for India
# Source: NFHS-5 National Fact Sheet (IIPS 2021)
# ---------------------------------------------------------------------------

_NFHS5_RECORDS: list[dict[str, Any]] = [
    # Anaemia
    {"disease": "Anaemia", "metric": "Prevalence in Women 15-49 (count)", "year": 2021, "value": 57.0, "unit": "%", "age_group": "15-49 years", "sex": "female"},
    {"disease": "Anaemia", "metric": "Prevalence in Children 6-59 months (count)", "year": 2021, "value": 67.1, "unit": "%", "age_group": "6-59 months", "sex": "both"},
    {"disease": "Anaemia", "metric": "Prevalence in Pregnant Women (count)", "year": 2021, "value": 52.2, "unit": "%", "age_group": "15-49 years", "sex": "female"},
    # Malnutrition
    {"disease": "Malnutrition", "metric": "Stunting in children under 5 (count)", "year": 2021, "value": 35.5, "unit": "%", "age_group": "Under 5", "sex": "both"},
    {"disease": "Malnutrition", "metric": "Wasting in children under 5 (count)", "year": 2021, "value": 19.3, "unit": "%", "age_group": "Under 5", "sex": "both"},
    {"disease": "Malnutrition", "metric": "Underweight children under 5 (count)", "year": 2021, "value": 32.1, "unit": "%", "age_group": "Under 5", "sex": "both"},
    # Maternal & child
    {"disease": "Maternal Health", "metric": "Maternal Mortality Ratio", "year": 2020, "value": 97.0, "unit": "per 100 000 live births", "age_group": "15-49 years", "sex": "female"},
    {"disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 41.9, "unit": "per 1 000 live births", "age_group": "Under 5", "sex": "both"},
    {"disease": "Child Health", "metric": "Neonatal Mortality Rate", "year": 2021, "value": 24.9, "unit": "per 1 000 live births", "age_group": "Neonates", "sex": "both"},
    # Communicable
    {"disease": "Tuberculosis", "metric": "Incidence", "year": 2022, "value": 199.0, "unit": "per 100 000", "age_group": "All ages", "sex": "both"},
    {"disease": "Tuberculosis", "metric": "Deaths", "year": 2022, "value": 331000.0, "unit": "count", "age_group": "All ages", "sex": "both"},
    {"disease": "Malaria", "metric": "Confirmed Cases", "year": 2022, "value": 2.3, "unit": "million", "age_group": "All ages", "sex": "both"},
    {"disease": "HIV/AIDS", "metric": "Prevalence (15-49 years)", "year": 2021, "value": 0.21, "unit": "%", "age_group": "15-49 years", "sex": "both"},
    # NCD
    {"disease": "Diabetes", "metric": "Prevalence", "year": 2021, "value": 11.4, "unit": "%", "age_group": "20-79 years", "sex": "both"},
    {"disease": "Hypertension", "metric": "Prevalence (Men 15-49)", "year": 2021, "value": 24.0, "unit": "%", "age_group": "15-49 years", "sex": "male"},
    {"disease": "Hypertension", "metric": "Prevalence (Women 15-49)", "year": 2021, "value": 21.0, "unit": "%", "age_group": "15-49 years", "sex": "female"},
    {"disease": "Cardiovascular Disease", "metric": "Mortality", "year": 2020, "value": 27.0, "unit": "% of total deaths", "age_group": "All ages", "sex": "both"},
    # Mental health
    {"disease": "Mental Health", "metric": "Prevalence of mental disorders", "year": 2017, "value": 14.3, "unit": "%", "age_group": "All ages", "sex": "both"},
    # Cancer (NCRP 2022)
    {"disease": "Cancer", "metric": "Age-Adjusted Incidence Rate (Male)", "year": 2022, "value": 94.1, "unit": "per 100 000", "age_group": "All ages", "sex": "male"},
    {"disease": "Cancer", "metric": "Age-Adjusted Incidence Rate (Female)", "year": 2022, "value": 103.6, "unit": "per 100 000", "age_group": "All ages", "sex": "female"},
    {"disease": "Cancer", "metric": "New Cases Annually", "year": 2022, "value": 1461427.0, "unit": "count", "age_group": "All ages", "sex": "both"},
    # Respiratory
    {"disease": "Respiratory Disease", "metric": "COPD Prevalence", "year": 2019, "value": 7.5, "unit": "%", "age_group": "40+ years", "sex": "both"},
    {"disease": "Tuberculosis", "metric": "Drug-Resistant TB Cases", "year": 2022, "value": 119000.0, "unit": "count", "age_group": "All ages", "sex": "both"},
    # Diarrhoeal
    {"disease": "Diarrhoeal Disease", "metric": "Deaths in Under-5", "year": 2019, "value": 98000.0, "unit": "count", "age_group": "Under 5", "sex": "both"},
    # Dengue
    {"disease": "Dengue", "metric": "Reported Cases", "year": 2023, "value": 289235.0, "unit": "count", "age_group": "All ages", "sex": "both"},
    {"disease": "Dengue", "metric": "Deaths", "year": 2023, "value": 371.0, "unit": "count", "age_group": "All ages", "sex": "both"},
    # COVID-19 legacy
    {"disease": "COVID-19", "metric": "Cumulative Cases", "year": 2023, "value": 44690440.0, "unit": "count", "age_group": "All ages", "sex": "both"},
    {"disease": "COVID-19", "metric": "Cumulative Deaths", "year": 2023, "value": 531000.0, "unit": "count", "age_group": "All ages", "sex": "both"},
]

# ---------------------------------------------------------------------------
# State-wise burden — curated snapshot (NFHS-5, selected indicators)
# Each entry: state, disease, metric, year, value, unit
# ---------------------------------------------------------------------------

_STATE_RECORDS: list[dict[str, Any]] = [
    # Anaemia in women — NFHS-5 state factsheets
    {"state": "Uttar Pradesh",  "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 50.4, "unit": "%"},
    {"state": "Bihar",          "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 63.5, "unit": "%"},
    {"state": "Rajasthan",      "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 54.4, "unit": "%"},
    {"state": "Madhya Pradesh", "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 54.7, "unit": "%"},
    {"state": "Gujarat",        "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 65.2, "unit": "%"},
    {"state": "Maharashtra",    "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 45.7, "unit": "%"},
    {"state": "Tamil Nadu",     "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 44.8, "unit": "%"},
    {"state": "West Bengal",    "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 71.3, "unit": "%"},
    {"state": "Karnataka",      "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 44.8, "unit": "%"},
    {"state": "Kerala",         "disease": "Anaemia", "metric": "Prevalence in Women", "year": 2021, "value": 33.7, "unit": "%"},
    # TB notification rate by state (2022)
    {"state": "Uttar Pradesh",  "disease": "Tuberculosis", "metric": "Notification Rate", "year": 2022, "value": 253.0, "unit": "per 100 000"},
    {"state": "Bihar",          "disease": "Tuberculosis", "metric": "Notification Rate", "year": 2022, "value": 321.0, "unit": "per 100 000"},
    {"state": "Maharashtra",    "disease": "Tuberculosis", "metric": "Notification Rate", "year": 2022, "value": 201.0, "unit": "per 100 000"},
    {"state": "Rajasthan",      "disease": "Tuberculosis", "metric": "Notification Rate", "year": 2022, "value": 189.0, "unit": "per 100 000"},
    {"state": "Madhya Pradesh", "disease": "Tuberculosis", "metric": "Notification Rate", "year": 2022, "value": 247.0, "unit": "per 100 000"},
    {"state": "Tamil Nadu",     "disease": "Tuberculosis", "metric": "Notification Rate", "year": 2022, "value": 148.0, "unit": "per 100 000"},
    {"state": "Kerala",         "disease": "Tuberculosis", "metric": "Notification Rate", "year": 2022, "value": 51.0, "unit": "per 100 000"},
    # Malaria — NVBDCP state-wise 2022
    {"state": "Odisha",          "disease": "Malaria", "metric": "Confirmed Cases", "year": 2022, "value": 234816.0, "unit": "count"},
    {"state": "Chhattisgarh",    "disease": "Malaria", "metric": "Confirmed Cases", "year": 2022, "value": 71223.0,  "unit": "count"},
    {"state": "Jharkhand",       "disease": "Malaria", "metric": "Confirmed Cases", "year": 2022, "value": 52310.0,  "unit": "count"},
    {"state": "Madhya Pradesh",  "disease": "Malaria", "metric": "Confirmed Cases", "year": 2022, "value": 34000.0,  "unit": "count"},
    {"state": "Uttar Pradesh",   "disease": "Malaria", "metric": "Confirmed Cases", "year": 2022, "value": 15000.0,  "unit": "count"},
    # Dengue — NVBDCP 2023
    {"state": "Kerala",          "disease": "Dengue", "metric": "Reported Cases", "year": 2023, "value": 37021.0, "unit": "count"},
    {"state": "Maharashtra",     "disease": "Dengue", "metric": "Reported Cases", "year": 2023, "value": 18432.0, "unit": "count"},
    {"state": "Karnataka",       "disease": "Dengue", "metric": "Reported Cases", "year": 2023, "value": 17432.0, "unit": "count"},
    {"state": "Tamil Nadu",      "disease": "Dengue", "metric": "Reported Cases", "year": 2023, "value": 16700.0, "unit": "count"},
    {"state": "Uttar Pradesh",   "disease": "Dengue", "metric": "Reported Cases", "year": 2023, "value": 22341.0, "unit": "count"},
    # Under-5 mortality — NFHS-5
    {"state": "Uttar Pradesh",   "disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 59.8, "unit": "per 1 000 live births"},
    {"state": "Bihar",           "disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 56.4, "unit": "per 1 000 live births"},
    {"state": "Madhya Pradesh",  "disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 51.7, "unit": "per 1 000 live births"},
    {"state": "Rajasthan",       "disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 44.3, "unit": "per 1 000 live births"},
    {"state": "Kerala",          "disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 7.4,  "unit": "per 1 000 live births"},
    {"state": "Tamil Nadu",      "disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 20.1, "unit": "per 1 000 live births"},
    {"state": "Gujarat",         "disease": "Child Health", "metric": "Under-5 Mortality Rate", "year": 2021, "value": 36.8, "unit": "per 1 000 live births"},
]


def _seed_to_record(row: dict[str, Any], source: BurdenSource) -> BurdenRecord:
    return BurdenRecord(
        disease=row["disease"],
        metric=row["metric"],
        country_code="IND",
        state=row.get("state"),
        year=row["year"],
        value=row["value"],
        lower_ci=row.get("lower_ci"),
        upper_ci=row.get("upper_ci"),
        unit=row.get("unit", ""),
        age_group=row.get("age_group", "All ages"),
        sex=row.get("sex", "both"),
        source=source,
        source_indicator=None,
    )


# ---------------------------------------------------------------------------
# Live data — India Open Government Data (data.gov.in)
# The OGD platform exposes a CKAN-style API for registered resource IDs.
# We use the public resource IDs for NVBDCP vector-borne disease stats.
# ---------------------------------------------------------------------------

_OGD_BASE = "https://api.data.gov.in/resource"
# Requires an API key; falls back to static data if not available.
_OGD_RESOURCE_IDS: dict[str, str] = {
    "dengue_annual":  "ffd04c75-2ef0-45ab-9042-c76b2c7a47e3",
    "malaria_annual": "e4e12a3e-ef63-4a37-baaf-c9ca8a1fd11b",
}


async def _try_fetch_ogd(
    client: httpx.AsyncClient,
    resource_id: str,
    api_key: str,
) -> list[dict[str, Any]]:
    try:
        resp = await client.get(
            f"{_OGD_BASE}/{resource_id}",
            params={"api-key": api_key, "format": "json", "limit": 200},
            timeout=20.0,
        )
        resp.raise_for_status()
        return resp.json().get("records", [])
    except Exception as exc:
        logger.debug("OGD fetch skipped for %s: %s", resource_id, exc)
        return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def fetch_india_burden(ogd_api_key: str | None = None) -> list[BurdenRecord]:
    """
    Return India-specific burden records from:
    - Curated NFHS-5 / ICMR / NVBDCP national data (always available)
    - Curated state-wise data (always available)
    - India OGD portal (if ogd_api_key is provided)

    Returns:
        Unsaved BurdenRecord ORM objects.
    """
    records: list[BurdenRecord] = []

    # ── Static seed data ────────────────────────────────────────────────────
    for row in _NFHS5_RECORDS:
        records.append(_seed_to_record(row, BurdenSource.NFHS))

    for row in _STATE_RECORDS:
        records.append(_seed_to_record(row, BurdenSource.ICMR))

    # ── Live OGD data (optional) ─────────────────────────────────────────────
    if ogd_api_key:
        async with httpx.AsyncClient(
            headers={"User-Agent": "HealthScholar/0.1"}
        ) as client:
            for name, rid in _OGD_RESOURCE_IDS.items():
                rows = await _try_fetch_ogd(client, rid, ogd_api_key)
                logger.info("OGD %s → %d rows", name, len(rows))
                # OGD schema varies; basic extraction
                for row in rows:
                    try:
                        year = int(row.get("Year") or row.get("year") or 0)
                        if year == 0:
                            continue
                        disease = "Dengue" if "dengue" in name else "Malaria"
                        value_raw = row.get("Confirmed_Cases") or row.get("Cases") or row.get("Total_Cases")
                        if value_raw is None:
                            continue
                        records.append(BurdenRecord(
                            disease=disease,
                            metric="Confirmed Cases (OGD)",
                            country_code="IND",
                            state=row.get("State") or row.get("state"),
                            year=year,
                            value=float(value_raw),
                            unit="count",
                            age_group="All ages",
                            sex="both",
                            source=BurdenSource.ICMR,
                            source_indicator=rid,
                        ))
                    except Exception:
                        pass

    logger.info("fetch_india_burden → %d total records", len(records))
    return records
