"""Parametric 2D skeleton: build COCO-17 keypoints from joint angles or hand/foot targets.

Coordinates are in the displayed square frame: x right, y down, both 0..1. Angles are absolute,
in degrees, measured in image space: 0 points straight down, 90 points to image-right, -90 to
image-left and 180 straight up. A figure faces the viewer, so its left side is on image-right.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

KEYPOINTS = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]
IDX = {name: i for i, name in enumerate(KEYPOINTS)}

# Segment lengths as fractions of standing body height (crown to ankle ≈ 1).
TORSO, NECK, SHOULDER_HALF, HIP_HALF = 0.30, 0.105, 0.115, 0.065
UPPER_ARM, FOREARM, THIGH, SHIN, HEAD_R = 0.18, 0.15, 0.245, 0.245, 0.064

Point = tuple[float, float]


def direction(angle: float) -> Point:
    a = math.radians(angle)
    return math.sin(a), math.cos(a)


def add(p: Point, v: Point, k: float = 1.0) -> Point:
    return p[0] + v[0] * k, p[1] + v[1] * k


def sub(a: Point, b: Point) -> Point:
    return a[0] - b[0], a[1] - b[1]


def norm(v: Point) -> float:
    return math.hypot(v[0], v[1])


def angle_of(v: Point) -> float:
    """Inverse of direction(): image-space angle of a vector."""
    return math.degrees(math.atan2(v[0], v[1]))


def two_bone(root: Point, target: Point, a: float, b: float, prefer: Point) -> tuple[Point, Point]:
    """Joint and end point of a two-segment chain reaching for target. Of the two possible joint
    positions, the one farther along `prefer` (a direction) is used. Out-of-reach targets are
    approached in a straight line."""
    d_vec = sub(target, root)
    d = max(norm(d_vec), 1e-9)
    u = (d_vec[0] / d, d_vec[1] / d)
    if d >= a + b:
        joint = add(root, u, a)
        return joint, add(joint, u, b)
    d = max(d, abs(a - b) + 1e-6)
    cos_alpha = (a * a + d * d - b * b) / (2 * a * d)
    alpha = math.acos(max(-1.0, min(1.0, cos_alpha)))
    candidates = []
    for sign in (1, -1):
        c, s = math.cos(sign * alpha), math.sin(sign * alpha)
        r = (u[0] * c - u[1] * s, u[0] * s + u[1] * c)
        candidates.append(add(root, r, a))
    joint = max(candidates, key=lambda j: (j[0] - root[0]) * prefer[0] + (j[1] - root[1]) * prefer[1])
    return joint, target


@dataclass
class Limb:
    """One arm or leg: either absolute angles (upper, lower) or a target for the end point.
    `k_upper`/`k_lower` shorten a segment to show it pointing toward or away from the camera."""

    upper: float | None = None
    lower: float | None = None
    target: Point | str | None = None  # absolute frame point, or a named anchor (see Figure.anchor)
    offset: Point = (0.0, 0.0)  # added to a named anchor, in body-height units
    prefer: Point = (1.0, 0.0)  # preferred side of the elbow/knee for targets (image space)
    k_upper: float = 1.0
    k_lower: float = 1.0


def relaxed_arm(side: str) -> Limb:
    s = 1 if side == "l" else -1
    return Limb(12 * s, 6 * s)


def straight_leg(side: str, spread: float = 4) -> Limb:
    s = 1 if side == "l" else -1
    return Limb(spread * s, 0)


@dataclass
class Figure:
    """A person. (x, y) is the hip midpoint in the frame, `s` the standing height in frame units."""

    x: float
    y: float
    s: float = 0.78
    torso: float = 180.0  # hip -> shoulder direction
    head: float = 0.0  # head tilt relative to the torso
    yaw: float = 0.0  # 0 faces the viewer, ±90 is a profile (positive faces image-right)
    la: Limb = field(default_factory=lambda: relaxed_arm("l"))
    ra: Limb = field(default_factory=lambda: relaxed_arm("r"))
    ll: Limb = field(default_factory=lambda: straight_leg("l"))
    rl: Limb = field(default_factory=lambda: straight_leg("r"))
    hide: tuple[str, ...] = ()

    def build(self) -> tuple[list[Point | None], dict]:
        s = self.s
        width = math.cos(math.radians(self.yaw))
        hip_c = (self.x, self.y)
        t = direction(self.torso)
        perp = (-t[1], t[0])  # image-right for an upright torso
        sho_c = add(hip_c, t, TORSO * s)
        hd = direction(self.torso + self.head)
        hperp = (-hd[1], hd[0])
        nose = add(sho_c, hd, NECK * s)
        nose = add(nose, hperp, 0.03 * s * math.sin(math.radians(self.yaw)))
        pts: dict[str, Point] = {
            "left_shoulder": add(sho_c, perp, SHOULDER_HALF * s * width),
            "right_shoulder": add(sho_c, perp, -SHOULDER_HALF * s * width),
            "left_hip": add(hip_c, perp, HIP_HALF * s * width),
            "right_hip": add(hip_c, perp, -HIP_HALF * s * width),
            "nose": nose,
        }
        eye_up = add(nose, hd, -0.022 * s)  # eyes sit above the nose (against the head direction)
        ear_up = add(nose, hd, -0.012 * s)
        pts["left_eye"] = add(eye_up, hperp, 0.026 * s * width)
        pts["right_eye"] = add(eye_up, hperp, -0.026 * s * width)
        pts["left_ear"] = add(ear_up, hperp, 0.055 * s * max(width, 0.25))
        pts["right_ear"] = add(ear_up, hperp, -0.055 * s * max(width, 0.25))
        self._pts = pts
        # Legs first so that arms can target knees ("hands on knees").
        for limb, root, mid, end, a, b in (
            (self.ll, "left_hip", "left_knee", "left_ankle", THIGH, SHIN),
            (self.rl, "right_hip", "right_knee", "right_ankle", THIGH, SHIN),
            (self.la, "left_shoulder", "left_elbow", "left_wrist", UPPER_ARM, FOREARM),
            (self.ra, "right_shoulder", "right_elbow", "right_wrist", UPPER_ARM, FOREARM),
        ):
            a_len, b_len = a * s * limb.k_upper, b * s * limb.k_lower
            if limb.target is not None:
                target = self.anchor(limb.target, limb.offset)
                j, e = two_bone(pts[root], target, a_len, b_len, limb.prefer)
            else:
                j = add(pts[root], direction(limb.upper), a_len)
                e = add(j, direction(limb.lower), b_len)
            pts[mid], pts[end] = j, e
        if abs(self.yaw) > 50:  # the far ear and eye are hidden in a profile
            far = "right" if self.yaw > 0 else "left"
            pts.pop(f"{far}_ear")
            pts.pop(f"{far}_eye")
        out: list[Point | None] = []
        for name in KEYPOINTS:
            p = pts.get(name)
            if p is None or name in self.hide or not (0.0 <= p[0] <= 1.0 and 0.0 <= p[1] <= 1.0):
                out.append(None)
            else:
                out.append((round(p[0], 4), round(p[1], 4)))
        head_c = add(nose, hd, 0.012 * s)
        head = {"cx": round(head_c[0], 4), "cy": round(head_c[1], 4), "r": round(HEAD_R * s, 4)}
        return out, head

    def anchor(self, target: Point | str, offset: Point) -> Point:
        """Named body points (after the torso is placed) plus an offset in body-height units."""
        if not isinstance(target, str):
            return target[0] + offset[0] * self.s, target[1] + offset[1] * self.s
        p = self._pts
        sho_c = ((p["left_shoulder"][0] + p["right_shoulder"][0]) / 2, (p["left_shoulder"][1] + p["right_shoulder"][1]) / 2)
        hip_c = ((p["left_hip"][0] + p["right_hip"][0]) / 2, (p["left_hip"][1] + p["right_hip"][1]) / 2)
        named = {
            **p,
            "chest": add(sho_c, sub(hip_c, sho_c), 0.25),
            "waist": add(sho_c, sub(hip_c, sho_c), 0.7),
            "hip": hip_c,
            "shoulders": sho_c,
            "head_top": add(p["nose"], sub(p["nose"], sho_c), 0.75),
        }
        base = named[target]
        return base[0] + offset[0] * self.s, base[1] + offset[1] * self.s
