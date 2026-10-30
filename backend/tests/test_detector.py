"""Detector: landmark conversion (pure) and the real MediaPipe models on a real photo.

The real-model tests are skipped when the models have not been downloaded
(`uv run python scripts/download_models.py`).
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, replace
from pathlib import Path
from statistics import median

import pytest
from fastapi.testclient import TestClient

from app import images
from app.config import Settings
from app.detector import (
    COCO_FROM_BLAZEPOSE,
    MediaPipeDetector,
    NullDetector,
    create_detector,
    person_from_landmarks,
)
from app.main import create_app
from conftest import FIXTURES, Api

logger = logging.getLogger(__name__)

MODELS_DIR = Settings.from_env().models_dir
PHOTO = (
    FIXTURES / "standing_person.jpg"
)  # one man standing, facing the camera (see fixtures/README.md)

# COCO indices
NOSE, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE = (
    0,
    5,
    6,
    11,
    12,
    13,
    14,
    15,
    16,
)


@dataclass
class Landmark:
    x: float
    y: float
    z: float = 0.0
    visibility: float | None = 1.0
    presence: float | None = 1.0


def test_person_from_landmarks_maps_blazepose_to_coco() -> None:
    landmarks = [Landmark(x=i / 100, y=i / 50) for i in range(33)]
    landmarks[27] = Landmark(x=0.27, y=1.3, visibility=0.6, presence=0.02)  # left ankle off-frame
    person = person_from_landmarks(landmarks)

    assert len(person["keypoints"]) == 17
    for coco_index, blaze_index in enumerate(COCO_FROM_BLAZEPOSE):
        if blaze_index != 27:
            assert person["keypoints"][coco_index][:2] == [
                round(blaze_index / 100, 4),
                round(blaze_index / 50, 4),
            ]
    assert person["keypoints"][L_ANKLE] == [
        0.27,
        1.0,
        0.02,
    ]  # clipped, confidence = min(vis, presence)
    assert person["keypoints"][L_HIP][:2] == [0.23, 0.46]
    x, y, w, h = person["bbox"]
    assert x >= 0 and y >= 0 and x + w <= 1 and y + h <= 1
    assert y + h < 1.0  # the off-frame ankle does not stretch the box to the bottom edge
    assert 0.9 < person["score"] < 1.0


def test_detector_modes(tmp_path: Path) -> None:
    assert isinstance(create_detector("off", tmp_path), NullDetector)
    missing = create_detector("mediapipe", tmp_path)
    assert isinstance(missing, MediaPipeDetector)
    assert missing.available() is False  # no model files in tmp_path
    assert missing.detect(images.prepare_for_analysis(PHOTO.read_bytes())).persons == []


def test_health_reports_unavailable_when_models_are_missing(
    api: Api, settings: Settings, tmp_path: Path
) -> None:
    app = create_app(replace(settings, detector="mediapipe", models_dir=tmp_path))
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok", "detector": "unavailable"}


models_present = (MODELS_DIR / "pose_landmarker_full.task").is_file() and (
    MODELS_DIR / "efficientdet_lite0.tflite"
).is_file()
needs_models = pytest.mark.skipif(
    not models_present, reason=f"MediaPipe models not found in {MODELS_DIR}"
)


@pytest.fixture(scope="module")
def detector() -> MediaPipeDetector:
    real = MediaPipeDetector(MODELS_DIR)
    yield real  # type: ignore[misc]
    real.close()


@needs_models
def test_real_detector_finds_one_standing_person(detector: MediaPipeDetector) -> None:
    frame = images.prepare_for_analysis(PHOTO.read_bytes())
    found = detector.detect(frame)

    assert len(found.persons) == 1
    person = found.persons[0]
    kp = person["keypoints"]
    assert len(kp) == 17 and all(len(p) == 3 and 0 <= p[0] <= 1 and 0 <= p[1] <= 1 for p in kp)
    assert all(p[2] > 0.5 for p in kp), "every keypoint of a fully framed person should be visible"
    y = [p[1] for p in kp]
    # head above shoulders above hips above knees above ankles (y grows downwards)
    assert y[NOSE] < min(y[L_SHOULDER], y[R_SHOULDER])
    assert max(y[L_SHOULDER], y[R_SHOULDER]) < min(y[L_HIP], y[R_HIP])
    assert max(y[L_HIP], y[R_HIP]) < min(y[L_KNEE], y[R_KNEE])
    assert max(y[L_KNEE], y[R_KNEE]) < min(y[L_ANKLE], y[R_ANKLE])
    # he faces the camera, so his left shoulder is on the right of the picture
    assert kp[L_SHOULDER][0] > kp[R_SHOULDER][0]
    # standing tall in the middle of the frame
    bx, _, bw, bh = person["bbox"]
    assert 0.3 < bx + bw / 2 < 0.7 and bh > 0.6 and bh > 2 * bw
    assert person["score"] > 0.8
    assert all(o["label"] != "person" for o in found.objects)


@needs_models
def test_real_detector_mirror_flips_coordinates(detector: MediaPipeDetector) -> None:
    data = PHOTO.read_bytes()
    plain = detector.detect(images.prepare_for_analysis(data)).persons[0]
    mirrored = detector.detect(images.prepare_for_analysis(data, flip=True)).persons[0]
    assert mirrored["keypoints"][NOSE][0] == pytest.approx(
        1 - plain["keypoints"][NOSE][0], abs=0.03
    )
    assert mirrored["keypoints"][NOSE][1] == pytest.approx(plain["keypoints"][NOSE][1], abs=0.03)


@needs_models
def test_analyze_endpoint_with_real_detector(api: Api, settings: Settings) -> None:
    app = create_app(replace(settings, detector="mediapipe", models_dir=MODELS_DIR))
    with TestClient(app) as client:
        assert client.get("/health").json()["detector"] == "mediapipe"
        token = client.post(
            "/auth/register", json={"username": "linh", "password": "secret123"}
        ).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        data = PHOTO.read_bytes()
        timings = []
        for _ in range(5):
            started = time.perf_counter()
            response = client.post(
                "/analyze",
                files={"file": ("frame.jpg", data, "image/jpeg")},
                data={"pose_id": "solo-hand-on-hip"},
                headers=headers,
            )
            timings.append((time.perf_counter() - started) * 1000)
            assert response.status_code == 200
        body = response.json()
        assert len(body["persons"]) == 1
        assert body["scene"]["person_count"] == 1
        assert body["match"]["pose_id"] == "solo-hand-on-hip"
        assert body["match"]["status"] in {"ok", "partial"}
        assert body["elapsed_ms"] < 1000  # generous: the target is < 200 ms on a desktop CPU
        logger.info(
            "/analyze round trip median %.0f ms, server elapsed_ms %d",
            median(timings),
            body["elapsed_ms"],
        )
