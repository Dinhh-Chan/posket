"""Registration and login."""

from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.deps import AppSettings, DbSession
from app.errors import ApiError
from app.models import User
from app.schemas import AuthOut, LoginIn, RegisterIn, user_out
from app.security import create_token, hash_password, verify_password
from app.validation import (
    normalize_username,
    validate_display_name,
    validate_password,
    validate_username,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@lru_cache(maxsize=4)
def _dummy_hash(rounds: int) -> str:
    """Checked against when the username does not exist, so both failures take as long."""
    return hash_password("posecam-timing-guard", rounds)


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DbSession, settings: AppSettings) -> AuthOut:
    username = validate_username(body.username)
    password = validate_password(body.password)
    display_name = validate_display_name(body.display_name or username)
    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise ApiError("username_taken")
    user = User(
        username=username,
        display_name=display_name,
        password_hash=hash_password(password, settings.bcrypt_rounds),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:  # concurrent registration of the same name
        db.rollback()
        raise ApiError("username_taken") from exc
    return AuthOut(
        token=create_token(user.id, settings.secret, settings.token_lifetime_days),
        user=user_out(user),
    )


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, db: DbSession, settings: AppSettings) -> AuthOut:
    user = db.scalar(select(User).where(User.username == normalize_username(body.username)))
    stored_hash = user.password_hash if user else _dummy_hash(settings.bcrypt_rounds)
    password_ok = verify_password(body.password, stored_hash)
    if user is None or not password_ok:
        raise ApiError("invalid_credentials")
    return AuthOut(
        token=create_token(user.id, settings.secret, settings.token_lifetime_days),
        user=user_out(user),
    )
