"""Pose library, scene classification, suggestions and pose matching.

Owned by the pose track (see docs/PLAN.md). The rest of the backend only uses these four
functions; inputs and outputs follow docs/API.md:

    persons: [{"keypoints": [[x, y, visibility] * 17], "bbox": [x, y, w, h], "score": float}]
    objects: [{"label": str, "score": float, "bbox": [x, y, w, h]}]   (no "person" entries)

All coordinates are in the displayed square frame (0..1, y down).
"""

from app.pose.library import get_library, get_pose
from app.pose.matching import match_pose
from app.pose.scene import classify_scene, suggest_poses

__all__ = ["get_library", "get_pose", "match_pose", "classify_scene", "suggest_poses"]
