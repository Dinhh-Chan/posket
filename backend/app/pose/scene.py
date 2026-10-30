"""Classify what the camera sees and suggest poses that fit it.

Scene kinds: selfie (one close-up face), solo, duo, group, objects, pet, scenery. Suggestions for
people are ranked mostly by how close each pose already is to how the people are standing (the
easiest pose to strike), then by difficulty; for objects by how many objects the pose expects.
"""

from __future__ import annotations

from app.pose.matching import _visible, match_body, valid_persons

PET_LABELS = {"cat", "dog", "bird", "horse", "sheep", "cow"}
MAX_SUGGESTIONS = 8



def _is_selfie(person: dict) -> bool:
    kp = person["keypoints"]
    if not (_visible(kp, 5) and _visible(kp, 6)):
        return False
    shoulder_w = abs(kp[5][0] - kp[6][0])
    hips_hidden = not (_visible(kp, 11) or _visible(kp, 12))
    return shoulder_w >= 0.33 or (hips_hidden and shoulder_w >= 0.22)


def classify_scene(persons: list[dict], objects: list[dict]) -> dict:
    people = valid_persons(persons)
    things = [o for o in objects if o.get("score", 1.0) >= 0.4]
    pets = [o for o in things if o["label"] in PET_LABELS]
    n = len(people)
    if n == 0:
        kind = "pet" if pets else ("objects" if things else "scenery")
    elif n == 1:
        kind = "selfie" if _is_selfie(people[0]) else "solo"
    elif n == 2:
        kind = "duo"
    else:
        kind = "group"
    return {"kind": kind, "person_count": n, "object_count": len(things)}


def _people_reason(kind: str, n: int) -> str:
    if kind == "selfie":
        return "Khung cận mặt, hợp chụp selfie"
    return f"Phát hiện {n} người"


def suggest_poses(scene: dict, persons: list[dict], objects: list[dict], library: dict) -> list[dict]:
    kind, n = scene["kind"], scene["person_count"]
    poses = library["poses"]
    people = valid_persons(persons)
    things = [o for o in objects if o.get("score", 1.0) >= 0.4]
    ranked: list[tuple[float, dict, str]] = []

    if kind in ("selfie", "solo", "duo", "group"):
        if kind == "group":
            candidates = [p for p in poses if p["category"] == "group" and p["people"] <= n]
        else:
            candidates = [p for p in poses if p["category"] == kind]
        if kind == "solo":
            small = people and (people[0].get("bbox") or [0, 0, 0, 1])[3] < 0.4
            candidates += [p for p in poses if p["id"] == "scene-person-small" and small]
            if any(o["label"] in PET_LABELS for o in things):
                candidates += [p for p in poses if p["id"] == "pet-with-owner"]
        base_reason = _people_reason(kind, n)
        for pose in candidates:
            match = match_body(pose, people)
            similarity = (match["score"] or 0) / 100 if match["status"] in ("ok", "partial") else 0.0
            ease = 1 - (pose["difficulty"] - 1) / 2
            exact = 1.0 if pose["people"] == n or kind != "group" else 0.6
            score = (0.7 * similarity + 0.3 * ease) * exact
            reason = "Gần với dáng hiện tại" if similarity >= 0.72 else base_reason
            if pose["id"] == "pet-with-owner":
                reason, score = "Có thú cưng trong khung", max(score, 0.75)
            ranked.append((score, pose, reason))
    elif kind in ("objects", "pet"):
        count = scene["object_count"]
        for pose in (p for p in poses if p["category"] == kind and p["kind"] == "composition"):
            gap = abs(pose["objects"] - count) if pose["objects"] else 2
            score = max(0.0, 1.0 - 0.25 * gap) * (1 - 0.1 * (pose["difficulty"] - 1))
            if kind == "pet":
                reason = "Phát hiện thú cưng"
            elif pose["objects"] == count:
                reason = f"Có {count} đồ vật trong khung"
            else:
                reason = "Hợp với đồ vật trong khung"
            ranked.append((score, pose, reason))
    else:
        for pose in (p for p in poses if p["category"] == "scenery"):
            score = 0.9 - 0.1 * (pose["difficulty"] - 1) - (0.3 if pose["kind"] == "body" else 0.0)
            ranked.append((score, pose, "Không thấy người, hợp chụp phong cảnh"))

    ranked.sort(key=lambda item: (-item[0], item[1]["difficulty"], item[1]["id"]))
    return [{"pose_id": pose["id"], "score": round(score, 3), "reason": reason}
            for score, pose, reason in ranked[:MAX_SUGGESTIONS]]
