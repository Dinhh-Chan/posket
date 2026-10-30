"""GET /poses and POST /analyze (with a fake detector; the real one is in test_detector_real.py)."""

from __future__ import annotations

import io
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.deps import get_detector
from app.detector import Detections
from app.pose import get_library, get_pose
from conftest import Api, make_image


def test_pose_library_needs_no_auth(client: TestClient) -> None:
    response = client.get("/poses")
    assert response.status_code == 200
    library = response.json()
    assert library == get_library()
    assert library["version"] == 1
    assert len(library["keypoints"]) == 17
    assert library["keypoints"][0] == "nose" and library["keypoints"][16] == "right_ankle"
    assert library["poses"] and {"id", "name", "category", "kind"} <= library["poses"][0].keys()


def person_from_template(pose_id: str) -> dict[str, Any]:
    template = get_pose(pose_id)
    assert template is not None
    keypoints = [
        [p[0], p[1], 0.98] if p else [0.0, 0.0, 0.0] for p in template["persons"][0]["keypoints"]
    ]
    xs = [k[0] for k in keypoints if k[2]]
    ys = [k[1] for k in keypoints if k[2]]
    return {
        "keypoints": keypoints,
        "bbox": [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)],
        "score": 0.97,
    }


class FakeDetector:
    def __init__(self, persons: list[dict[str, Any]], objects: list[dict[str, Any]]) -> None:
        self.persons, self.objects = persons, objects
        self.frames: list[Image.Image] = []

    def available(self) -> bool:
        return True

    def detect(self, image: Image.Image) -> Detections:
        self.frames.append(image)
        return Detections(persons=list(self.persons), objects=list(self.objects))

    def close(self) -> None:
        return None


@pytest.fixture
def fake(app: FastAPI) -> FakeDetector:
    detector = FakeDetector(
        persons=[person_from_template("solo-hand-on-hip")],
        objects=[{"label": "cup", "score": 0.81, "bbox": [0.1, 0.6, 0.1, 0.12]}],
    )
    app.dependency_overrides[get_detector] = lambda: detector
    return detector


def analyze(
    client: TestClient, headers: dict[str, str], image: bytes | None = None, **form: str
) -> Any:
    files = {
        "file": ("frame.jpg", image if image is not None else make_image(800, 600), "image/jpeg")
    }
    return client.post("/analyze", files=files, data=form, headers=headers)


def test_analyze_response_shape(api: Api, client: TestClient, fake: FakeDetector) -> None:
    me = api.register("linh")
    response = analyze(client, me.headers)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"persons", "objects", "scene", "suggestions", "match", "elapsed_ms"}

    (person,) = body["persons"]
    assert len(person["keypoints"]) == 17 and all(len(k) == 3 for k in person["keypoints"])
    assert len(person["bbox"]) == 4 and 0 <= person["score"] <= 1
    assert body["objects"] == [{"label": "cup", "score": 0.81, "bbox": [0.1, 0.6, 0.1, 0.12]}]
    assert body["scene"]["person_count"] == 1
    assert body["scene"]["kind"] in {"selfie", "solo", "duo", "group", "objects", "pet", "scenery"}
    assert 1 <= len(body["suggestions"]) <= 8
    for suggestion in body["suggestions"]:
        assert {"pose_id", "score", "reason"} <= suggestion.keys()
        assert get_pose(suggestion["pose_id"]) is not None
    assert body["match"] is None
    assert isinstance(body["elapsed_ms"], int) and body["elapsed_ms"] >= 0

    frame = fake.frames[-1]
    assert frame.size == (600, 600)  # centre square of the 800x600 snapshot


def test_analyze_with_pose(api: Api, client: TestClient, fake: FakeDetector) -> None:
    me = api.register("linh")
    match = analyze(client, me.headers, pose_id="solo-hand-on-hip").json()["match"]
    assert match["pose_id"] == "solo-hand-on-hip"
    assert match["status"] in {"ok", "no_person", "wrong_count", "partial", "not_applicable"}
    assert {"score", "ready", "limbs", "hints"} <= match.keys()
    assert match["status"] == "ok" and match["score"] >= 85  # the detected person is the template

    assert analyze(client, me.headers, pose_id="no-such-pose").json()["match"] is None


def test_analyze_mirror_and_downscale(api: Api, client: TestClient, fake: FakeDetector) -> None:
    me = api.register("linh")
    img = Image.new("RGB", (1600, 1200), (230, 20, 20))
    img.paste((20, 20, 230), (800, 0, 1600, 1200))  # right half blue
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")

    analyze(client, me.headers, buffer.getvalue(), mirror="true")
    frame = fake.frames[-1]
    assert frame.size == (640, 640)
    left, right = frame.getpixel((20, 320)), frame.getpixel((620, 320))
    assert left[2] > 150 and right[0] > 150  # blue on the left after mirroring


def test_analyze_without_detector_reports_scenery(api: Api, client: TestClient) -> None:
    me = api.register("linh")
    body = analyze(client, me.headers, pose_id="solo-hand-on-hip").json()
    assert body["persons"] == [] and body["objects"] == []
    assert body["scene"] == {"kind": "scenery", "person_count": 0, "object_count": 0}
    assert body["match"]["status"] == "no_person"


def test_analyze_errors(api: Api, client: TestClient, fake: FakeDetector) -> None:
    assert analyze(client, {}).status_code == 401
    me = api.register("linh")
    bad = analyze(client, me.headers, b"not a jpeg")
    assert bad.status_code == 400 and bad.json()["detail"] == "invalid_image"
