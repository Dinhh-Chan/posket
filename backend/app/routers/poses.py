"""The pose library and live analysis of camera snapshots."""

from __future__ import annotations

import logging
import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app import images
from app.deps import CurrentUser, get_detector, read_upload
from app.detector import Detections, Detector
from app.errors import ApiError
from app.pose import classify_scene, get_library, get_pose, match_pose, suggest_poses
from app.schemas import AnalyzeOut

logger = logging.getLogger(__name__)

router = APIRouter(tags=["poses"])

MAX_SUGGESTIONS = 8


@router.get("/poses")
def pose_library() -> dict[str, Any]:
    return get_library()


@router.post("/analyze", response_model=AnalyzeOut)
def analyze(
    file: Annotated[UploadFile, File()],
    _user: CurrentUser,
    detector: Annotated[Detector, Depends(get_detector)],
    mirror: Annotated[bool, Form()] = False,
    pose_id: Annotated[str | None, Form()] = None,
) -> AnalyzeOut:
    started = time.perf_counter()
    try:
        frame = images.prepare_for_analysis(read_upload(file), flip=mirror)
    except images.InvalidImageError as exc:
        raise ApiError("invalid_image") from exc
    decoded = time.perf_counter()

    try:
        found = detector.detect(frame)
    except Exception:  # a detector failure must not break the camera screen
        logger.exception("detection failed")
        found = Detections()
    detected = time.perf_counter()

    scene = classify_scene(found.persons, found.objects)
    suggestions = suggest_poses(scene, found.persons, found.objects, get_library())
    pose = get_pose(pose_id.strip()) if pose_id and pose_id.strip() else None
    match = match_pose(pose, found.persons, found.objects) if pose else None
    finished = time.perf_counter()

    logger.debug(
        "analyze %dx%d: decode %.1f ms, detect %.1f ms, pose logic %.1f ms",
        frame.width,
        frame.height,
        (decoded - started) * 1000,
        (detected - decoded) * 1000,
        (finished - detected) * 1000,
    )
    return AnalyzeOut(
        persons=found.persons,
        objects=found.objects,
        scene=scene,
        suggestions=suggestions[:MAX_SUGGESTIONS],
        match=match,
        elapsed_ms=round((finished - started) * 1000),
    )
