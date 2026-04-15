"""
AI-powered article categorizer using the Anthropic API.

Batch-processes articles (up to 10 per API call) and returns structured
JSON with:
  disease_category  — one of the standard labels
  study_type        — research design label
  geography         — scope label
  confidence        — 0.0–1.0 overall confidence score
  reasoning         — brief explanation (hidden from users, useful for debugging)

Prompt caching is applied to the system prompt to avoid redundant token
charges when processing multiple batches in the same run.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

import anthropic

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL = "claude-opus-4-6"

_DISEASE_CATEGORIES = [
    "Infectious Disease",
    "Non-Communicable Disease (NCD)",
    "Maternal Health",
    "Child Health",
    "Mental Health",
    "Nutrition",
    "Vector-Borne Disease",
    "Tuberculosis",
    "COVID-19",
    "HIV/AIDS",
    "Vaccine-Preventable Disease",
    "Environmental Health",
    "Occupational Health",
    "Health Systems",
    "General Health",
    "Other",
]

_STUDY_TYPES = [
    "Randomized Controlled Trial (RCT)",
    "Cohort Study",
    "Cross-Sectional Study",
    "Case-Control Study",
    "Meta-Analysis",
    "Systematic Review",
    "Narrative Review",
    "Case Report / Case Series",
    "Ecological Study",
    "Qualitative Study",
    "Guideline / Policy Document",
    "Report / Bulletin",
    "Other",
]

_GEOGRAPHIES = [
    "India (National)",
    "India (State-Specific)",
    "South Asia",
    "Africa",
    "Other LMIC",
    "High-Income Country",
    "Multi-Country / Global",
    "Unknown",
]

_SYSTEM_PROMPT = f"""You are a medical librarian and epidemiologist specializing in classifying health research literature.

Your task: classify each article into exactly one disease_category, one study_type, and one geography label from the allowed lists below.

ALLOWED disease_category values:
{json.dumps(_DISEASE_CATEGORIES, indent=2)}

ALLOWED study_type values:
{json.dumps(_STUDY_TYPES, indent=2)}

ALLOWED geography values:
{json.dumps(_GEOGRAPHIES, indent=2)}

Rules:
1. Return ONLY valid JSON — no markdown, no prose outside the JSON.
2. Output a JSON array with one object per article in the same order as input.
3. Each object must have exactly these keys:
   - "disease_category": string (one of the allowed values)
   - "study_type": string (one of the allowed values)
   - "geography": string (one of the allowed values)
   - "confidence": float 0.0–1.0
   - "reasoning": string (≤40 words, for internal audit only)
4. If title or abstract is missing/uninformative, choose the most plausible values and set confidence ≤ 0.4.
5. For India-based research: prefer "India (State-Specific)" when a state is mentioned, else "India (National)".
6. For multi-disease papers (e.g. NCD + infectious), choose the PRIMARY focus.
"""

_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


def _build_user_message(articles: list[dict]) -> str:
    """Serialize a batch of {title, abstract} dicts into the user message."""
    items = []
    for i, art in enumerate(articles, 1):
        title = (art.get("title") or "").strip()
        abstract = (art.get("abstract") or "").strip()[:800]  # cap to save tokens
        items.append(f"Article {i}:\nTitle: {title}\nAbstract: {abstract}")
    return "\n\n---\n\n".join(items)


def _parse_response(raw: str, expected_count: int) -> list[dict]:
    """
    Extract JSON array from Claude's response, tolerating minor formatting
    deviations (e.g. wrapped in a code block).
    """
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    text = re.sub(r"```\s*$", "", text.strip(), flags=re.MULTILINE)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Attempt to find the JSON array within the text
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if m:
            parsed = json.loads(m.group())
        else:
            # Return a safe fallback for all articles in this batch
            return [
                {
                    "disease_category": "General Health",
                    "study_type": "Other",
                    "geography": "Unknown",
                    "confidence": 0.1,
                    "reasoning": "Parse error — fallback values used",
                }
                for _ in range(expected_count)
            ]

    if not isinstance(parsed, list):
        parsed = [parsed]

    # Pad or trim to expected length
    while len(parsed) < expected_count:
        parsed.append({
            "disease_category": "General Health",
            "study_type": "Other",
            "geography": "Unknown",
            "confidence": 0.1,
            "reasoning": "Missing from response — fallback",
        })

    return parsed[:expected_count]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def categorize_article(title: str, abstract: str) -> dict:
    """
    Categorize a single article.

    Returns a dict with keys:
      disease_category, study_type, geography, confidence, reasoning
    """
    results = await categorize_articles_batch([{"title": title, "abstract": abstract}])
    return results[0]


async def categorize_articles_batch(
    articles: list[dict],
    batch_size: int = 10,
) -> list[dict]:
    """
    Categorize a list of articles, processing them in batches.

    Parameters
    ----------
    articles:
        Each item must have "title" and "abstract" keys (both may be None).
    batch_size:
        Number of articles per API call.  Default 10.

    Returns
    -------
    list[dict]
        Same length as *articles*, each dict has:
        disease_category, study_type, geography, confidence, reasoning
    """
    client = _get_client()
    results: list[dict] = []

    for i in range(0, len(articles), batch_size):
        batch = articles[i : i + batch_size]
        user_content = _build_user_message(batch)

        stream = client.messages.stream(
            model=_MODEL,
            max_tokens=2048,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_content}],
        )

        async with stream as s:
            message = await s.get_final_message()

        # Extract text from content blocks (skip thinking blocks)
        raw_text = ""
        for block in message.content:
            if hasattr(block, "text"):
                raw_text += block.text

        batch_results = _parse_response(raw_text, len(batch))
        results.extend(batch_results)

    return results
