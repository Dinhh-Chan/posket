"""Score detected people (or objects) against a pose from the library.

Body poses are compared limb by limb on screen-space directions: for every limb present in the
template (e.g. left upper arm = left shoulder → left elbow) the angle between the template vector
and the detected vector gives a 0..1 limb score. Directions do not depend on where the person
stands or how big they are, so a separate framing term handles position and size.

Detectors label left/right from the body's appearance; on a mirrored preview that labelling is
the opposite of what the user sees. Each person is therefore scored with its labels as given and
with left/right swapped, and the better one is kept. Because limb directions stay in screen space,
the swap does not make a mirrored pose (arm raised on the wrong side of the screen) look right.

Composition poses with targets are scored by how close detected objects are to the targets.
Everything is in the displayed square frame: x, y in 0..1, y pointing down.
"""

from __future__ import annotations

import math
from itertools import combinations, permutations

from app.pose.library import get_library

VISIBLE = 0.5  # minimum detector visibility for a keypoint to count
PERFECT_DEG, ZERO_DEG = 10.0, 70.0  # limb score is 1 below PERFECT_DEG, 0 above ZERO_DEG
OK_DEG = 25.0  # a limb is drawn green when within this angle
READY_SCORE = 85
MIN_COVERAGE = 0.6  # share of the template's limb weight that must be visible for status "ok"
MIN_FRAMING = 0.55  # position/size must be roughly right before the pose counts as ready
POSE_SHARE = 0.85  # final score = POSE_SHARE * limb score + (1 - POSE_SHARE) * framing

LIMB_WEIGHTS = {
    "left_upper_arm": 1.0, "left_forearm": 1.0, "right_upper_arm": 1.0, "right_forearm": 1.0,
    "left_thigh": 0.9, "left_shin": 0.7, "right_thigh": 0.9, "right_shin": 0.7,
    "left_torso": 0.5, "right_torso": 0.5, "shoulders": 0.4, "hips": 0.3, "head": 0.6,
}
SWAP = [0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15]  # COCO left <-> right
NOSE, L_SHOULDER, R_SHOULDER = 0, 5, 6
POSITION_NAMES = {2: ["Người bên trái", "Người bên phải"], 3: ["Người bên trái", "Người ở giữa", "Người bên phải"]}

Point = tuple[float, float]


# Geometry --------------------------------------------------------------------------------------

def _angle_between(a: Point, b: Point) -> float | None:
    na, nb = math.hypot(*a), math.hypot(*b)
    if na < 1e-6 or nb < 1e-6:
        return None
    cos = (a[0] * b[0] + a[1] * b[1]) / (na * nb)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def _limb_score(delta: float) -> float:
    if delta <= PERFECT_DEG:
        return 1.0
    return max(0.0, 1.0 - (delta - PERFECT_DEG) / (ZERO_DEG - PERFECT_DEG))


def _limbs() -> list[tuple[str, int | str, int, str]]:
    """(id, from, to, label); 'mid_shoulder' -> nose is the head/neck limb."""
    limbs = [(l["id"], l["from"], l["to"], l["label"]) for l in get_library()["limbs"]]
    return limbs + [("head", "mid_shoulder", NOSE, "đầu")]


def _point(kp: list, index: int | str, need_visible: bool) -> Point | None:
    """Keypoint (or the shoulder midpoint) if present and, for detections, visible enough."""
    if index == "mid_shoulder":
        a, b = _point(kp, L_SHOULDER, need_visible), _point(kp, R_SHOULDER, need_visible)
        return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) if a and b else None
    p = kp[index]
    if p is None:
        return None
    if need_visible and len(p) > 2 and p[2] is not None and p[2] < VISIBLE:
        return None
    return (p[0], p[1])


def _bbox(points: list[Point]) -> tuple[float, float, float, float] | None:
    if len(points) < 2:
        return None
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


# Body matching ---------------------------------------------------------------------------------

