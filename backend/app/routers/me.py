"""The signed-in user's profile and avatar."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, UploadFile

from app import images, storage
from app.deps import AppSettings, CurrentUser, DbSession, read_upload
from app.errors import ApiError
from app.schemas import ProfileIn, UserOut, user_out
from app.validation import validate_display_name

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserOut)
def get_me(user: CurrentUser) -> UserOut:
    return user_out(user)


@router.patch("", response_model=UserOut)
def update_me(body: ProfileIn, user: CurrentUser, db: DbSession) -> UserOut:
    user.display_name = validate_display_name(body.display_name)
    db.commit()
    return user_out(user)


@router.post("/avatar", response_model=UserOut)
def upload_avatar(
    file: Annotated[UploadFile, File()],
    user: CurrentUser,
    db: DbSession,
    settings: AppSettings,
) -> UserOut:
    try:
        avatar = images.process_avatar(read_upload(file))
    except images.InvalidImageError as exc:
        raise ApiError("invalid_image") from exc
    storage.write_atomic(storage.avatar_path(settings, user.id), avatar.data)
    user.avatar_version += 1
    db.commit()
    return user_out(user)
