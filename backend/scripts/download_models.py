"""Download the MediaPipe models used by app/detector.py.

Target: backend/models/, or POSECAM_MODELS_DIR when set.

Usage (from backend/):  uv run python scripts/download_models.py [--force]
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

logger = logging.getLogger("download_models")

BACKEND_DIR = Path(__file__).resolve().parent.parent

# file name -> (URL, minimum plausible size in bytes)
MODELS: dict[str, tuple[str, int]] = {
    "pose_landmarker_full.task": (
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
        "pose_landmarker_full/float16/latest/pose_landmarker_full.task",
        1_000_000,
    ),
    "efficientdet_lite0.tflite": (
        "https://storage.googleapis.com/mediapipe-models/object_detector/"
        "efficientdet_lite0/float32/latest/efficientdet_lite0.tflite",
        1_000_000,
    ),
}


def models_dir() -> Path:
    return Path(os.environ.get("POSECAM_MODELS_DIR") or BACKEND_DIR / "models")


def download(url: str, target: Path, min_size: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, suffix=".part", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                shutil.copyfileobj(response, tmp)
        except BaseException:
            tmp_path.unlink(missing_ok=True)
            raise
    size = tmp_path.stat().st_size
    if size < min_size:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError(f"{url} returned only {size} bytes")
    tmp_path.chmod(0o644)
    tmp_path.replace(target)
    logger.info("saved %s (%.1f MB)", target, size / 1e6)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="download even if the file exists")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    target_dir = models_dir()
    failures = 0
    for name, (url, min_size) in MODELS.items():
        target = target_dir / name
        if target.exists() and not args.force:
            logger.info("%s already present", target)
            continue
        logger.info("downloading %s", url)
        try:
            download(url, target, min_size)
        except Exception:  # report every model, then fail
            logger.exception("failed to download %s", name)
            failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