def _score_person(template_kp: list, detected_kp: list) -> dict:
    """Limb-by-limb comparison of one template person with one detected person (labels as given)."""
    rows, total_w, seen_w, score_w = [], 0.0, 0.0, 0.0
    for limb_id, a, b, label in _limbs():
        ta, tb = _point(template_kp, a, False), _point(template_kp, b, False)
        if not (ta and tb):
            continue
        weight = LIMB_WEIGHTS.get(limb_id, 0.5)
        total_w += weight
        da, db = _point(detected_kp, a, True), _point(detected_kp, b, True)
        if not (da and db):
            continue
        t_vec, d_vec = (tb[0] - ta[0], tb[1] - ta[1]), (db[0] - da[0], db[1] - da[1])
        delta = _angle_between(t_vec, d_vec)
        if delta is None:
            continue
        s = _limb_score(delta)
        seen_w += weight
        score_w += weight * s
        rows.append({"limb": limb_id, "label": label, "score": round(s, 3), "ok": delta <= OK_DEG,
                     "delta": delta, "weight": weight, "t_vec": t_vec, "d_vec": d_vec,
                     "d_mid": ((da[0] + db[0]) / 2, (da[1] + db[1]) / 2)})
    coverage = seen_w / total_w if total_w else 0.0
    pose_score = score_w / seen_w if seen_w else 0.0
    # Framing on the keypoints both sides have, so selfie templates without legs compare fairly.
    common = [i for i in range(17) if _point(template_kp, i, False) and _point(detected_kp, i, True)]
    tb_ = _bbox([_point(template_kp, i, False) for i in common])
    db_ = _bbox([_point(detected_kp, i, True) for i in common])
    framing, dx, ratio = 1.0, 0.0, 1.0
    if tb_ and db_:
        t_h, d_h = max(tb_[3] - tb_[1], 1e-3), max(db_[3] - db_[1], 1e-3)
        dx = (db_[0] + db_[2]) / 2 - (tb_[0] + tb_[2]) / 2
        ratio = d_h / t_h
        framing = max(0.0, 1.0 - (abs(dx) / 0.25 + abs(math.log(ratio)) / math.log(1.8)) / 2)
    return {"rows": rows, "coverage": coverage, "pose_score": pose_score, "framing": framing,
            "dx": dx, "ratio": ratio, "bbox": db_}


def _best_labelling(template_kp: list, detected_kp: list) -> dict:
    as_given = _score_person(template_kp, detected_kp)
    swapped = _score_person(template_kp, [detected_kp[i] for i in SWAP])
    key = lambda r: (r["coverage"] >= MIN_COVERAGE, r["pose_score"] * min(1.0, r["coverage"] + 0.2))
    return max((as_given, swapped), key=key)


def _side(row: dict, person_centre_x: float) -> str:
    return "trái" if row["d_mid"][0] < person_centre_x else "phải"


def _limb_hint(row: dict, centre_x: float) -> str:
    """One Vietnamese instruction for the worst limb, in screen terms (what the user sees)."""
    side = _side(row, centre_x)
    t, d = row["t_vec"], row["d_vec"]
    tn, dn = math.hypot(*t) or 1.0, math.hypot(*d) or 1.0
    t_up, d_up = -t[1] / tn, -d[1] / dn  # upward component of the limb direction
    outward = 1 if side == "phải" else -1
    t_out, d_out = t[0] / tn * outward, d[0] / dn * outward
    limb = row["limb"]
    if limb == "head":
        if abs(t[0] / tn) < 0.15:
            return "Giữ đầu thẳng"
        return "Nghiêng đầu sang " + ("phải" if t[0] > 0 else "trái")
    if limb in ("left_torso", "right_torso", "shoulders", "hips"):
        if abs(t[0] / tn) < 0.15 and limb.endswith("torso"):
            return "Đứng thẳng người"
        return "Nghiêng người theo dáng mẫu"
    if "arm" in limb:
        if t_up - d_up > 0.3:
            return f"Giơ tay bên {side} cao hơn"
        if d_up - t_up > 0.3:
            return f"Hạ tay bên {side} xuống"
        return f"Dang tay bên {side} rộng ra" if t_out > d_out else f"Khép tay bên {side} vào"
    if t_up - d_up > 0.3:
        return f"Co chân bên {side} lên"
    if t_out - d_out > 0.25:
        return f"Dạng chân bên {side} rộng hơn"
    if d_out - t_out > 0.25:
        return f"Khép chân bên {side} lại"
    return f"Duỗi thẳng chân bên {side}"


def _framing_hints(result: dict) -> list[str]:
    hints = []
    if result["ratio"] > 1.3:
        hints.append("Lùi ra xa một chút")
    elif result["ratio"] < 0.77:
        hints.append("Tiến lại gần hơn")
    if result["dx"] > 0.12:
        hints.append("Dịch sang trái một chút")
    elif result["dx"] < -0.12:
        hints.append("Dịch sang phải một chút")
    return hints


def _person_hints(result: dict) -> list[str]:
    hints: list[str] = []
    if result["coverage"] < MIN_COVERAGE:
        bbox = result["bbox"]
        touches_edge = bbox and (bbox[1] < 0.03 or bbox[3] > 0.97 or bbox[0] < 0.03 or bbox[2] > 0.97)
        hints.append("Lùi ra xa để thấy cả người" if touches_edge else "Đưa toàn thân vào khung")
    bad = [r for r in result["rows"] if not r["ok"]]
    if bad:
        worst = max(bad, key=lambda r: r["weight"] * (1 - r["score"]))
        bbox = result["bbox"]
        centre_x = (bbox[0] + bbox[2]) / 2 if bbox else 0.5
        hints.append(_limb_hint(worst, centre_x))
    hints.extend(_framing_hints(result))
    return hints


def _final_score(result: dict) -> float:
    return 100.0 * (POSE_SHARE * result["pose_score"] + (1 - POSE_SHARE) * result["framing"])


