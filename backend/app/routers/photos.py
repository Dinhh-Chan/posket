"""Sending photos to friends, the feed, the widget's latest photo and reactions."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app import friendship, images, photo_access, storage
from app.db import utcnow
from app.deps import AppSettings, CurrentUser, DbSession, read_upload
from app.errors import ApiError
from app.models import Photo, PhotoRecipient, Reaction
from app.schemas import FeedOut, PhotoOut, ReactionIn, photo_out
from app.validation import (
    parse_id_list,
    parse_optional_int,
    validate_caption,
    validate_emoji,
    validate_pose_id,
)

router = APIRouter(prefix="/photos", tags=["photos"])


@router.post("", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
def upload_photo(
    file: Annotated[UploadFile, File()],
    user: CurrentUser,
    db: DbSession,
    settings: AppSettings,
    caption: Annotated[str | None, Form()] = None,
    recipient_ids: Annotated[str | None, Form()] = None,
    mirror: Annotated[bool, Form()] = False,
    pose_id: Annotated[str | None, Form()] = None,
) -> PhotoOut:
    clean_caption = validate_caption(caption)
    clean_pose_id = validate_pose_id(pose_id)
    requested = parse_id_list(recipient_ids)
    if requested:
        if set(requested) - friendship.friend_ids(db, user.id, among=requested):
            raise ApiError("forbidden", "Chỉ gửi được ảnh cho bạn bè")
        recipients = requested
    else:
        recipients = sorted(friendship.friend_ids(db, user.id))
        if not recipients:
            raise ApiError("no_recipients")

    try:
        encoded = images.process_photo(read_upload(file), flip=mirror)
    except images.InvalidImageError as exc:
        raise ApiError("invalid_image") from exc

    photo = Photo(
        sender_id=user.id,
        width=encoded.width,
        height=encoded.height,
        caption=clean_caption,
        pose_id=clean_pose_id,
        recipients=[PhotoRecipient(user_id=rid) for rid in recipients],
    )
    db.add(photo)
    db.flush()  # assigns photo.id, used as the file name
    path = storage.photo_path(settings, photo.id)
    try:
        storage.write_atomic(path, encoded.data)
        db.commit()
    except BaseException:
        db.rollback()
        storage.remove(path)
        raise
    return photo_out(photo_access.reload_photo(db, photo.id), user.id)


@router.get("/feed", response_model=FeedOut)
def feed(
    user: CurrentUser,
    db: DbSession,
    before_id: Annotated[
        str | None, Query(description="id of the last photo already shown")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> FeedOut:
    rows = photo_access.feed_page(db, user.id, parse_optional_int(before_id, "before_id"), limit)
    has_more = len(rows) > limit
    items = rows[:limit]
    return FeedOut(
        items=[photo_out(p, user.id) for p in items],
        next_before_id=items[-1].id if has_more and items else None,
    )


@router.get(
    "/latest",
    response_model=PhotoOut,
    responses={204: {"description": "No friend has sent a photo yet"}},
)
def latest(user: CurrentUser, db: DbSession) -> PhotoOut | Response:
    photo = photo_access.latest_from_friends(db, user.id)
    if photo is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return photo_out(photo, user.id)


@router.get("/{photo_id}", response_model=PhotoOut)
def get_photo(photo_id: int, user: CurrentUser, db: DbSession) -> PhotoOut:
    return photo_out(photo_access.get_viewable_photo(db, photo_id, user.id), user.id)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: int, user: CurrentUser, db: DbSession, settings: AppSettings
) -> Response:
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise ApiError("not_found", "Không tìm thấy ảnh")
    if photo.sender_id != user.id:
        raise ApiError("forbidden", "Chỉ người gửi mới xoá được ảnh")
    db.delete(photo)
    db.commit()
    storage.remove(storage.photo_path(settings, photo_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{photo_id}/reactions", response_model=PhotoOut)
def react(photo_id: int, body: ReactionIn, user: CurrentUser, db: DbSession) -> PhotoOut:
    emoji = validate_emoji(body.emoji)
    photo_access.get_viewable_photo(db, photo_id, user.id)
    reaction = db.scalar(
        select(Reaction).where(Reaction.photo_id == photo_id, Reaction.user_id == user.id)
    )
    if reaction is None:
        db.add(Reaction(photo_id=photo_id, user_id=user.id, emoji=emoji))
    else:
        reaction.emoji = emoji
        reaction.created_at = utcnow()
    try:
        db.commit()
    except IntegrityError:  # a concurrent request created it first: replace that one
        db.rollback()
        db.execute(
            update(Reaction)
            .where(Reaction.photo_id == photo_id, Reaction.user_id == user.id)
            .values(emoji=emoji, created_at=utcnow())
        )
        db.commit()
    return photo_out(photo_access.reload_photo(db, photo_id), user.id)


@router.delete("/{photo_id}/reactions", response_model=PhotoOut)
def unreact(photo_id: int, user: CurrentUser, db: DbSession) -> PhotoOut:
    photo_access.get_viewable_photo(db, photo_id, user.id)
    reaction = db.scalar(
        select(Reaction).where(Reaction.photo_id == photo_id, Reaction.user_id == user.id)
    )
    if reaction is not None:
        db.delete(reaction)
        db.commit()
    return photo_out(photo_access.reload_photo(db, photo_id), user.id)
