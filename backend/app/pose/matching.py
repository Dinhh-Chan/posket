"""Score detected people/objects against a pose. Placeholder until the real implementation lands;
the signature and return shape are final (docs/API.md, "match")."""

from __future__ import annotations


def match_pose(pose: dict, persons: list[dict], objects: list[dict]) -> dict:
    if pose["kind"] == "composition" and not pose["objects"]:
        return {"pose_id": pose["id"], "status": "not_applicable", "score": None, "ready": False,
                "limbs": [], "hints": []}
    if pose["people"] and not persons:
        return {"pose_id": pose["id"], "status": "no_person", "score": None, "ready": False,
                "limbs": [], "hints": ["Đưa người vào khung hình"]}
    return {"pose_id": pose["id"], "status": "ok", "score": 50, "ready": False, "limbs": [], "hints": []}
