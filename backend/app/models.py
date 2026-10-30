"""ORM models.

Friendships are stored as two directed rows (a→b and b→a) so "my friends" and "is X my friend"
are single indexed lookups on the primary key. Friend requests are kept as history.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow

REQUEST_PENDING = "pending"
REQUEST_ACCEPTED = "accepted"
REQUEST_DECLINED = "declined"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(20), unique=True)
    display_name: Mapped[str] = mapped_column(String(40))
    password_hash: Mapped[str] = mapped_column(String(100))
    avatar_version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class FriendRequest(Base):
    __tablename__ = "friend_requests"
    __table_args__ = (
        Index("ix_friend_requests_to_status", "to_user_id", "status"),
        Index("ix_friend_requests_from_status", "from_user_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(10), default=REQUEST_PENDING)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(default=None)

    from_user: Mapped[User] = relationship(foreign_keys=[from_user_id], lazy="joined")
    to_user: Mapped[User] = relationship(foreign_keys=[to_user_id], lazy="joined")


class Friendship(Base):
    __tablename__ = "friendships"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    friend_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    friend: Mapped[User] = relationship(foreign_keys=[friend_id])


class Photo(Base):
    __tablename__ = "photos"
    __table_args__ = (
        Index("ix_photos_sender_id_id", "sender_id", "id"),
        # Retried uploads carry the same client_id; at most one photo per sender and client_id.
        Index("ux_photos_sender_client_id", "sender_id", "client_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    width: Mapped[int]
    height: Mapped[int]
    caption: Mapped[str | None] = mapped_column(String(60), default=None)
    pose_id: Mapped[str | None] = mapped_column(String(64), default=None)
    client_id: Mapped[str | None] = mapped_column(String(64), default=None)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    sender: Mapped[User] = relationship(lazy="joined")
    recipients: Mapped[list[PhotoRecipient]] = relationship(
        back_populates="photo", cascade="all, delete-orphan", passive_deletes=True
    )
    reactions: Mapped[list[Reaction]] = relationship(
        back_populates="photo",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Reaction.created_at",
    )


class PhotoRecipient(Base):
    __tablename__ = "photo_recipients"
    __table_args__ = (Index("ix_photo_recipients_user_photo", "user_id", "photo_id"),)

    photo_id: Mapped[int] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    photo: Mapped[Photo] = relationship(back_populates="recipients")


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (UniqueConstraint("photo_id", "user_id", name="uq_reactions_photo_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    photo_id: Mapped[int] = mapped_column(ForeignKey("photos.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    emoji: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    photo: Mapped[Photo] = relationship(back_populates="reactions")
    user: Mapped[User] = relationship(lazy="joined")
