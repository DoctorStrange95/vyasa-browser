"""
WHO Global Health Observatory (GHO) scraper.

Uses the public OData v4 REST API — no authentication required.
Base URL: https://ghoapi.azureedge.net/api/

Key indicators fetched for India (IND) and globally:
  SDGPM25          → PM2.5 exposure
  WHOSIS_000001    → Life expectancy at birth
  WHOSIS_000002    → Healthy life expectancy (HALE)
  MDG_0000000001   → Under-five mortality rate
  MDG_0000000026   → Infant mortality rate (per 1000 live births)
  NCDMORT3070      → Probability of dying 30-70 from CVD/cancer/DM/CRD
  SA_0000001462    → Total alcohol per capita consumption
  NCD_BMI_30C      → Obesity prevalence
  NCD_HYP_PREVALENCE → Hypertension prevalence
  DIABETES         → Diabetes prevalence
  HIV_0000000001   → HIV prevalence
  TB_e_inc_100k    → TB incidence per 100k
  MALARIA_EST_INCIDENCE → Malaria incidence

Each BurdenRecord row is unsaved; caller owns the session.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.models import BurdenRecord, BurdenSource

logger = logging.getLogger(__name__)

_BASE = "https://ghoapi.azureedge.net/api"

# ---------------------------------------------------------------------------
# Indicator catalogue — maps GHO code → (disease_label, metric_label, unit)
# ---------------------------------------------------------------------------

_INDICATORS: dict[str, tuple[str, str, str]] = {
    # NCD / mortality
    "NCDMORT3070":         ("Cardiovascular/Cancer/Diabetes/CRD", "Prob. Death 30-70", "%"),
    "NCD_BMI_30C":         ("Obesity", "Prevalence", "%"),
    "NCD_HYP_PREVALENCE_A": ("Hypertension", "Prevalence", "%"),
    # Communicable
    "HIV_0000000001":      ("HIV/AIDS", "Prevalence", "%"),
    "TB_e_inc_100k":       ("Tuberculosis", "Incidence", "per 100 000"),
    "MALARIA_EST_INCIDENCE": ("Malaria", "Incidence", "per 1 000 population at risk"),
    # Maternal & child
    "MDG_0000000001":      ("Child Health", "Under-5 Mortality Rate", "per 1 000 live births"),
    "MDG_0000000026":      ("Child Health", "Infant Mortality Rate", "per 1 000 live births"),
    "MDG_0000000005":      ("Maternal Health", "Maternal Mortality Ratio", "per 100 000 live births"),
    # Nutrition
    "NUTRITION_ANAEMIAWOMENBOTHpreg": ("Anaemia", "Prevalence in Pregnant Women", "%"),
    # Mental health proxy
    "SA_0000001462":       ("Substance Use", "Alcohol Consumption", "litres/capita/year"),
    # Life expectancy
    "WHOSIS_000001":       ("Population Health", "Life Expectancy at Birth", "years"),
    "WHOSIS_000002":       ("Population Health", "Healthy Life Expectancy (HALE)", "years"),
}

# Default country filter — India only; pass country_codes=None to get global data.
_DEFAULT_COUNTRIES = ["IND"]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_indicator(
    client: httpx.AsyncClient,
    indicator: str,
    country_codes: list[str],
) -> list[dict[str, Any]]:
    """Return raw value rows for a given indicator, filtered by country."""
    country_filter = " or ".join(
        f"SpatialDim eq '{c}'" for c in country_codes
    )
    url = f"{_BASE}/{indicator}"
    params = {
        "$filter": f"({country_filter}) and Dim1 eq 'BTSX'",  # BTSX = both sexes
        "$select": "SpatialDim,TimeDim,NumericValue,Low,High,Value",
        "$top": "500",
    }
    try:
        resp = await client.get(url, params=params, timeout=30.0)
        resp.raise_for_status()
        return resp.json().get("value", [])
    except Exception as exc:
        logger.warning("GHO fetch failed for %s: %s", indicator, exc)
        return []


def _row_to_record(
    row: dict[str, Any],
    disease: str,
    metric: str,
    unit: str,
    indicator_code: str,
) -> BurdenRecord | None:
    year_raw = row.get("TimeDim")
    value_raw = row.get("NumericValue")
    if year_raw is None or value_raw is None:
        return None
    try:
        year = int(year_raw)
        value = float(value_raw)
    except (TypeError, ValueError):
        return None

    return BurdenRecord(
        disease=disease,
        metric=metric,
        country_code=row.get("SpatialDim"),
        state=None,
        year=year,
        value=value,
        lower_ci=float(row["Low"]) if row.get("Low") is not None else None,
        upper_ci=float(row["High"]) if row.get("High") is not None else None,
        unit=unit,
        age_group="All ages",
        sex="both",
        source=BurdenSource.WHO_GHO,
        source_indicator=indicator_code,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def fetch_who_burden(
    country_codes: list[str] | None = None,
    indicators: list[str] | None = None,
) -> list[BurdenRecord]:
    """
    Fetch burden records from the WHO GHO API.

    Args:
        country_codes: ISO-3 codes to query (default: ["IND"]).
        indicators:    GHO indicator codes to fetch (default: all in catalogue).

    Returns:
        List of unsaved BurdenRecord ORM objects.
    """
    codes = country_codes or _DEFAULT_COUNTRIES
    ind_list = indicators or list(_INDICATORS.keys())

    records: list[BurdenRecord] = []
    async with httpx.AsyncClient(
        headers={"User-Agent": "HealthScholar/0.1 (+https://healthscholar.in)"}
    ) as client:
        for ind_code in ind_list:
            if ind_code not in _INDICATORS:
                logger.warning("Unknown GHO indicator: %s", ind_code)
                continue
            disease, metric, unit = _INDICATORS[ind_code]
            rows = await _fetch_indicator(client, ind_code, codes)
            for row in rows:
                rec = _row_to_record(row, disease, metric, unit, ind_code)
                if rec is not None:
                    records.append(rec)
            logger.info(
                "GHO %s (%s) → %d records for %s",
                ind_code, metric, len(rows), codes,
            )

    logger.info("fetch_who_burden → %d total records", len(records))
    return records


async def fetch_who_burden_for_disease(disease_query: str) -> list[BurdenRecord]:
    """
    Convenience wrapper: fetch WHO GHO records whose disease label matches
    the query string (case-insensitive substring).
    """
    q = disease_query.lower()
    matching_indicators = [
        code for code, (disease, _, _) in _INDICATORS.items()
        if q in disease.lower()
    ]
    if not matching_indicators:
        # Fall back to all indicators
        matching_indicators = list(_INDICATORS.keys())
    return await fetch_who_burden(indicators=matching_indicators)
