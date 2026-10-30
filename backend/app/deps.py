"""FastAPI dependencies shared by the routers."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.detector import Detector
from app.errors import ApiError
from app.images import MAX_UPLOAD_BYTES
from app.models import User
from app.security import decode_token

_bearer = HTTPBearer(auto_error=False, description="Token from /auth/register or /auth/login")


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_detector(request: Request) -> Detector:
    return request.app.state.detector


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError("unauthorized")
    user_id = decode_token(credentials.credentials, settings.secret)
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise ApiError("unauthorized")
    return user


DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def read_upload(file: UploadFile) -> bytes:
    """Read an uploaded file fully, refusing anything over the size limit."""
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError("invalid_image", f"Ảnh quá lớn (tối đa {MAX_UPLOAD_BYTES // 2**20} MB)")
    if not data:
        raise ApiError("invalid_image")
    return data
