"""Where photo and avatar JPEGs live on disk."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

from app.config import Settings

logger = logging.getLogger(__name__)


def photo_path(settings: Settings, photo_id: int) -> Path:
    return settings.photos_dir / f"{photo_id}.jpg"


def avatar_path(settings: Settings, user_id: int) -> Path:
    return settings.avatars_dir / f"{user_id}.jpg"


def ensure_dirs(settings: Settings) -> None:
    for directory in (settings.data_dir, settings.photos_dir, settings.avatars_dir):
        directory.mkdir(parents=True, exist_ok=True)


def write_atomic(path: Path, data: bytes) -> None:
    """Write via a temp file + rename so readers never see a half-written JPEG."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.chmod(tmp_name, 0o644)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def remove(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("could not delete %s", path, exc_info=True)
