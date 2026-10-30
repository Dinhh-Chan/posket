"""Authenticated JPEG streaming for photos and avatars."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app import photo_access, storage
from app.deps import AppSettings, CurrentUser, DbSession
from app.errors import ApiError
from app.models import Photo, User

router = APIRouter(prefix="/media", tags=["media"])

_JPEG = "image/jpeg"


@router.get("/photos/{photo_id}", response_class=FileResponse)
def photo_file(
    photo_id: int, user: CurrentUser, db: DbSession, settings: AppSettings
) -> FileResponse:
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise ApiError("not_found", "Không tìm thấy ảnh")
    if not photo_access.can_view(db, photo, user.id):
        raise ApiError("forbidden", "Bạn không xem được ảnh này")
    path = storage.photo_path(settings, photo_id)
    if not path.is_file():
        raise ApiError("not_found", "Không tìm thấy ảnh")
    # A photo never changes once sent, so clients may cache it for good.
    return FileResponse(
        path, media_type=_JPEG, headers={"Cache-Control": "private, max-age=31536000, immutable"}
    )


@router.get("/avatars/{user_id}", response_class=FileResponse)
def avatar_file(
    user_id: int, _user: CurrentUser, db: DbSession, settings: AppSettings
) -> FileResponse:
    owner = db.get(User, user_id)
    path = storage.avatar_path(settings, user_id)
    if owner is None or not owner.avatar_version or not path.is_file():
        raise ApiError("not_found", "Người dùng chưa có ảnh đại diện")
    # URLs carry ?v=<version>, so a new avatar gets a new URL.
    return FileResponse(path, media_type=_JPEG, headers={"Cache-Control": "private, max-age=86400"})
