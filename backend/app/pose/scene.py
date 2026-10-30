"""Scene classification and pose suggestions. Placeholder until the real implementation lands;
signatures and return shapes are final (docs/API.md, "scene" and "suggestions")."""

from __future__ import annotations


def classify_scene(persons: list[dict], objects: list[dict]) -> dict:
    n = len(persons)
    kind = {0: "objects" if objects else "scenery", 1: "solo", 2: "duo"}.get(n, "group")
    return {"kind": kind, "person_count": n, "object_count": len(objects)}


def suggest_poses(scene: dict, persons: list[dict], objects: list[dict], library: dict) -> list[dict]:
    category = {"selfie": "selfie", "solo": "solo", "duo": "duo", "group": "group",
                "objects": "objects", "pet": "pet", "scenery": "scenery"}[scene["kind"]]
    poses = [p for p in library["poses"] if p["category"] == category][:8]
    return [{"pose_id": p["id"], "score": 0.5, "reason": "Gợi ý theo khung hình"} for p in poses]
