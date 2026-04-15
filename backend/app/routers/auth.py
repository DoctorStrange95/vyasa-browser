from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserRole

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SECRET_KEY: str = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

# ---------------------------------------------------------------------------
# Password hashing  (bcrypt via passlib)
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Refresh-token helpers
#
# Refresh tokens are high-entropy random strings, not user-chosen passwords,
# so SHA-256 (fast, collision-resistant) is the right primitive here.
# bcrypt is reserved for the low-entropy password field.
# ---------------------------------------------------------------------------

def _sha256(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _new_refresh_token() -> tuple[str, str]:
    """Return ``(raw, sha256_hex)``. Persist the hash; send the raw value."""
    raw = secrets.token_urlsafe(48)
    return raw, _sha256(raw)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_access_token(token: str) -> dict:
    """Decode and validate an access JWT. Raises 401 on any failure."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    institution: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    institution: str | None
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Reusable dependency: resolve Bearer token → User row
# ---------------------------------------------------------------------------

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(_oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    payload = _decode_access_token(token)
    result = await db.execute(select(User).where(User.id == int(payload["sub"])))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# Convenience alias — use as a type annotation on protected route parameters.
CurrentUser = Annotated[User, Depends(get_current_user)]

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/auth", tags=["auth"])


# ------------------------------------------------------------------
# POST /auth/register
# ------------------------------------------------------------------

@router.post(
    "/register",
    response_model=TokenPairResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account and receive tokens",
)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPairResponse:
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    raw_refresh, hashed_refresh = _new_refresh_token()

    user = User(
        email=body.email,
        name=body.name,
        institution=body.institution,
        password_hash=hash_password(body.password),
        refresh_token_hash=hashed_refresh,
        refresh_token_expires_at=(
            datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        ),
    )
    db.add(user)
    await db.flush()  # writes the row and populates user.id before we encode the JWT

    return TokenPairResponse(
        access_token=_create_access_token(user),
        refresh_token=raw_refresh,
    )


# ------------------------------------------------------------------
# POST /auth/login
# ------------------------------------------------------------------
# Uses OAuth2PasswordRequestForm so the endpoint is compatible with
# the OpenAPI "Authorize" button (sends username + password as form data).
# Clients should pass the email address in the `username` field.
# ------------------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenPairResponse,
    summary="Authenticate and receive tokens",
)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPairResponse:
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()

    # Constant-time failure path: always call verify_password even when the
    # user doesn't exist to avoid a timing-based user-enumeration attack.
    dummy_hash = "$2b$12$OFRMJOGMiCTW7VZHbO.cT.LYxKrLBJFiDRoELT3vOYMhpM9K2Qh9u"
    password_ok = verify_password(
        form.password,
        user.password_hash if user else dummy_hash,
    )
    if user is None or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_refresh, hashed_refresh = _new_refresh_token()
    user.refresh_token_hash = hashed_refresh
    user.refresh_token_expires_at = (
        datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )

    return TokenPairResponse(
        access_token=_create_access_token(user),
        refresh_token=raw_refresh,
    )


# ------------------------------------------------------------------
# GET /auth/me
# ------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Return the authenticated user's profile",
)
async def me(current_user: CurrentUser) -> User:
    return current_user


# ------------------------------------------------------------------
# POST /auth/refresh
# ------------------------------------------------------------------
# Refresh tokens are rotated on every use: a new token is issued and
# the old hash is overwritten.  Presenting a previously-used token
# (whose hash no longer matches) returns 401, which limits the window
# for stolen-token replay attacks.
# ------------------------------------------------------------------

@router.post(
    "/refresh",
    response_model=TokenPairResponse,
    summary="Exchange a refresh token for a new access+refresh token pair",
)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPairResponse:
    hashed = _sha256(body.refresh_token)
    result = await db.execute(
        select(User).where(User.refresh_token_hash == hashed)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    now = datetime.now(timezone.utc)
    if user.refresh_token_expires_at is None or user.refresh_token_expires_at <= now:
        # Clear the expired token so it can't be retried
        user.refresh_token_hash = None
        user.refresh_token_expires_at = None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired — please log in again",
        )

    # Rotate: issue a fresh refresh token and overwrite the stored hash
    raw_refresh, hashed_refresh = _new_refresh_token()
    user.refresh_token_hash = hashed_refresh
    user.refresh_token_expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    return TokenPairResponse(
        access_token=_create_access_token(user),
        refresh_token=raw_refresh,
    )


# ------------------------------------------------------------------
# POST /auth/logout
# ------------------------------------------------------------------

@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Invalidate the current refresh token",
)
async def logout(current_user: CurrentUser) -> None:
    # FastAPI deduplicates get_db per request, so current_user is already
    # tracked by the same session that get_db will commit on exit.
    current_user.refresh_token_hash = None
    current_user.refresh_token_expires_at = None