def match_body(pose: dict, persons: list[dict]) -> dict:
    needed = pose["people"]
    base = {"pose_id": pose["id"], "limbs": []}
    if not persons:
        hint = "Chưa thấy ai trong khung" if needed == 1 else f"Đưa đủ {needed} người vào khung"
        return {**base, "status": "no_person", "score": None, "ready": False, "hints": [hint]}
    if len(persons) < needed:
        return {**base, "status": "wrong_count", "score": None, "ready": False,
                "hints": [f"Cần đủ {needed} người trong khung (đang thấy {len(persons)})"]}

    def area(p):
        x, y, w, h = p.get("bbox") or (0, 0, 0, 0)
        return w * h

    def centre_x(p):
        x, y, w, h = p.get("bbox") or (0.5, 0, 0, 0)
        return x + w / 2

    chosen = sorted(sorted(persons, key=area, reverse=True)[:needed], key=centre_x)
    results = [_best_labelling(t["keypoints"], d["keypoints"]) for t, d in zip(pose["persons"], chosen)]
    scores = [_final_score(r) for r in results]
    # Half mean, half worst: one person out of pose must keep a group photo from being "ready".
    score = 0.5 * sum(scores) / len(scores) + 0.5 * min(scores)
    partial = any(r["coverage"] < MIN_COVERAGE for r in results)
    limbs = [{"person": i, "limb": row["limb"], "ok": row["ok"], "score": row["score"]}
             for i, r in enumerate(results) for row in r["rows"]]
    status = "partial" if partial else "ok"
    ready = status == "ok" and score >= READY_SCORE and min(r["framing"] for r in results) >= MIN_FRAMING
    if ready:
        hints = ["Giữ nguyên tư thế"]
    else:
        worst = min(range(len(results)), key=lambda i: scores[i] - (100 if results[i]["coverage"] < MIN_COVERAGE else 0))
        hints = _person_hints(results[worst])
        names = POSITION_NAMES.get(needed)
        if names and hints:
            hints = [f"{names[worst]}: {hints[0][0].lower()}{hints[0][1:]}"] + hints[1:]
    return {**base, "status": status, "score": round(score), "ready": ready, "limbs": limbs, "hints": hints[:2]}


# Object targets --------------------------------------------------------------------------------

def match_targets(pose: dict, objects: list[dict]) -> dict:
    targets = [g for g in pose["guides"] if g["type"] == "target"]
    base = {"pose_id": pose["id"], "limbs": []}
    if len(objects) < len(targets):
        n = len(targets)
        what = "đồ vật" if pose["category"] != "pet" else "bé thú cưng"
        return {**base, "status": "wrong_count", "score": None, "ready": False, "targets": [],
                "hints": [f"Cần {n} {what} trong khung (đang thấy {len(objects)})"]}
    centres = [(o["bbox"][0] + o["bbox"][2] / 2, o["bbox"][1] + o["bbox"][3] / 2) for o in objects]

    def target_score(t, c):
        d = math.hypot(c[0] - t["cx"], c[1] - t["cy"])
        return max(0.0, 1.0 - max(0.0, d - t["r"]) / 0.25)

    best, best_assign = -1.0, None
    for subset in combinations(range(len(objects)), len(targets)):
        for order in permutations(subset):
            total = sum(target_score(t, centres[o]) for t, o in zip(targets, order))
            if total > best:
                best, best_assign = total, order
    rows = []
    for i, (t, o) in enumerate(zip(targets, best_assign)):
        s = target_score(t, centres[o])
        rows.append({"index": i, "label": t.get("label", str(i + 1)), "ok": s >= 0.85, "score": round(s, 3),
                     "dx": centres[o][0] - t["cx"], "dy": centres[o][1] - t["cy"]})
    score = round(100 * best / len(targets))
    ready = score >= READY_SCORE and all(r["ok"] for r in rows)
    hints = ["Giữ máy thật chắc rồi chụp"] if ready else []
    if not ready:
        worst = min(rows, key=lambda r: r["score"])
        moves = []
        if abs(worst["dx"]) > 0.05:
            moves.append("sang trái" if worst["dx"] > 0 else "sang phải")
        if abs(worst["dy"]) > 0.05:
            moves.append("lên trên" if worst["dy"] > 0 else "xuống dưới")
        hints.append(f"Dời vật gần vòng số {worst['label']} " + " và ".join(moves) if moves
                     else f"Đặt một vật vào vòng số {worst['label']}")
    targets_out = [{k: r[k] for k in ("index", "label", "ok", "score")} for r in rows]
    return {**base, "status": "ok", "score": score, "ready": ready, "targets": targets_out, "hints": hints}


def match_pose(pose: dict, persons: list[dict], objects: list[dict]) -> dict:
    if pose["kind"] == "body":
        return match_body(pose, persons)
    if pose["objects"]:
        return match_targets(pose, objects)
    return {"pose_id": pose["id"], "status": "not_applicable", "score": None, "ready": False,
            "limbs": [], "hints": []}
