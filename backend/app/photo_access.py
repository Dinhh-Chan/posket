"""Loading photos together with who may see them."""

from __future__ import annotations

from sqlalchemy import select, union
from sqlalchemy.orm import Session, selectinload

from app.errors import ApiError
from app.models import Friendship, Photo, PhotoRecipient, Reaction


def _with_details(query):  # type: ignore[no-untyped-def]
    return query.options(selectinload(Photo.reactions).joinedload(Reaction.user))


def is_recipient(db: Session, photo_id: int, user_id: int) -> bool:
    return db.get(PhotoRecipient, (photo_id, user_id)) is not None


def can_view(db: Session, photo: Photo, user_id: int) -> bool:
    return photo.sender_id == user_id or is_recipient(db, photo.id, user_id)


def get_viewable_photo(db: Session, photo_id: int, user_id: int) -> Photo:
    """The photo if `user_id` sent or received it; 404 if it does not exist, else 403."""
    photo = db.scalar(_with_details(select(Photo).where(Photo.id == photo_id)))
    if photo is None:
        raise ApiError("not_found", "Không tìm thấy ảnh")
    if not can_view(db, photo, user_id):
        raise ApiError("forbidden", "Bạn không xem được ảnh này")
    return photo


def reload_photo(db: Session, photo_id: int) -> Photo:
    db.expire_all()
    photo = db.scalar(_with_details(select(Photo).where(Photo.id == photo_id)))
    assert photo is not None
    return photo


def feed_page(db: Session, user_id: int, before_id: int | None, limit: int) -> list[Photo]:
    """Photos the user sent or received, newest first, `limit + 1` rows to detect a next page."""
    visible_ids = union(
        select(Photo.id.label("id")).where(Photo.sender_id == user_id),
        select(PhotoRecipient.photo_id.label("id")).where(PhotoRecipient.user_id == user_id),
    ).subquery()
    query = select(Photo).join(visible_ids, visible_ids.c.id == Photo.id)
    if before_id is not None:
        query = query.where(Photo.id < before_id)
    query = query.order_by(Photo.id.desc()).limit(limit + 1)
    return list(db.scalars(_with_details(query)).unique())


def latest_from_friends(db: Session, user_id: int) -> Photo | None:
    """Newest photo sent to the user by someone who is currently their friend (the widget)."""
    query = (
        select(Photo)
        .join(PhotoRecipient, PhotoRecipient.photo_id == Photo.id)
        .join(
            Friendship,
            (Friendship.user_id == user_id) & (Friendship.friend_id == Photo.sender_id),
        )
        .where(PhotoRecipient.user_id == user_id)
        .order_by(Photo.id.desc())
        .limit(1)
    )
    return db.scalar(_with_details(query))
