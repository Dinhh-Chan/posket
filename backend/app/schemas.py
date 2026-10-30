"""Request and response bodies (docs/API.md "Objects") and ORM → response conversion."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models import FriendRequest, Photo, User

# Requests ----------------------------------------------------------------------------------------


class RegisterIn(BaseModel):
    username: str
    password: str
    display_name: str | None = None


class LoginIn(BaseModel):
    username: str
    password: str


class ProfileIn(BaseModel):
    display_name: str


class FriendRequestIn(BaseModel):
    username: str


class ReactionIn(BaseModel):
    emoji: str


# Responses ---------------------------------------------------------------------------------------


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: str | None


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ReactionOut(BaseModel):
    user: UserOut
    emoji: str
    created_at: str


class PhotoOut(BaseModel):
    id: int
    sender: UserOut
    image_url: str
    width: int
    height: int
    caption: str | None
    pose_id: str | None
    created_at: str
    is_mine: bool
    reactions: list[ReactionOut]


class FeedOut(BaseModel):
    items: list[PhotoOut]
    next_before_id: int | None


class FriendRequestOut(BaseModel):
    id: int
    from_user: UserOut
    to_user: UserOut
    status: str
    created_at: str


class FriendRequestsOut(BaseModel):
    incoming: list[FriendRequestOut]
    outgoing: list[FriendRequestOut]


class HealthOut(BaseModel):
    status: str
    detector: str


class DetectedPerson(BaseModel):
    keypoints: list[list[float]]
    bbox: list[float]
    score: float


class DetectedObject(BaseModel):
    label: str
    score: float
    bbox: list[float]


class SceneOut(BaseModel):
    model_config = ConfigDict(extra="allow")

    kind: str
    person_count: int
    object_count: int


class AnalyzeOut(BaseModel):
    persons: list[DetectedPerson]
    objects: list[DetectedObject]
    scene: SceneOut
    # Shapes owned by app.pose (docs/API.md): passed through unchanged.
    suggestions: list[dict[str, Any]]
    match: dict[str, Any] | None
    elapsed_ms: int


# Conversion --------------------------------------------------------------------------------------


def iso(value: datetime) -> str:
    """Stored datetimes are naive UTC → `2026-10-30T15:04:05Z`."""
    return value.replace(microsecond=0).isoformat() + "Z"


def user_out(user: User) -> UserOut:
    avatar = f"/media/avatars/{user.id}?v={user.avatar_version}" if user.avatar_version else None
    return UserOut(
        id=user.id, username=user.username, display_name=user.display_name, avatar_url=avatar
    )


def photo_out(photo: Photo, viewer_id: int) -> PhotoOut:
    return PhotoOut(
        id=photo.id,
        sender=user_out(photo.sender),
        image_url=f"/media/photos/{photo.id}",
        width=photo.width,
        height=photo.height,
        caption=photo.caption,
        pose_id=photo.pose_id,
        created_at=iso(photo.created_at),
        is_mine=photo.sender_id == viewer_id,
        reactions=[
            ReactionOut(user=user_out(r.user), emoji=r.emoji, created_at=iso(r.created_at))
            for r in photo.reactions
        ],
    )


def friend_request_out(request: FriendRequest) -> FriendRequestOut:
    return FriendRequestOut(
        id=request.id,
        from_user=user_out(request.from_user),
        to_user=user_out(request.to_user),
        status=request.status,
        created_at=iso(request.created_at),
    )
