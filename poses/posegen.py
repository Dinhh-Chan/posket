"""Generate the PoseCam pose library (library.json) and preview sheets (preview/*.png).

Usage:  uv run --with pillow python poses/posegen.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from definitions import CATEGORIES, POSES  # noqa: E402
from skeleton import IDX, KEYPOINTS  # noqa: E402

HERE = Path(__file__).parent

LIMBS = [
    ("left_upper_arm", "left_shoulder", "left_elbow", "cánh tay"),
    ("left_forearm", "left_elbow", "left_wrist", "cẳng tay"),
    ("right_upper_arm", "right_shoulder", "right_elbow", "cánh tay"),
    ("right_forearm", "right_elbow", "right_wrist", "cẳng tay"),
    ("left_thigh", "left_hip", "left_knee", "đùi"),
    ("left_shin", "left_knee", "left_ankle", "cẳng chân"),
    ("right_thigh", "right_hip", "right_knee", "đùi"),
    ("right_shin", "right_knee", "right_ankle", "cẳng chân"),
    ("left_torso", "left_shoulder", "left_hip", "thân người"),
    ("right_torso", "right_shoulder", "right_hip", "thân người"),
    ("shoulders", "left_shoulder", "right_shoulder", "vai"),
    ("hips", "left_hip", "right_hip", "hông"),
]


def build_library() -> dict:
    poses = []
    seen = set()
    for spec in POSES:
        assert spec["id"] not in seen, f"duplicate id {spec['id']}"
        seen.add(spec["id"])
        assert spec["category"] in {c["id"] for c in CATEGORIES}, spec["id"]
        figures = spec.get("figures", [])
        persons = []
        for fig in sorted(figures, key=lambda f: f.x):
            keypoints, head = fig.build()
            persons.append({"keypoints": [list(p) if p else None for p in keypoints], "head": head})
        kind = "body" if persons else "composition"
        guides = spec.get("guides", [])
        objects = sum(1 for g in guides if g["type"] == "target")
        pose = {
            "id": spec["id"],
            "name": spec["name"],
            "category": spec["category"],
            "kind": kind,
            "people": len(persons),
            "objects": objects,
            "difficulty": spec.get("difficulty", 1),
            "tags": spec.get("tags", []),
            "tip": spec["tip"],
            "persons": persons,
            "guides": guides,
        }
        validate(pose)
        poses.append(pose)
    return {
        "version": 1,
        "keypoints": KEYPOINTS,
        "limbs": [{"id": i, "from": IDX[a], "to": IDX[b], "label": label} for i, a, b, label in LIMBS],
        "categories": CATEGORIES,
        "poses": poses,
    }


def validate(pose: dict) -> None:
    for i, person in enumerate(pose["persons"]):
        kp = person["keypoints"]
        core = ["left_shoulder", "right_shoulder", "nose"]
        missing = [n for n in core if kp[IDX[n]] is None]
        assert not missing, f"{pose['id']} person {i}: core keypoints outside the frame: {missing}"
        visible_limbs = sum(1 for _, a, b, _ in LIMBS if kp[IDX[a]] and kp[IDX[b]])
        assert visible_limbs >= 3, f"{pose['id']} person {i}: only {visible_limbs} limbs visible"
    for g in pose["guides"]:
        assert g["type"] in {"line", "rect", "ellipse", "target"}, g


def render_previews(library: dict) -> list[Path]:
    from PIL import Image, ImageDraw, ImageFont

    cell, pad = 300, 8
    font = ImageFont.load_default(size=15)
    small = ImageFont.load_default(size=12)
    out_dir = HERE / "preview"
    out_dir.mkdir(exist_ok=True)
    written = []
    for cat in library["categories"]:
        poses = [p for p in library["poses"] if p["category"] == cat["id"]]
        if not poses:
            continue
        cols = 4
        rows = (len(poses) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 34)), (24, 24, 24))
        for n, pose in enumerate(poses):
            ox, oy = (n % cols) * cell, (n // cols) * (cell + 34)
            img = Image.new("RGB", (cell - 2 * pad, cell - 2 * pad), (0, 0, 0))
            draw_pose(ImageDraw.Draw(img), pose, library, img.size[0], small)
            sheet.paste(img, (ox + pad, oy + pad))
            d = ImageDraw.Draw(sheet)
            d.text((ox + pad, oy + cell - 2), f"{pose['name']}  [{pose['id']}]", fill=(230, 230, 230), font=font)
        path = out_dir / f"{cat['id']}.png"
        sheet.save(path)
        written.append(path)
    return written


def draw_pose(d, pose: dict, library: dict, size: int, font) -> None:
    def px(x, y):
        return x * size, y * size

    for g in pose["guides"]:
        color = (150, 150, 150)
        if g["type"] == "line":
            dashed(d, px(g["x1"], g["y1"]), px(g["x2"], g["y2"]), color)
        elif g["type"] == "rect":
            x, y, w, h = g["x"], g["y"], g["w"], g["h"]
            for a, b in (((x, y), (x + w, y)), ((x + w, y), (x + w, y + h)), ((x + w, y + h), (x, y + h)), ((x, y + h), (x, y))):
                dashed(d, px(*a), px(*b), color)
        elif g["type"] == "ellipse":
            d.ellipse([px(g["cx"] - g["rx"], g["cy"] - g["ry"]), px(g["cx"] + g["rx"], g["cy"] + g["ry"])], outline=color, width=2)
        elif g["type"] == "target":
            d.ellipse([px(g["cx"] - g["r"], g["cy"] - g["r"]), px(g["cx"] + g["r"], g["cy"] + g["r"])], outline=(250, 204, 21), width=3)
            d.text(px(g["cx"] - 0.012, g["cy"] - 0.02), g.get("label", ""), fill=(250, 204, 21), font=font)
    width = max(3, int(0.028 * size))
    for person in pose["persons"]:
        kp = person["keypoints"]
        for limb in library["limbs"]:
            a, b = kp[limb["from"]], kp[limb["to"]]
            if a and b:
                d.line([px(*a), px(*b)], fill=(235, 235, 235), width=width, joint="curve")
                for p in (a, b):
                    r = width / 2
                    cx, cy = px(*p)
                    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(235, 235, 235))
        ls, rs = kp[IDX["left_shoulder"]], kp[IDX["right_shoulder"]]
        h = person["head"]
        if ls and rs:
            mid = ((ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2)
            d.line([px(*mid), px(h["cx"], h["cy"] + h["r"] * 0.8)], fill=(235, 235, 235), width=width)
        d.ellipse([px(h["cx"] - h["r"], h["cy"] - h["r"]), px(h["cx"] + h["r"], h["cy"] + h["r"])], outline=(235, 235, 235), width=width)
        for name, color in (("left_wrist", (96, 165, 250)), ("left_ankle", (96, 165, 250))):
            p = kp[IDX[name]]
            if p:  # mark the figure's LEFT side so mirror mistakes are visible in previews
                cx, cy = px(*p)
                d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=color)


def dashed(d, a, b, color, dash=8):
    import math

    length = math.hypot(b[0] - a[0], b[1] - a[1])
    n = max(1, int(length / dash))
    for i in range(0, n, 2):
        t0, t1 = i / n, min(1.0, (i + 1) / n)
        d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill=color, width=2)


def main() -> None:
    library = build_library()
    path = HERE / "library.json"
    path.write_text(json.dumps(library, ensure_ascii=False, indent=1) + "\n")
    counts = {}
    for p in library["poses"]:
        counts[p["category"]] = counts.get(p["category"], 0) + 1
    print(f"wrote {path} with {len(library['poses'])} poses: {counts}")
    if "--no-preview" not in sys.argv:
        for p in render_previews(library):
            print("preview", p)


if __name__ == "__main__":
    main()
