"""
Zenodo DOI minting service.

Flow
----
1. Create a new deposition (draft) via the Zenodo REST API.
2. Upload the paper content as a JSON attachment.
3. Set the deposition metadata (title, description, authors, …).
4. Publish the deposition → Zenodo assigns a DOI.
5. Return the DOI to the caller, which stores it on the Paper row.

Sandbox vs production
---------------------
Set ZENODO_SANDBOX=true to hit sandbox.zenodo.org instead of zenodo.org.
This is recommended for development / testing.

Environment variables
---------------------
ZENODO_API_KEY   — personal access token from zenodo.org/account/settings/applications
ZENODO_SANDBOX   — "true" to use sandbox.zenodo.org (default: false)
"""
from __future__ import annotations

import json
import os
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _base_url() -> str:
    sandbox = os.getenv("ZENODO_SANDBOX", "false").lower() == "true"
    return "https://sandbox.zenodo.org" if sandbox else "https://zenodo.org"


def _api_key() -> str:
    key = os.getenv("ZENODO_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "ZENODO_API_KEY environment variable is not set. "
            "Create a personal access token at zenodo.org/account/settings/applications."
        )
    return key


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _auth_params() -> dict[str, str]:
    return {"access_token": _api_key()}


def _raise_for_zenodo(response: httpx.Response) -> None:
    """Raise a descriptive RuntimeError for non-2xx Zenodo responses."""
    if response.is_error:
        try:
            body = response.json()
        except Exception:
            body = response.text
        raise RuntimeError(
            f"Zenodo API error {response.status_code}: {json.dumps(body)}"
        )


def _paper_metadata(title: str, abstract: str | None, author_name: str) -> dict[str, Any]:
    """Build the Zenodo deposition metadata dict."""
    meta: dict[str, Any] = {
        "title": title,
        "upload_type": "publication",
        "publication_type": "preprint",
        "description": abstract or title,
        "creators": [{"name": author_name}],
        "access_right": "open",
        "license": "cc-by",
    }
    return meta


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def mint_doi(
    *,
    title: str,
    abstract: str | None,
    content: dict | None,
    author_name: str,
) -> str:
    """
    Publish a paper to Zenodo and return the assigned DOI string
    (e.g. "10.5281/zenodo.1234567").

    Parameters
    ----------
    title:       Paper title.
    abstract:    Paper abstract (used as Zenodo description).
    content:     TipTap JSON document (stored as a JSON attachment).
    author_name: Full name of the corresponding author (e.g. "Singh A").

    Returns
    -------
    str — the DOI minted by Zenodo.

    Raises
    ------
    RuntimeError — if ZENODO_API_KEY is missing or any API call fails.
    """
    base = _base_url()
    params = _auth_params()
    headers = {"Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ── Step 1: Create empty deposition ──────────────────────────────────
        resp = await client.post(
            f"{base}/api/deposit/depositions",
            params=params,
            headers=headers,
            json={},
        )
        _raise_for_zenodo(resp)
        deposition = resp.json()
        deposition_id: int = deposition["id"]
        bucket_url: str = deposition["links"]["bucket"]

        # ── Step 2: Upload paper JSON as an attachment ────────────────────────
        paper_json_bytes = json.dumps(
            {"title": title, "abstract": abstract, "content": content},
            ensure_ascii=False,
            indent=2,
        ).encode()

        upload_resp = await client.put(
            f"{bucket_url}/paper.json",
            params=params,
            content=paper_json_bytes,
            headers={"Content-Type": "application/octet-stream"},
        )
        _raise_for_zenodo(upload_resp)

        # ── Step 3: Set metadata ──────────────────────────────────────────────
        meta_resp = await client.put(
            f"{base}/api/deposit/depositions/{deposition_id}",
            params=params,
            headers=headers,
            json={"metadata": _paper_metadata(title, abstract, author_name)},
        )
        _raise_for_zenodo(meta_resp)

        # ── Step 4: Publish ───────────────────────────────────────────────────
        pub_resp = await client.post(
            f"{base}/api/deposit/depositions/{deposition_id}/actions/publish",
            params=params,
        )
        _raise_for_zenodo(pub_resp)

        doi: str = pub_resp.json()["doi"]
        return doi
