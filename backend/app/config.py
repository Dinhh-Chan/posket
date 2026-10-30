"""Runtime settings, read from environment variables (all optional in development)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEV_SECRET = "posecam-development-secret-do-not-use-in-production"
TOKEN_LIFETIME_DAYS = 30

DetectorMode = Literal["mediapipe", "off"]


@dataclass(frozen=True)
class Settings:
    data_dir: Path = BACKEND_DIR / "var"
    models_dir: Path = BACKEND_DIR / "models"
    secret: str = DEV_SECRET
    secret_is_default: bool = True
    detector: DetectorMode = "mediapipe"
    token_lifetime_days: int = TOKEN_LIFETIME_DAYS
    bcrypt_rounds: int = 12
    # Start loading the detector in the background at startup so the first /analyze is fast.
    detector_warmup: bool = True
    cors_origins: tuple[str, ...] = field(default=("*",))

    @property
    def database_path(self) -> Path:
        return self.data_dir / "posecam.db"

    @property
    def photos_dir(self) -> Path:
        return self.data_dir / "photos"

    @property
    def avatars_dir(self) -> Path:
        return self.data_dir / "avatars"

    @classmethod
    def from_env(cls) -> Settings:
        secret = os.environ.get("POSECAM_SECRET", "")
        detector = os.environ.get("POSECAM_DETECTOR", "mediapipe").strip().lower()
        if detector not in ("mediapipe", "off"):
            raise ValueError(f"POSECAM_DETECTOR must be 'mediapipe' or 'off', got {detector!r}")
        return cls(
            data_dir=_path_env("POSECAM_DATA_DIR", BACKEND_DIR / "var"),
            models_dir=_path_env("POSECAM_MODELS_DIR", BACKEND_DIR / "models"),
            secret=secret or DEV_SECRET,
            secret_is_default=not secret,
            detector=detector,  # type: ignore[arg-type]  # validated above
            bcrypt_rounds=int(os.environ.get("POSECAM_BCRYPT_ROUNDS", "12")),
        )


def _path_env(name: str, default: Path) -> Path:
    value = os.environ.get(name, "").strip()
    return Path(value).expanduser().resolve() if value else default
