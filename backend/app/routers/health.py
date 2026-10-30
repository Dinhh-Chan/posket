"""Liveness and detector status."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import get_detector
from app.detector import Detector
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(detector: Annotated[Detector, Depends(get_detector)]) -> HealthOut:
    return HealthOut(status="ok", detector="mediapipe" if detector.available() else "unavailable")
