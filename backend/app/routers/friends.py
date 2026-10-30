"""User search, friends and friend requests."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import select

from app import friendship
from app.db import utcnow
from app.deps import CurrentUser, DbSession
from app.errors import ApiError
from app.models import (
    REQUEST_ACCEPTED,
    REQUEST_DECLINED,
    REQUEST_PENDING,
    FriendRequest,
    User,
)
from app.schemas import (
    FriendRequestIn,
    FriendRequestOut,
    FriendRequestsOut,
    UserOut,
    friend_request_out,
    user_out,
)
from app.validation import normalize_username

router = APIRouter(tags=["friends"])

SEARCH_LIMIT = 20


@router.get("/users/search", response_model=list[UserOut])
def search_users(
    user: CurrentUser, db: DbSession, q: Annotated[str, Query(max_length=40)] = ""
) -> list[UserOut]:
    prefix = normalize_username(q)
    if not prefix:
        return []
    # Range scan instead of LIKE: uses the unique index and treats "_" literally.
    query = (
        select(User)
        .where(User.username >= prefix, User.username < prefix + "￿", User.id != user.id)
        .order_by(User.username)
        .limit(SEARCH_LIMIT)
    )
    return [user_out(u) for u in db.scalars(query)]


@router.get("/friends", response_model=list[UserOut])
def list_friends(user: CurrentUser, db: DbSession) -> list[UserOut]:
    return [user_out(u) for u in friendship.list_friends(db, user.id)]


@router.delete("/friends/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(user_id: int, user: CurrentUser, db: DbSession) -> Response:
    if not friendship.unfriend(db, user.id, user_id):
        raise ApiError("not_found", "Người này không có trong danh sách bạn bè")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/friends/requests", response_model=FriendRequestsOut)
def list_requests(user: CurrentUser, db: DbSession) -> FriendRequestsOut:
    def pending(*conditions: object) -> list[FriendRequestOut]:
        query = (
            select(FriendRequest)
            .where(FriendRequest.status == REQUEST_PENDING, *conditions)  # type: ignore[arg-type]
            .order_by(FriendRequest.id.desc())
        )
        return [friend_request_out(r) for r in db.scalars(query)]

    return FriendRequestsOut(
        incoming=pending(FriendRequest.to_user_id == user.id),
        outgoing=pending(FriendRequest.from_user_id == user.id),
    )


@router.post(
    "/friends/requests", response_model=FriendRequestOut, status_code=status.HTTP_201_CREATED
)
def send_request(body: FriendRequestIn, user: CurrentUser, db: DbSession) -> FriendRequestOut:
    target = db.scalar(select(User).where(User.username == normalize_username(body.username)))
    if target is None:
        raise ApiError("not_found", "Không tìm thấy người dùng này")
    if target.id == user.id:
        raise ApiError("cannot_friend_self")
    if friendship.are_friends(db, user.id, target.id):
        raise ApiError("already_friends")

    def pending_between(sender_id: int, recipient_id: int) -> FriendRequest | None:
        return db.scalar(
            select(FriendRequest).where(
                FriendRequest.from_user_id == sender_id,
                FriendRequest.to_user_id == recipient_id,
                FriendRequest.status == REQUEST_PENDING,
            )
        )

    if pending_between(user.id, target.id) is not None:
        raise ApiError("request_exists")
    reverse = pending_between(target.id, user.id)
    if reverse is not None:  # they already asked me: accept instead
        _accept(db, reverse)
        db.commit()
        return friend_request_out(reverse)

    request = FriendRequest(from_user_id=user.id, to_user_id=target.id)
    db.add(request)
    db.commit()
    db.refresh(request)
    return friend_request_out(request)


def _accept(db: DbSession, request: FriendRequest) -> None:
    request.status = REQUEST_ACCEPTED
    request.responded_at = utcnow()
    friendship.make_friends(db, request.from_user_id, request.to_user_id)


def _request_for_recipient(db: DbSession, request_id: int, user: User) -> FriendRequest:
    request = db.get(FriendRequest, request_id)
    if request is None:
        raise ApiError("not_found", "Không tìm thấy lời mời kết bạn")
    if request.to_user_id != user.id:
        raise ApiError("forbidden", "Chỉ người nhận mới trả lời được lời mời này")
    return request


@router.post("/friends/requests/{request_id}/accept", response_model=FriendRequestOut)
def accept_request(request_id: int, user: CurrentUser, db: DbSession) -> FriendRequestOut:
    request = _request_for_recipient(db, request_id, user)
    if request.status == REQUEST_DECLINED:
        raise ApiError("not_found", "Lời mời này không còn hiệu lực")
    if request.status == REQUEST_PENDING:
        _accept(db, request)
        db.commit()
    return friend_request_out(request)


@router.post("/friends/requests/{request_id}/decline", response_model=FriendRequestOut)
def decline_request(request_id: int, user: CurrentUser, db: DbSession) -> FriendRequestOut:
    request = _request_for_recipient(db, request_id, user)
    if request.status == REQUEST_ACCEPTED:
        raise ApiError("not_found", "Lời mời này không còn hiệu lực")
    if request.status == REQUEST_PENDING:
        request.status = REQUEST_DECLINED
        request.responded_at = utcnow()
        db.commit()
    return friend_request_out(request)
