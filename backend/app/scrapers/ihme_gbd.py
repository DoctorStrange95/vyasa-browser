"""
IHME Global Burden of Disease (GBD) scraper.

Uses the IHME GBD Results public HTTP API.
Endpoint: https://api.healthdata.org/gbd-results/api/v1/results/
No API key required for public aggregate queries.

Fetches DALYs, Deaths, YLLs, YLDs for India by cause.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.models import BurdenRecord, BurdenSource

logger = logging.getLogger(__name__)

_BASE = "https://api.healthdata.org/gbd-results/api/v1/results/"

# GBD location ID for India = 163; sub-national IDs available too.
_INDIA_LOCATION_ID = 163
_GBD_ROUND = "GBD 2021"

# Metric IDs in GBD API
# 1 = Number, 2 = Percent, 3 = Rate (per 100k)
_METRIC_IDS = {"DALYs": 2, "Deaths": 1, "YLLs": 2, "YLDs": 2}
_METRIC_NAMES = {1: "count", 2: "rate"}

# Measure IDs
_MEASURE_IDS = {
    "DALYs (Disability-Adjusted Life Years)": 2,
    "Deaths":  1,
    "YLLs (Years of Life Lost)": 4,
    "YLDs (Years Lived with Disability)": 3,
    "Incidence": 6,
    "Prevalence": 5,
}

# Major cause names to fetch (GBD cause names)
_CAUSES = [
    "Tuberculosis",
    "HIV/AIDS",
    "Malaria",
    "Dengue",
    "Lower respiratory infections",
    "Diarrheal diseases",
    "Diabetes mellitus",
    "Ischemic heart disease",
    "Stroke",
    "Chronic obstructive pulmonary disease",
    "Tracheal, bronchus, and lung cancer",
    "Breast cancer",
    "Cervical cancer",
    "Depressive disorders",
    "Anxiety disorders",
    "Iron-deficiency anemia",
    "Protein-energy malnutrition",
    "Maternal disorders",
    "Neonatal disorders",
    "Hypertensive heart disease",
]

# Normalise GBD cause names → HealthScholar disease_category
_CAUSE_TO_DISEASE: dict[str, str] = {
    "Tuberculosis": "Tuberculosis",
    "HIV/AIDS": "HIV/AIDS",
    "Malaria": "Malaria",
    "Dengue": "Dengue",
    "Lower respiratory infections": "Respiratory Disease",
    "Diarrheal diseases": "Diarrhoeal Disease",
    "Diabetes mellitus": "Diabetes",
    "Ischemic heart disease": "Cardiovascular Disease",
    "Stroke": "Stroke",
    "Chronic obstructive pulmonary disease": "Respiratory Disease",
    "Tracheal, bronchus, and lung cancer": "Cancer",
    "Breast cancer": "Cancer",
    "Cervical cancer": "Cancer",
    "Depressive disorders": "Mental Health",
    "Anxiety disorders": "Mental Health",
    "Iron-deficiency anemia": "Anaemia",
    "Protein-energy malnutrition": "Malnutrition",
    "Maternal disorders": "Maternal Health",
    "Neonatal disorders": "Child Health",
    "Hypertensive heart disease": "Hypertension",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_page(
    client: httpx.AsyncClient,
    params: dict[str, Any],
) -> dict[str, Any]:
    try:
        resp = await client.get(
            _BASE,
            params=params,
            timeout=45.0,
            headers={"User-Agent": "HealthScholar/0.1 (+https://healthscholar.in)"},
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("IHME GBD API HTTP error %s: %s", exc.response.status_code, exc)
        return {}
    except Exception as exc:
        logger.warning("IHME GBD API error: %s", exc)
        return {}


def _row_to_record(row: dict[str, Any]) -> BurdenRecord | None:
    cause = row.get("cause_name", "")
    measure = row.get("measure_name", "")
    metric = row.get("metric_name", "rate")

    disease = _CAUSE_TO_DISEASE.get(cause, cause)
    year_raw = row.get("year")
    val_raw = row.get("val")
    if year_raw is None or val_raw is None:
        return None
    try:
        year = int(year_raw)
        value = float(val_raw)
    except (TypeError, ValueError):
        return None

    unit = "per 100 000" if metric.lower() == "rate" else "count"

    return BurdenRecord(
        disease=disease,
        metric=f"{measure} ({metric})",
        country_code="IND",
        state=None,
        year=year,
        value=value,
        lower_ci=float(row["lower"]) if row.get("lower") is not None else None,
        upper_ci=float(row["upper"]) if row.get("upper") is not None else None,
        unit=unit,
        age_group=row.get("age_name", "All ages"),
        sex=row.get("sex_name", "both").lower(),
        source=BurdenSource.IHME_GBD,
        source_indicator=f"{row.get('cause_id')}|{row.get('measure_id')}",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def fetch_gbd_burden(
    causes: list[str] | None = None,
    measures: list[str] | None = None,
    year_from: int = 2010,
    year_to: int = 2021,
) -> list[BurdenRecord]:
    """
    Fetch GBD burden records for India from the IHME API.

    Args:
        causes:    List of GBD cause names (default: _CAUSES).
        measures:  List of GBD measure names (default: Deaths, DALYs).
        year_from: Start year (inclusive).
        year_to:   End year (inclusive).

    Returns:
        Unsaved BurdenRecord ORM objects.
    """
    target_causes = causes or _CAUSES
    target_measures = measures or [
        "DALYs (Disability-Adjusted Life Years)",
        "Deaths",
        "Prevalence",
        "Incidence",
    ]

    params_base: dict[str, Any] = {
        "location_id": _INDIA_LOCATION_ID,
        "sex_id": 3,        # both sexes
        "age_group_id": 22, # all ages
        "metric_id": 3,     # rate per 100k
        "year": list(range(year_from, year_to + 1)),
        "format": "json",
    }

    records: list[BurdenRecord] = []
    async with httpx.AsyncClient() as client:
        for measure_name in target_measures:
            measure_id = _MEASURE_IDS.get(measure_name)
            if measure_id is None:
                continue
            params = {**params_base, "measure_id": measure_id}

            data = await _fetch_page(client, params)
            rows = data.get("results", [])

            for row in rows:
                cause_name = row.get("cause_name", "")
                if cause_name not in target_causes:
                    continue
                rec = _row_to_record(row)
                if rec is not None:
                    records.append(rec)

            logger.info(
                "IHME GBD measure=%s → %d usable records", measure_name, len(rows)
            )

    logger.info("fetch_gbd_burden → %d total records", len(records))
    return records


async def fetch_gbd_burden_for_disease(disease_query: str) -> list[BurdenRecord]:
    """
    Fetch GBD records for causes whose name matches the query string.
    """
    q = disease_query.lower()
    matching = [c for c in _CAUSES if q in c.lower()]
    if not matching:
        matching = _CAUSES
    return await fetch_gbd_burden(causes=matching)
