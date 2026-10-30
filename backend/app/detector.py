"""People and object detection with MediaPipe Tasks (mediapipe 1.x, CPU, IMAGE running mode).

- Pose Landmarker (BlazePose, 33 landmarks, up to 5 people) → the 17 COCO keypoints used by the
  pose library, each `[x, y, visibility]` in the analysed square (0..1, y down).
- Object Detector (EfficientDet-Lite0, COCO labels) → objects other than people, score ≥ 0.35.

Models are loaded lazily, once, behind a lock; inference is serialised by the same lock. Inside
one call the two models run concurrently (each mediapipe task already owns a native worker
thread, and ctypes releases the GIL), which roughly halves the latency.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from statistics import fmean
from typing import Any, Protocol

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

POSE_MODEL_FILE = "pose_landmarker_full.task"
OBJECT_MODEL_FILE = "efficientdet_lite0.tflite"

# COCO-17 order (docs/API.md "keypoints") → BlazePose landmark index (mediapipe PoseLandmark):
# nose 0, left/right eye 2/5, left/right ear 7/8, shoulders 11/12, elbows 13/14, wrists 15/16,
# hips 23/24, knees 25/26, ankles 27/28. Left/right are the person's own sides, as in the library.
COCO_FROM_BLAZEPOSE: tuple[int, ...] = (
    0,
    2,
    5,
    7,
    8,
    11,
    12,
    13,
    14,
    15,
    16,
    23,
    24,
    25,
    26,
    27,
    28,
)

VISIBLE = 0.5  # landmark confidence needed to count towards a person's bounding box
BBOX_MARGIN = 0.05  # bbox padding, as a share of its longest side (landmarks sit inside the body)


@dataclass
class Detections:
    persons: list[dict[str, Any]] = field(default_factory=list)
    objects: list[dict[str, Any]] = field(default_factory=list)


class Detector(Protocol):
    def available(self) -> bool: ...

    def detect(self, image: Image.Image) -> Detections: ...

    def close(self) -> None: ...


class NullDetector:
    """Used when POSECAM_DETECTOR=off: nothing is ever detected."""

    def available(self) -> bool:
        return False

    def detect(self, image: Image.Image) -> Detections:
        return Detections()

    def close(self) -> None:
        return None


class MediaPipeDetector:
    def __init__(
        self,
        models_dir: Path,
        *,
        num_poses: int = 5,
        min_pose_confidence: float = 0.3,  # 0.5 misses small people in group shots; weak
        # false detections are filtered by app.pose.matching.valid_persons
        min_object_score: float = 0.35,
        max_objects: int = 10,
    ) -> None:
        self.pose_model = models_dir / POSE_MODEL_FILE
        self.object_model = models_dir / OBJECT_MODEL_FILE
        self._num_poses = num_poses
        self._min_pose_confidence = min_pose_confidence
        self._min_object_score = min_object_score
        self._max_objects = max_objects
        self._lock = threading.Lock()
        self._pose: Any = None
        self._objects: Any = None
        self._executor: ThreadPoolExecutor | None = None
        self._broken = False  # a load error other than missing files: do not retry
        self._closed = False
        self._warned_missing = False

    # Loading ---------------------------------------------------------------------------------

    def missing_models(self) -> list[Path]:
        return [p for p in (self.pose_model, self.object_model) if not p.is_file()]

    def available(self) -> bool:
        """True once both models are loaded (loads them on first call)."""
        if self._pose is not None:
            return True
        if self._broken or self._closed:
            return False
        missing = self.missing_models()
        if missing:
            if not self._warned_missing:
                logger.warning(
                    "detector unavailable, missing model files: %s "
                    "(run: uv run python scripts/download_models.py)",
                    ", ".join(str(p) for p in missing),
                )
                self._warned_missing = True
            return False
        with self._lock:
            if self._pose is None and not (self._broken or self._closed):
                self._load()
        return self._pose is not None

    def _load(self) -> None:
        pose = None
        try:
            from mediapipe.tasks.python import BaseOptions, vision

            pose = vision.PoseLandmarker.create_from_options(
                vision.PoseLandmarkerOptions(
                    base_options=BaseOptions(model_asset_path=str(self.pose_model)),
                    running_mode=vision.RunningMode.IMAGE,
                    num_poses=self._num_poses,
                    min_pose_detection_confidence=self._min_pose_confidence,
                    min_pose_presence_confidence=self._min_pose_confidence,
                    output_segmentation_masks=False,
                )
            )
            objects = vision.ObjectDetector.create_from_options(
                vision.ObjectDetectorOptions(
                    base_options=BaseOptions(model_asset_path=str(self.object_model)),
                    running_mode=vision.RunningMode.IMAGE,
                    max_results=self._max_objects,
                    score_threshold=self._min_object_score,
                    category_denylist=["person"],
                )
            )
        except Exception:
            logger.exception("could not load the MediaPipe models; detection is disabled")
            self._broken = True
            if pose is not None:
                pose.close()
            return
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pose")
        self._objects = objects
        self._pose = pose  # last: `available()` reads it without the lock
        logger.info(
            "MediaPipe detector loaded (%s, %s)", self.pose_model.name, self.object_model.name
        )

    def close(self) -> None:
        with self._lock:
            self._closed = True
            for task in (self._pose, self._objects):
                if task is not None:
                    try:
                        task.close()
                    except Exception:  # closing at shutdown must never raise
                        logger.debug("error closing a mediapipe task", exc_info=True)
            if self._executor is not None:
                self._executor.shutdown(wait=True)
            self._pose = self._objects = self._executor = None

    # Inference -------------------------------------------------------------------------------

    def detect(self, image: Image.Image) -> Detections:
        if not self.available():
            return Detections()
        pixels = np.ascontiguousarray(np.asarray(image.convert("RGB"), dtype=np.uint8))
        height, width = pixels.shape[:2]
        with self._lock:
            if self._pose is None or self._executor is None:  # closed meanwhile
                return Detections()
            persons_future = self._executor.submit(self._run_pose, pixels)
            objects = self._run_objects(pixels, width, height)
            persons = persons_future.result()
        return Detections(persons=persons, objects=objects)

    def _run_pose(self, pixels: np.ndarray) -> list[dict[str, Any]]:
        import mediapipe as mp

        result = self._pose.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=pixels))
        persons = [person_from_landmarks(lms) for lms in result.pose_landmarks]
        persons.sort(key=lambda p: p["bbox"][0] + p["bbox"][2] / 2)  # left to right
        return persons

    def _run_objects(self, pixels: np.ndarray, width: int, height: int) -> list[dict[str, Any]]:
        import mediapipe as mp

        result = self._objects.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=pixels))
        objects = []
        for detection in result.detections:
            if not detection.categories:
                continue
            best = max(detection.categories, key=lambda c: c.score or 0.0)
            label = best.category_name or best.display_name
            if not label or label == "person" or (best.score or 0.0) < self._min_object_score:
                continue
            box = detection.bounding_box
            x0, y0 = _clip(box.origin_x / width), _clip(box.origin_y / height)
            x1 = _clip((box.origin_x + box.width) / width)
            y1 = _clip((box.origin_y + box.height) / height)
            objects.append(
                {
                    "label": label,
                    "score": round(float(best.score), 3),
                    "bbox": [round(x0, 4), round(y0, 4), round(x1 - x0, 4), round(y1 - y0, 4)],
                }
            )
        objects.sort(key=lambda o: o["score"], reverse=True)
        return objects


# Conversions (pure, unit-testable) ---------------------------------------------------------------


def _clip(value: float) -> float:
    return min(1.0, max(0.0, float(value)))


def landmark_confidence(landmark: Any) -> float:
    """How sure we are that the landmark is visible *in the frame*.

    BlazePose gives `visibility` (not occluded) and `presence` (inside the image). A landmark
    outside the frame can still have a fairly high visibility, so the smaller of the two is used.
    """
    values = [v for v in (landmark.visibility, landmark.presence) if v is not None]
    return float(min(values)) if values else 1.0


def person_from_landmarks(landmarks: list[Any]) -> dict[str, Any]:
    """Map 33 BlazePose landmarks to the API person: 17 COCO keypoints, bbox and score.

    MediaPipe does not report a per-person score, so `score` is the mean landmark presence (the
    probability that each landmark lies inside the frame): ~1 for a fully framed person, lower
    when parts of the body are cut off.
    """
    keypoints = []
    for index in COCO_FROM_BLAZEPOSE:
        lm = landmarks[index]
        keypoints.append(
            [round(_clip(lm.x), 4), round(_clip(lm.y), 4), round(landmark_confidence(lm), 3)]
        )

    visible = [lm for lm in landmarks if landmark_confidence(lm) >= VISIBLE] or list(landmarks)
    xs = [_clip(lm.x) for lm in visible]
    ys = [_clip(lm.y) for lm in visible]
    margin = BBOX_MARGIN * max(max(xs) - min(xs), max(ys) - min(ys))
    x0, y0 = _clip(min(xs) - margin), _clip(min(ys) - margin)
    x1, y1 = _clip(max(xs) + margin), _clip(max(ys) + margin)

    presences = [lm.presence for lm in landmarks if lm.presence is not None]
    score = fmean(presences) if presences else fmean(landmark_confidence(lm) for lm in landmarks)
    return {
        "keypoints": keypoints,
        "bbox": [round(x0, 4), round(y0, 4), round(x1 - x0, 4), round(y1 - y0, 4)],
        "score": round(float(score), 3),
    }


def create_detector(mode: str, models_dir: Path) -> Detector:
    if mode == "off":
        logger.info("detector disabled (POSECAM_DETECTOR=off)")
        return NullDetector()
    return MediaPipeDetector(models_dir)
