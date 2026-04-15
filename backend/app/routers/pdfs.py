"""
PDF document router.

POST   /api/pdfs            — upload a PDF (multipart)
GET    /api/pdfs            — list user's PDFs
DELETE /api/pdfs/{id}       — delete a PDF
POST   /api/pdfs/{id}/chat  — chat with a PDF (Q&A via Claude)
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import PdfDocument
from app.routers.auth import CurrentUser

router = APIRouter(prefix="/api/pdfs", tags=["pdfs"])

# Where uploaded PDFs are stored.  Override with PDF_UPLOAD_DIR env var.
_UPLOAD_DIR = Path(os.getenv("PDF_UPLOAD_DIR", "uploads/pdfs"))


def _ensure_upload_dir(user_id: int) -> Path:
    d = _UPLOAD_DIR / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _extract_text(file_path: Path) -> tuple[str, int]:
    """Return (extracted_text, page_count).  Falls back gracefully."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n\n".join(pages), len(reader.pages)
    except Exception:
        return "", 0


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PdfOut(BaseModel):
    id: int
    filename: str
    page_count: int | None
    uploaded_at: str
    paper_id: int | None = None

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []   # [{role: "user"|"assistant", content: "..."}]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=PdfOut, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> PdfDocument:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are accepted")

    upload_dir = _ensure_upload_dir(current_user.id)
    safe_name = f"{uuid.uuid4().hex}_{file.filename.replace(' ', '_')}"
    dest = upload_dir / safe_name

    content = await file.read()
    dest.write_bytes(content)

    extracted, pages = _extract_text(dest)

    doc = PdfDocument(
        user_id=current_user.id,
        filename=file.filename,
        file_path=str(dest),
        extracted_text=extracted[:200_000],  # cap at 200 k chars
        page_count=pages,
    )
    db.add(doc)
    await db.flush()
    return doc


@router.get("", response_model=list[PdfOut])
async def list_pdfs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> list[PdfDocument]:
    result = await db.execute(
        select(PdfDocument)
        .where(PdfDocument.user_id == current_user.id)
        .order_by(PdfDocument.uploaded_at.desc())
    )
    return list(result.scalars().all())


@router.delete("/{pdf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pdf(
    pdf_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> None:
    doc = await db.get(PdfDocument, pdf_id)
    if doc is None or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")
    # Remove file from disk
    try:
        Path(doc.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    await db.delete(doc)


@router.post("/{pdf_id}/chat")
async def chat_with_pdf(
    pdf_id: int,
    body: ChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
) -> dict:
    """Ask a question about a PDF using Claude with the full text as context."""
    doc = await db.get(PdfDocument, pdf_id)
    if doc is None or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")

    if not doc.extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text could be extracted from this PDF. Try a text-based (non-scanned) PDF.",
        )

    import anthropic as _anthropic
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="ANTHROPIC_API_KEY not configured")

    # Trim text to ~80k tokens worth (~320k chars)
    context_text = doc.extracted_text[:320_000]

    system_prompt = (
        f"You are a research assistant helping analyse a PDF document titled '{doc.filename}'. "
        "Answer questions accurately using only the provided document content. "
        "If the answer is not in the document, say so clearly. "
        "Be concise and cite page-relevant sections when possible.\n\n"
        "DOCUMENT CONTENT:\n"
        "---\n"
        f"{context_text}\n"
        "---"
    )

    messages: list[dict] = []
    for h in body.history[-10:]:  # last 10 turns for context
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.question})

    client = _anthropic.AsyncAnthropic(api_key=api_key)
    stream = client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=1000,
        system=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
    )
    async with stream as s:
        message = await s.get_final_message()

    answer = "".join(b.text for b in message.content if hasattr(b, "text"))
    return {"answer": answer.strip(), "pdf_id": pdf_id}
