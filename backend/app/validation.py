"""Field rules for user input (docs/API.md); each raises ApiError with a Vietnamese message."""

from __future__ import annotations

import re

from app.errors import ApiError
from app.security import BCRYPT_MAX_BYTES

USERNAME_RE = re.compile(r"[a-z0-9_.]{3,20}")
PASSWORD_MIN = 6
DISPLAY_NAME_MAX = 40
CAPTION_MAX = 60
EMOJI_MAX = 32
POSE_ID_MAX = 64


def normalize_username(raw: str) -> str:
    return raw.strip().lower()


def validate_username(raw: str) -> str:
    username = normalize_username(raw)
    if not USERNAME_RE.fullmatch(username):
        raise ApiError("invalid_username")
    return username


def validate_password(password: str) -> str:
    if len(password) < PASSWORD_MIN:
        raise ApiError("validation_error", f"Mật khẩu phải có ít nhất {PASSWORD_MIN} ký tự")
    if len(password.encode()) > BCRYPT_MAX_BYTES:
        raise ApiError("validation_error", "Mật khẩu quá dài")
    return password


def validate_display_name(raw: str) -> str:
    name = " ".join(raw.split())
    if not name or len(name) > DISPLAY_NAME_MAX:
        raise ApiError("validation_error", f"Tên hiển thị gồm 1–{DISPLAY_NAME_MAX} ký tự")
    return name


def validate_caption(raw: str | None) -> str | None:
    caption = (raw or "").strip()
    if len(caption) > CAPTION_MAX:
        raise ApiError("caption_too_long")
    return caption or None


def validate_emoji(raw: str) -> str:
    emoji = raw.strip()
    if not emoji or len(emoji) > EMOJI_MAX:
        raise ApiError("validation_error", "Biểu tượng cảm xúc không hợp lệ")
    return emoji


def validate_pose_id(raw: str | None) -> str | None:
    pose_id = (raw or "").strip()
    if len(pose_id) > POSE_ID_MAX:
        raise ApiError("validation_error", "pose_id không hợp lệ")
    return pose_id or None


def parse_id_list(raw: str | None) -> list[int]:
    """`"3, 5,8"` → [3, 5, 8] (order kept, duplicates dropped); empty → []."""
    ids: list[int] = []
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        if not (part.isascii() and part.isdigit()):
            raise ApiError("validation_error", "Danh sách người nhận không hợp lệ")
        value = int(part)
        if value not in ids:
            ids.append(value)
    return ids


def parse_optional_int(raw: str | None, field: str) -> int | None:
    """Query values such as `before_id=` (empty means absent)."""
    value = (raw or "").strip()
    if not value:
        return None
    if not (value.isascii() and value.isdigit()):
        raise ApiError("validation_error", f"Giá trị {field} không hợp lệ")
    return int(value)
