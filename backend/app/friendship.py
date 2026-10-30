"""Friendship queries and updates (two directed rows per friendship)."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Friendship, User


def are_friends(db: Session, user_id: int, other_id: int) -> bool:
    return db.get(Friendship, (user_id, other_id)) is not None


def friend_ids(db: Session, user_id: int, among: Iterable[int] | None = None) -> set[int]:
    query = select(Friendship.friend_id).where(Friendship.user_id == user_id)
    if among is not None:
        query = query.where(Friendship.friend_id.in_(list(among)))
    return set(db.scalars(query))


def list_friends(db: Session, user_id: int) -> list[User]:
    query = (
        select(User)
        .join(Friendship, Friendship.friend_id == User.id)
        .where(Friendship.user_id == user_id)
        .order_by(User.display_name, User.username)
    )
    return list(db.scalars(query))


def make_friends(db: Session, user_id: int, other_id: int) -> None:
    for a, b in ((user_id, other_id), (other_id, user_id)):
        if db.get(Friendship, (a, b)) is None:
            db.add(Friendship(user_id=a, friend_id=b))


def unfriend(db: Session, user_id: int, other_id: int) -> bool:
    result = db.execute(
        delete(Friendship).where(
            ((Friendship.user_id == user_id) & (Friendship.friend_id == other_id))
            | ((Friendship.user_id == other_id) & (Friendship.friend_id == user_id))
        )
    )
    return bool(result.rowcount)  # type: ignore[attr-defined]
