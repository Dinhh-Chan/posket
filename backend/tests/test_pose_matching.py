"""Pose track tests: matching, scene classification and suggestions (pure functions, no detector)."""

import math

import pytest

from app.pose import classify_scene, get_library, get_pose, match_pose, suggest_poses
from app.pose.matching import SWAP


def detected(template_person, visibility=1.0, dx=0.0, dy=0.0, scale=1.0, mirror=False):
    """A fake detection built from a template person: [x, y, v] per keypoint, optionally moved,
    scaled about the frame centre or mirrored (x -> 1 - x, labels unchanged)."""
    kps = []
    for p in template_person["keypoints"]:
        if p is None:
            kps.append([0.0, 0.0, 0.0])
            continue
        x = 0.5 + (p[0] - 0.5) * scale + dx
        y = 0.5 + (p[1] - 0.5) * scale + dy
        if mirror:
            x = 1 - x
        kps.append([x, y, visibility])
    xs = [k[0] for k in kps if k[2] > 0]
    ys = [k[1] for k in kps if k[2] > 0]
    return {"keypoints": kps, "bbox": [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)], "score": 0.95}


def people_of(pose_id, **kw):
    return [detected(p, **kw) for p in get_pose(pose_id)["persons"]]


def test_library_is_loaded():
    lib = get_library()
    assert len(lib["poses"]) >= 50
    assert {c["id"] for c in lib["categories"]} >= {"selfie", "solo", "duo", "group", "objects", "scenery", "pet"}


@pytest.mark.parametrize("pose_id", [p["id"] for p in get_library()["poses"] if p["kind"] == "body"])
def test_every_body_pose_matches_itself(pose_id):
    pose = get_pose(pose_id)
    m = match_pose(pose, people_of(pose_id), [])
    assert m["status"] == "ok", m
    assert m["score"] >= 97 and m["ready"], m
    assert m["hints"] == ["Giữ nguyên tư thế"]


def test_swapped_left_right_labels_still_match():
    pose = get_pose("solo-wave")
    person = people_of("solo-wave")[0]
    person["keypoints"] = [person["keypoints"][i] for i in SWAP]
    assert match_pose(pose, [person], [])["score"] >= 97


def test_mirrored_pose_does_not_match():
    """Arm raised on the other side of the screen must not be forgiven by the label swap."""
    pose = get_pose("solo-wave")
    right = match_pose(pose, people_of("solo-wave"), [])["score"]
    mirrored = match_pose(pose, people_of("solo-wave", mirror=True), [])["score"]
    assert mirrored < right - 20, (right, mirrored)
    assert mirrored < 85


def test_different_pose_scores_low_with_a_useful_hint():
    target = get_pose("solo-victory")  # both arms raised
    m = match_pose(target, people_of("solo-confident"), [])  # arms down
    assert m["status"] == "ok" and m["score"] < 70 and not m["ready"]
    assert m["hints"] and m["hints"][0].startswith("Giơ tay bên")
    bad = {l["limb"] for l in m["limbs"] if not l["ok"]}
    assert {"left_upper_arm", "right_upper_arm"} <= bad


def test_position_and_size_only_change_the_framing_term():
    pose = get_pose("solo-hand-on-hip")
    slightly_small = match_pose(pose, people_of("solo-hand-on-hip", scale=0.8), [])
    assert slightly_small["ready"]  # the pose is right; small size differences are fine
    small = match_pose(pose, people_of("solo-hand-on-hip", scale=0.5), [])
    assert 80 <= small["score"] < 97 and not small["ready"]
    assert "Tiến lại gần hơn" in small["hints"]
    shifted = match_pose(pose, people_of("solo-hand-on-hip", dx=0.3), [])
    assert not shifted["ready"] and "Dịch sang trái một chút" in shifted["hints"]


