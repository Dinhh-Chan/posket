"""Password hashing (bcrypt) and access tokens (HS256 JWT)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

ALGORITHM = "HS256"
BCRYPT_MAX_BYTES = 72  # bcrypt ignores (bcrypt>=5: rejects) anything longer


def hash_password(password: str, rounds: int = 12) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=rounds)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode()
    if len(encoded) > BCRYPT_MAX_BYTES:
        return False
    try:
        return bcrypt.checkpw(encoded, password_hash.encode())
    except ValueError:
        return False


def create_token(user_id: int, secret: str, lifetime_days: int) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(days=lifetime_days)}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_token(token: str, secret: str) -> int | None:
    """Return the user id in a valid, unexpired token, else None."""
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"require": ["exp"]})
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None
