"""
Statistical analysis router.

POST /api/analysis/upload              — upload CSV/XLSX dataset
GET  /api/analysis/datasets            — list user datasets
GET  /api/analysis/datasets/{id}/preview — first 20 rows + column types
POST /api/analysis/run                 — run an analysis
GET  /api/analysis/results/{id}        — retrieve saved result
POST /api/analysis/interpret           — AI interpretation of results
"""
from __future__ import annotations

import io
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AnalysisResult, Dataset
from app.routers.auth import CurrentUser

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

_UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DatasetResponse(BaseModel):
    id: int
    filename: str
    row_count: int | None
    columns: list[dict] | None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DatasetPreview(BaseModel):
    id: int
    filename: str
    columns: list[dict]
    preview_rows: list[dict]
    row_count: int
    missing_summary: dict


class RunAnalysisRequest(BaseModel):
    dataset_id: int
    analysis_type: str
    params: dict[str, Any]


class AnalysisResultResponse(BaseModel):
    id: int
    dataset_id: int
    analysis_type: str
    parameters: dict | None
    results: dict | None
    chart_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InterpretRequest(BaseModel):
    analysis_type: str
    results_json: dict
    variable_names: list[str] | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _col_type(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        return "continuous"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    n_unique = series.nunique()
    if n_unique <= 20:
        return "categorical"
    return "text"


def _infer_columns(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "name": col,
            "type": _col_type(df[col]),
            "dtype": str(df[col].dtype),
            "n_unique": int(df[col].nunique()),
            "n_missing": int(df[col].isna().sum()),
            "sample_values": [str(v) for v in df[col].dropna().unique()[:5]],
        }
        for col in df.columns
    ]


def _safe_path(user_id: int, filename: str) -> Path:
    """Return a safe upload path scoped to user ID."""
    user_dir = _UPLOAD_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
    return user_dir / safe_name


def _load_dataframe(file_path: str) -> pd.DataFrame:
    p = Path(file_path)
    if not p.exists():
        raise FileNotFoundError(f"Dataset file not found: {file_path}")
    if p.suffix.lower() in (".xlsx", ".xls"):
        return pd.read_excel(p, engine="openpyxl")
    return pd.read_csv(p)


# ---------------------------------------------------------------------------
# POST /api/analysis/upload
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
    file: UploadFile = File(...),
    paper_id: int | None = Form(None),
) -> Dataset:
    if file.content_type not in (
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",
    ):
        # Accept by extension fallback
        ext = Path(file.filename or "").suffix.lower()
        if ext not in (".csv", ".xlsx", ".xls"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only CSV and XLSX files are supported",
            )

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50 MB limit",
        )

    # Parse to get column info
    try:
        ext = Path(file.filename or "data.csv").suffix.lower()
        if ext in (".xlsx", ".xls"):
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse file: {e}",
        )

    # Save to disk
    save_path = _safe_path(current_user.id, file.filename or "upload.csv")
    save_path.write_bytes(content)

    columns = _infer_columns(df)
    dataset = Dataset(
        user_id=current_user.id,
        paper_id=paper_id,
        filename=file.filename or "upload",
        file_path=str(save_path),
        columns=columns,
        row_count=len(df),
    )
    db.add(dataset)
    await db.flush()
    return dataset


# ---------------------------------------------------------------------------
# GET /api/analysis/datasets
# ---------------------------------------------------------------------------

@router.get("/datasets", response_model=list[DatasetResponse])
async def list_datasets(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[Dataset]:
    result = await db.execute(
        select(Dataset)
        .where(Dataset.user_id == current_user.id)
        .order_by(Dataset.uploaded_at.desc())
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# GET /api/analysis/datasets/{id}/preview
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}/preview", response_model=DatasetPreview)
async def preview_dataset(
    dataset_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> DatasetPreview:
    dataset = await db.get(Dataset, dataset_id)
    if dataset is None or dataset.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    try:
        df = _load_dataframe(dataset.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset file missing on disk")

    columns = _infer_columns(df)
    preview_rows = df.head(20).fillna("").to_dict(orient="records")
    missing_summary = {col: int(df[col].isna().sum()) for col in df.columns}

    return DatasetPreview(
        id=dataset.id,
        filename=dataset.filename,
        columns=columns,
        preview_rows=[{k: str(v) for k, v in row.items()} for row in preview_rows],
        row_count=len(df),
        missing_summary=missing_summary,
    )


# ---------------------------------------------------------------------------
# POST /api/analysis/run
# ---------------------------------------------------------------------------

@router.post("/run", response_model=AnalysisResultResponse, status_code=status.HTTP_201_CREATED)
async def run_analysis(
    body: RunAnalysisRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> AnalysisResult:
    dataset = await db.get(Dataset, body.dataset_id)
    if dataset is None or dataset.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    try:
        df = _load_dataframe(dataset.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset file missing on disk")

    try:
        from app.services.analysis import run_analysis as _run
        result_data = _run(df, body.analysis_type, body.params)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {e}",
        )

    ar = AnalysisResult(
        dataset_id=dataset.id,
        analysis_type=body.analysis_type,
        parameters=body.params,
        results={k: v for k, v in result_data.items() if k != "chart_data"},
        chart_data=result_data.get("chart_data"),
    )
    db.add(ar)
    await db.flush()
    return ar


# ---------------------------------------------------------------------------
# GET /api/analysis/results/{id}
# ---------------------------------------------------------------------------

@router.get("/results/{result_id}", response_model=AnalysisResultResponse)
async def get_result(
    result_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> AnalysisResult:
    ar = await db.get(AnalysisResult, result_id)
    if ar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")

    # Verify ownership via dataset
    dataset = await db.get(Dataset, ar.dataset_id)
    if dataset is None or dataset.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return ar


# ---------------------------------------------------------------------------
# POST /api/analysis/interpret
# ---------------------------------------------------------------------------

@router.post("/interpret")
async def interpret_results(
    body: InterpretRequest,
    current_user: CurrentUser,
) -> dict:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ANTHROPIC_API_KEY not configured",
        )

    import anthropic as _anthropic

    system_prompt = (
        "You are a biostatistician and epidemiologist. "
        "Interpret the provided statistical results in plain language suitable for the "
        "Results and Discussion sections of a peer-reviewed health research paper. "
        "Be precise: report exact p-values, confidence intervals, effect sizes, and degrees of freedom. "
        "Comment on clinical or public health significance, not just statistical significance. "
        "Identify any notable limitations (e.g., small sample size, multiple testing). "
        "Write 2–4 paragraphs in clear academic English. Do NOT repeat the raw numbers verbatim — synthesize them."
    )

    var_context = ""
    if body.variable_names:
        var_context = f"\nVariables involved: {', '.join(body.variable_names)}"

    user_msg = (
        f"Analysis type: {body.analysis_type}\n"
        f"{var_context}\n\n"
        f"Results JSON:\n{json.dumps(body.results_json, indent=2)}"
    )

    client = _anthropic.AsyncAnthropic(api_key=api_key)
    stream = client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=1200,
        thinking={"type": "adaptive"},
        system=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user_msg}],
    )
    async with stream as s:
        message = await s.get_final_message()

    interpretation = "".join(b.text for b in message.content if hasattr(b, "text"))

    return {
        "analysis_type": body.analysis_type,
        "interpretation": interpretation.strip(),
        "tokens_used": {
            "input": message.usage.input_tokens,
            "output": message.usage.output_tokens,
            "cache_read": getattr(message.usage, "cache_read_input_tokens", 0),
        },
    }