def test_hidden_legs_give_partial():
    pose = get_pose("solo-star-jump")
    person = people_of("solo-star-jump")[0]
    for i in (11, 12, 13, 14, 15, 16):
        person["keypoints"][i][2] = 0.1
    m = match_pose(pose, [person], [])
    assert m["status"] == "partial" and not m["ready"]
    assert m["hints"][0] in ("Đưa toàn thân vào khung", "Lùi ra xa để thấy cả người")


def test_people_count_checks():
    duo = get_pose("duo-high-five")
    assert match_pose(duo, [], [])["status"] == "no_person"
    one = match_pose(duo, people_of("duo-high-five")[:1], [])
    assert one["status"] == "wrong_count" and one["score"] is None
    extra = people_of("duo-high-five") + [detected(get_pose("solo-confident")["persons"][0], scale=0.3, dx=0.4)]
    assert match_pose(duo, extra, [])["score"] >= 97  # the two biggest people are used


def test_group_hint_names_the_person():
    pose = get_pose("group-cheer")
    people = people_of("group-cheer")
    people[2] = detected(get_pose("group-four")["persons"][3])  # right person: arms down
    m = match_pose(pose, people, [])
    assert m["score"] < 85
    assert not m["ready"] and m["hints"][0].startswith("Người bên phải")


def obj(cx, cy, label="cup", size=0.08):
    return {"label": label, "score": 0.9, "bbox": [cx - size / 2, cy - size / 2, size, size]}


def test_objects_on_targets():
    pose = get_pose("obj-three-triangle")
    on = match_pose(pose, [], [obj(0.5, 0.3), obj(0.3, 0.66), obj(0.7, 0.66)])
    assert on["status"] == "ok" and on["score"] >= 97 and on["ready"]
    few = match_pose(pose, [], [obj(0.5, 0.3)])
    assert few["status"] == "wrong_count" and "3 đồ vật" in few["hints"][0]
    off = match_pose(pose, [], [obj(0.5, 0.3), obj(0.3, 0.66), obj(0.95, 0.95)])
    assert not off["ready"] and off["hints"][0].startswith("Dời vật gần vòng số 3")


def test_scenery_composition_is_not_scored():
    m = match_pose(get_pose("scene-thirds"), [], [])
    assert m["status"] == "not_applicable" and m["score"] is None


def test_scene_classification():
    assert classify_scene([], [])["kind"] == "scenery"
    assert classify_scene([], [obj(0.5, 0.5)])["kind"] == "objects"
    assert classify_scene([], [obj(0.5, 0.5, "dog")])["kind"] == "pet"
    assert classify_scene(people_of("solo-confident"), [])["kind"] == "solo"
    assert classify_scene(people_of("selfie-center"), [])["kind"] == "selfie"
    assert classify_scene(people_of("duo-side-by-side"), [])["kind"] == "duo"
    assert classify_scene(people_of("group-line"), [])["kind"] == "group"


def test_suggestions_prefer_the_current_body_and_object_count():
    lib = get_library()
    people = people_of("solo-victory")
    scene = classify_scene(people, [])
    top = suggest_poses(scene, people, [], lib)
    assert top[0]["pose_id"] == "solo-victory" and top[0]["reason"] == "Gần với dáng hiện tại"
    assert len(top) <= 8 and all(get_pose(s["pose_id"])["category"] == "solo" for s in top[:5])

    things = [obj(0.2, 0.2), obj(0.5, 0.5), obj(0.8, 0.8)]
    scene = classify_scene([], things)
    top = suggest_poses(scene, [], things, lib)
    assert top[0]["pose_id"].startswith("obj-three") and "3 đồ vật" in top[0]["reason"]

    group = people_of("group-four")
    top = suggest_poses(classify_scene(group, []), group, [], lib)
    assert top[0]["pose_id"] == "group-four"


def test_scores_are_finite_on_degenerate_input():
    pose = get_pose("solo-confident")
    zero = {"keypoints": [[0.5, 0.5, 1.0]] * 17, "bbox": [0.5, 0.5, 0, 0], "score": 0.9}
    m = match_pose(pose, [zero], [])
    assert m["score"] is None or math.isfinite(m["score"])
