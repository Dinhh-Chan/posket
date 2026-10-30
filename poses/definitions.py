"""PoseCam pose definitions (original designs). Each body pose is a list of Figures; composition
poses only have guides. See skeleton.py for the angle convention (0 = down, 90 = image-right,
180 = up) and remember a figure faces the viewer: its LEFT arm is on image-RIGHT."""

from skeleton import Figure, Limb

CATEGORIES = [
    {"id": "selfie", "label": "Selfie", "emoji": "🤳"},
    {"id": "solo", "label": "1 người", "emoji": "🧍"},
    {"id": "duo", "label": "2 người", "emoji": "👫"},
    {"id": "group", "label": "Nhóm", "emoji": "👨‍👩‍👧"},
    {"id": "objects", "label": "Đồ vật", "emoji": "☕"},
    {"id": "scenery", "label": "Phong cảnh", "emoji": "🏞️"},
    {"id": "pet", "label": "Thú cưng", "emoji": "🐶"},
]


# Guide helpers -------------------------------------------------------------------------------

def line(x1, y1, x2, y2):
    return {"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2}


def thirds():
    t1, t2 = 0.3333, 0.6667
    return [line(t1, 0, t1, 1), line(t2, 0, t2, 1), line(0, t1, 1, t1), line(0, t2, 1, t2)]


def target(cx, cy, label, r=0.1):
    return {"type": "target", "cx": cx, "cy": cy, "r": r, "label": label}


def rect(x, y, w, h):
    return {"type": "rect", "x": x, "y": y, "w": w, "h": h}


def ellipse(cx, cy, rx, ry):
    return {"type": "ellipse", "cx": cx, "cy": cy, "rx": rx, "ry": ry}


# Body helpers --------------------------------------------------------------------------------

def kp(fig: Figure, name: str):
    """Absolute position of one keypoint of an already-specified figure (arms do not move it)."""
    from skeleton import IDX

    points, _ = fig.build()
    return points[IDX[name]]


def peace(side: str) -> Limb:
    """Hand in a V sign beside the face, elbow down."""
    s = 1 if side == "l" else -1
    return Limb(target="nose", offset=(0.085 * s, 0.01), prefer=(0.35 * s, 1), k_upper=0.5)


def on_hip(side: str) -> Limb:
    s = 1 if side == "l" else -1
    return Limb(target="waist", offset=(0.085 * s, 0.0), prefer=(s, 0))


def behind_head(side: str) -> Limb:
    s = 1 if side == "l" else -1
    return Limb(target="nose", offset=(0.055 * s, -0.075), prefer=(s, -1))


def raised(side: str, upper=150, lower=162) -> Limb:
    s = 1 if side == "l" else -1
    return Limb(upper * s, lower * s)


def star_leg(side: str) -> Limb:
    s = 1 if side == "l" else -1
    return Limb(24 * s, 24 * s)


def legs(spread=5):
    return {"ll": Limb(spread, 0), "rl": Limb(-spread, 0)}


def crossed_arms():
    return {
        "la": Limb(target="chest", offset=(-0.07, 0.06), prefer=(0.35, 1)),
        "ra": Limb(target="chest", offset=(0.07, 0.08), prefer=(-0.35, 1)),
    }


def heart_overhead():
    return {
        "la": Limb(172, -128),
        "ra": Limb(-172, 128),
    }


def crouch(x, y, s):
    return Figure(
        x, y, s,
        ll=Limb(102, -8, k_upper=0.55), rl=Limb(-102, 8, k_upper=0.55),
        la=Limb(target="left_knee", offset=(-0.01, 0.01), prefer=(1, 0.2)),
        ra=Limb(target="right_knee", offset=(0.01, 0.01), prefer=(-1, 0.2)),
    )


def duo_pair(xa=0.34, xb=0.66, y=0.58, s=0.62, **kw):
    a = Figure(xa, y, s, **kw.get("a", {}))
    b = Figure(xb, y, s, **kw.get("b", {}))
    return a, b


# Pose list ------------------------------------------------------------------------------------

def solo_poses():
    return [
        {"id": "solo-confident", "name": "Đứng tự tin", "category": "solo", "difficulty": 1,
         "tags": ["standing"], "tip": "Đứng thẳng, hai chân rộng bằng vai, thả lỏng vai và tay",
         "figures": [Figure(0.5, 0.55, la=Limb(14, 8), ra=Limb(-14, -8), **legs(6))]},
        {"id": "solo-hand-on-hip", "name": "Chống hông", "category": "solo", "difficulty": 1,
         "tags": ["standing"], "tip": "Một tay chống hông, dồn trọng tâm sang một chân",
         "figures": [Figure(0.5, 0.55, torso=177, la=on_hip("l"), ll=Limb(11, 3), rl=Limb(-2, 0))]},
        {"id": "solo-hands-on-hips", "name": "Hai tay chống hông", "category": "solo", "difficulty": 1,
         "tags": ["standing"], "tip": "Hai tay chống hông, ngực mở, chân rộng bằng vai",
         "figures": [Figure(0.5, 0.55, la=on_hip("l"), ra=on_hip("r"), **legs(8))]},
        {"id": "solo-arms-crossed", "name": "Khoanh tay", "category": "solo", "difficulty": 1,
         "tags": ["standing"], "tip": "Khoanh tay trước ngực, hơi nghiêng đầu, cười nhẹ",
         "figures": [Figure(0.5, 0.55, head=-6, **crossed_arms(), **legs(5))]},
        {"id": "solo-peace", "name": "Chữ V cạnh mặt", "category": "solo", "difficulty": 1,
         "tags": ["standing", "hand"], "tip": "Giơ tay chữ V sát má, tay còn lại thả lỏng",
         "figures": [Figure(0.5, 0.55, ra=peace("r"), **legs(5))]},
        {"id": "solo-wave", "name": "Vẫy tay", "category": "solo", "difficulty": 1,
         "tags": ["standing", "hand"], "tip": "Giơ một tay lên vẫy như đang chào ai đó",
         "figures": [Figure(0.5, 0.55, la=Limb(118, 168), **legs(5))]},
        {"id": "solo-victory", "name": "Hai tay giơ cao", "category": "solo", "difficulty": 1,
         "tags": ["standing", "happy"], "tip": "Giơ cao hai tay hình chữ V như vừa chiến thắng",
         "figures": [Figure(0.5, 0.56, la=raised("l"), ra=raised("r"), **legs(8))]},
        {"id": "solo-pockets", "name": "Tay đút túi", "category": "solo", "difficulty": 1,
         "tags": ["standing", "casual"], "tip": "Hai tay đút túi quần, vai thả lỏng, ánh mắt nhìn xa",
         "figures": [Figure(0.5, 0.55,
                            la=Limb(target="left_hip", offset=(0.012, 0.055), prefer=(1, 0)),
                            ra=Limb(target="right_hip", offset=(-0.012, 0.055), prefer=(-1, 0)),
                            **legs(5))]},
        {"id": "solo-star-jump", "name": "Nhảy ngôi sao", "category": "solo", "difficulty": 3,
         "tags": ["jump", "happy"], "tip": "Bật nhảy, dang rộng tay chân như ngôi sao; nên dùng tự chụp",
         "figures": [Figure(0.5, 0.5, s=0.74, la=Limb(128, 134), ra=Limb(-128, -134),
                            ll=star_leg("l"), rl=star_leg("r"))]},
        {"id": "solo-sit-floor", "name": "Ngồi xếp bằng", "category": "solo", "difficulty": 2,
         "tags": ["sitting"], "tip": "Ngồi xếp bằng, hai tay đặt nhẹ lên đầu gối",
         "figures": [Figure(0.5, 0.7, ll=Limb(74, -80, k_upper=0.85, k_lower=0.8),
                            rl=Limb(-74, 80, k_upper=0.85, k_lower=0.8),
                            la=Limb(target="left_knee", offset=(-0.02, -0.01), prefer=(1, 0.3)),
                            ra=Limb(target="right_knee", offset=(0.02, -0.01), prefer=(-1, 0.3)))]},
        {"id": "solo-sit-chair", "name": "Ngồi ghế", "category": "solo", "difficulty": 1,
         "tags": ["sitting"], "tip": "Ngồi thẳng lưng trên ghế, hai tay đặt lên đùi",
         "figures": [Figure(0.5, 0.58, ll=Limb(12, 2, k_upper=0.4), rl=Limb(-12, -2, k_upper=0.4),
                            la=Limb(target="left_knee", offset=(0.0, -0.02), prefer=(1, 0)),
                            ra=Limb(target="right_knee", offset=(0.0, -0.02), prefer=(-1, 0)))]},
        {"id": "solo-crouch", "name": "Ngồi xổm", "category": "solo", "difficulty": 2,
         "tags": ["sitting", "street"], "tip": "Ngồi xổm, khuỷu tay tì lên đầu gối, nhìn thẳng ống kính",
         "figures": [crouch(0.5, 0.72, 0.78)]},
        {"id": "solo-lean", "name": "Tựa nghiêng, bắt chéo chân", "category": "solo", "difficulty": 2,
         "tags": ["standing", "casual"], "tip": "Tựa vai vào tường, bắt chéo chân, một tay để sau đầu",
         "figures": [Figure(0.5, 0.55, torso=173, la=behind_head("l"), ra=Limb(-22, -6),
                            ll=Limb(2, -14), rl=Limb(-7, 2))]},
        {"id": "solo-hands-behind-head", "name": "Hai tay sau đầu", "category": "solo", "difficulty": 1,
         "tags": ["standing", "casual"], "tip": "Đan hai tay sau gáy, khuỷu tay mở rộng, ngực hướng lên",
         "figures": [Figure(0.5, 0.55, la=behind_head("l"), ra=behind_head("r"), **legs(6))]},
        {"id": "solo-chin", "name": "Chống cằm suy tư", "category": "solo", "difficulty": 2,
         "tags": ["standing", "hand"], "tip": "Một tay chống cằm, tay kia đỡ khuỷu tay, nghiêng đầu nhẹ",
         "figures": [Figure(0.5, 0.55, head=8,
                            ra=Limb(target="nose", offset=(-0.004, 0.05), prefer=(-0.2, 1), k_upper=0.5),
                            la=Limb(target="chest", offset=(-0.06, 0.12), prefer=(0.3, 1)), **legs(5))]},
        {"id": "solo-heart-overhead", "name": "Tim trên đầu", "category": "solo", "difficulty": 1,
         "tags": ["standing", "cute"], "tip": "Vòng hai tay lên đỉnh đầu thành hình trái tim",
         "figures": [Figure(0.5, 0.56, **heart_overhead(), **legs(5))]},
        {"id": "solo-point", "name": "Chỉ về phía xa", "category": "solo", "difficulty": 1,
         "tags": ["standing", "travel"], "tip": "Duỗi thẳng một tay chỉ về phía xa, mắt nhìn theo tay",
         "figures": [Figure(0.48, 0.55, head=10, la=Limb(98, 94), **legs(6))]},
    ]


def selfie_poses():
    s, y = 1.7, 1.08
    return [
        {"id": "selfie-center", "name": "Chính diện", "category": "selfie", "difficulty": 1,
         "tags": ["face"], "tip": "Mặt ở giữa khung, cằm hơi hạ, giữ máy ngang tầm mắt",
         "figures": [Figure(0.5, y, s)]},
        {"id": "selfie-tilt", "name": "Nghiêng đầu", "category": "selfie", "difficulty": 1,
         "tags": ["face", "cute"], "tip": "Nghiêng đầu nhẹ sang một bên, mắt nhìn vào ống kính",
         "figures": [Figure(0.5, y, s, head=-16)]},
        {"id": "selfie-peace", "name": "Chữ V cạnh má", "category": "selfie", "difficulty": 1,
         "tags": ["face", "hand"], "tip": "Đưa tay chữ V sát má, cười tươi",
         "figures": [Figure(0.5, y, s, ra=Limb(target="nose", offset=(-0.075, 0.015), prefer=(-0.3, 1), k_upper=0.45))]},
        {"id": "selfie-chin", "name": "Chống cằm", "category": "selfie", "difficulty": 1,
         "tags": ["face", "hand"], "tip": "Tay chống nhẹ dưới cằm, ánh mắt nhìn thẳng",
         "figures": [Figure(0.5, y, s, ra=Limb(target="nose", offset=(-0.01, 0.055), prefer=(-0.15, 1), k_upper=0.45))]},
        {"id": "selfie-thirds", "name": "Lệch 1/3", "category": "selfie", "difficulty": 1,
         "tags": ["face", "composition"], "tip": "Đặt mặt ở đường 1/3 bên phải, chừa khoảng trống cho phông nền",
         "figures": [Figure(0.64, 1.05, 1.55)], "guides": thirds()},
        {"id": "selfie-over-shoulder", "name": "Ngoái qua vai", "category": "selfie", "difficulty": 2,
         "tags": ["face"], "tip": "Xoay người sang bên rồi ngoái mặt lại nhìn ống kính",
         "figures": [Figure(0.5, y, s, yaw=55, head=-6)]},
    ]


def duo_poses():
    def arm_around():
        b = Figure(0.62, 0.58, 0.62)
        a = Figure(0.38, 0.58, 0.62)
        b_shoulder, a_hip = kp(b, "right_shoulder"), kp(a, "left_hip")
        a.la = Limb(target=(b_shoulder[0] + 0.02, b_shoulder[1] - 0.005), prefer=(0, -1))
        b.ra = Limb(target=(a_hip[0] + 0.03, a_hip[1] - 0.04), prefer=(0, 1))
        return [a, b]

    top = 0.235
    return [
        {"id": "duo-side-by-side", "name": "Đứng cạnh nhau", "category": "duo", "difficulty": 1,
         "tags": ["standing"], "tip": "Hai người đứng sát nhau, vai chạm vai, cùng nhìn ống kính",
         "figures": list(duo_pair())},
        {"id": "duo-arm-around", "name": "Khoác vai", "category": "duo", "difficulty": 1,
         "tags": ["standing", "friends"], "tip": "Một người khoác vai, người kia vòng tay qua eo bạn",
         "figures": arm_around()},
        {"id": "duo-back-to-back", "name": "Tựa lưng nhau", "category": "duo", "difficulty": 2,
         "tags": ["standing", "cool"], "tip": "Đứng tựa lưng vào nhau, khoanh tay, quay mặt về ống kính",
         "figures": [Figure(0.43, 0.58, 0.62, yaw=-70, head=0, **crossed_arms()),
                     Figure(0.57, 0.58, 0.62, yaw=70, head=0, **crossed_arms())]},
        {"id": "duo-heart", "name": "Ghép trái tim", "category": "duo", "difficulty": 2,
         "tags": ["standing", "couple"], "tip": "Mỗi người vòng một tay lên cao, chạm nhau thành hình trái tim",
         "figures": [Figure(0.37, 0.58, 0.62, la=Limb(target=(0.5, top), prefer=(-0.6, -1))),
                     Figure(0.63, 0.58, 0.62, ra=Limb(target=(0.5, top), prefer=(0.6, -1)))]},
        {"id": "duo-high-five", "name": "Đập tay", "category": "duo", "difficulty": 1,
         "tags": ["standing", "friends"], "tip": "Hai người giơ tay đập tay nhau ở giữa khung",
         "figures": [Figure(0.36, 0.58, 0.62, la=Limb(target=(0.5, 0.27), prefer=(0.2, 1))),
                     Figure(0.64, 0.58, 0.62, ra=Limb(target=(0.5, 0.27), prefer=(-0.2, 1)))]},
        {"id": "duo-holding-hands", "name": "Nắm tay", "category": "duo", "difficulty": 1,
         "tags": ["standing", "couple"], "tip": "Nắm tay nhau, người hơi nghiêng vào nhau",
         "figures": [Figure(0.37, 0.58, 0.62, torso=178, la=Limb(target=(0.5, 0.6), prefer=(0, 1))),
                     Figure(0.63, 0.58, 0.62, torso=182, ra=Limb(target=(0.5, 0.6), prefer=(0, 1)))]},
        {"id": "duo-peace", "name": "Cùng chữ V", "category": "duo", "difficulty": 1,
         "tags": ["standing", "hand"], "tip": "Cả hai cùng giơ chữ V bằng tay phía ngoài",
         "figures": [Figure(0.35, 0.58, 0.62, ra=peace("r")), Figure(0.65, 0.58, 0.62, la=peace("l"))]},
        {"id": "duo-cheers", "name": "Cụng ly", "category": "duo", "difficulty": 1,
         "tags": ["standing", "party"], "tip": "Hai người cầm ly cụng nhau ở giữa khung, cười tươi",
         "figures": [Figure(0.36, 0.58, 0.62, la=Limb(target=(0.5, 0.43), prefer=(0, 1))),
                     Figure(0.64, 0.58, 0.62, ra=Limb(target=(0.5, 0.43), prefer=(0, 1)))]},
    ]


def group_poses():
    s3, y3 = 0.5, 0.6
    xs = (0.24, 0.5, 0.76)

    def line_up():
        left, mid, right = (Figure(x, y3, s3) for x in xs)
        mid.la = Limb(target=kp(right, "right_shoulder"), prefer=(0, -1))
        mid.ra = Limb(target=kp(left, "left_shoulder"), prefer=(0, -1))
        left.la = Limb(target=(kp(mid, "right_hip")[0] - 0.01, kp(mid, "right_hip")[1] - 0.03), prefer=(0, 1))
        right.ra = Limb(target=(kp(mid, "left_hip")[0] + 0.01, kp(mid, "left_hip")[1] - 0.03), prefer=(0, 1))
        return [left, mid, right]

    return [
        {"id": "group-line", "name": "Hàng ngang khoác vai", "category": "group", "difficulty": 1,
         "tags": ["standing", "friends"], "tip": "Ba người đứng sát nhau thành hàng ngang, khoác vai nhau",
         "figures": line_up()},
        {"id": "group-v", "name": "Đội hình chữ V", "category": "group", "difficulty": 2,
         "tags": ["standing", "team"], "tip": "Người ở giữa đứng lên trước, hai người hai bên lùi lại một bước",
         "figures": [Figure(0.24, 0.55, 0.45, **crossed_arms()),
                     Figure(0.5, 0.64, 0.56, la=on_hip("l"), ra=on_hip("r")),
                     Figure(0.76, 0.55, 0.45, **crossed_arms())]},
        {"id": "group-tiers", "name": "Cao thấp", "category": "group", "difficulty": 2,
         "tags": ["sitting", "standing"], "tip": "Hai người ngồi xổm phía trước, một người đứng giữa phía sau",
         "figures": [crouch(0.28, 0.8, 0.5), Figure(0.5, 0.5, 0.5, la=on_hip("l"), ra=on_hip("r")),
                     crouch(0.72, 0.8, 0.5)]},
        {"id": "group-cheer", "name": "Cùng ăn mừng", "category": "group", "difficulty": 1,
         "tags": ["standing", "happy"], "tip": "Cả nhóm cùng giơ cao hai tay hò reo",
         "figures": [Figure(x, 0.62, 0.5, la=raised("l"), ra=raised("r")) for x in xs]},
        {"id": "group-jump", "name": "Cùng bật nhảy", "category": "group", "difficulty": 3,
         "tags": ["jump", "happy"], "tip": "Đếm 1‑2‑3 rồi cả nhóm cùng nhảy; bật tự chụp để bắt đúng khoảnh khắc",
         "figures": [Figure(x, 0.52, 0.46, la=Limb(128, 134), ra=Limb(-128, -134), ll=star_leg("l"), rl=star_leg("r"))
                     for x in xs]},
        {"id": "group-hearts", "name": "Cùng tạo tim", "category": "group", "difficulty": 1,
         "tags": ["standing", "cute"], "tip": "Mỗi người vòng tay lên đầu thành hình trái tim",
         "figures": [Figure(x, 0.62, 0.5, **heart_overhead()) for x in xs]},
        {"id": "group-four", "name": "Bốn người hàng ngang", "category": "group", "difficulty": 1,
         "tags": ["standing", "friends"], "tip": "Bốn người đứng thành hàng, người hai đầu hơi xoay vào trong",
         "figures": [Figure(x, 0.6, 0.44, yaw=yaw) for x, yaw in ((0.17, 25), (0.39, 0), (0.61, 0), (0.83, -25))]},
    ]


def object_poses():
    return [
        {"id": "obj-center", "name": "1 vật ở giữa", "category": "objects", "difficulty": 1,
         "tags": ["product"], "tip": "Đặt đồ vật vào giữa vòng tròn, phông nền càng gọn càng tốt",
         "guides": [line(0.5, 0, 0.5, 1), line(0, 0.5, 1, 0.5), target(0.5, 0.5, "1", 0.16)]},
        {"id": "obj-thirds", "name": "1 vật theo 1/3", "category": "objects", "difficulty": 1,
         "tags": ["product"], "tip": "Đặt đồ vật ở giao điểm 1/3, phần còn lại để trống cho thoáng",
         "guides": thirds() + [target(0.6667, 0.6667, "1", 0.13)]},
        {"id": "obj-two-balance", "name": "2 vật cân bằng", "category": "objects", "difficulty": 1,
         "tags": ["product"], "tip": "Hai đồ vật đặt chéo nhau ở hai giao điểm 1/3",
         "guides": thirds() + [target(0.3333, 0.38, "1", 0.12), target(0.6667, 0.64, "2", 0.12)]},
        {"id": "obj-three-triangle", "name": "3 vật tam giác", "category": "objects", "difficulty": 2,
         "tags": ["product", "flatlay"], "tip": "Xếp 3 đồ vật thành tam giác: một vật phía trên, hai vật phía dưới",
         "guides": [line(0.5, 0.3, 0.3, 0.66), line(0.3, 0.66, 0.7, 0.66), line(0.7, 0.66, 0.5, 0.3),
                    target(0.5, 0.3, "1", 0.11), target(0.3, 0.66, "2", 0.11), target(0.7, 0.66, "3", 0.11)]},
        {"id": "obj-three-diagonal", "name": "3 vật đường chéo", "category": "objects", "difficulty": 2,
         "tags": ["product", "flatlay"], "tip": "Xếp 3 đồ vật theo đường chéo, vật to nhất ở dưới",
         "guides": [line(0.12, 0.88, 0.88, 0.12), target(0.25, 0.75, "1", 0.11), target(0.5, 0.5, "2", 0.1),
                    target(0.75, 0.25, "3", 0.09)]},
        {"id": "obj-flatlay-grid", "name": "Flat lay 4 vật", "category": "objects", "difficulty": 2,
         "tags": ["flatlay"], "tip": "Chụp từ trên xuống, đặt 4 vật đều nhau theo lưới 2×2",
         "guides": [rect(0.12, 0.12, 0.76, 0.76), line(0.5, 0.12, 0.5, 0.88), line(0.12, 0.5, 0.88, 0.5),
                    target(0.31, 0.31, "1", 0.12), target(0.69, 0.31, "2", 0.12),
                    target(0.31, 0.69, "3", 0.12), target(0.69, 0.69, "4", 0.12)]},
        {"id": "obj-food-top", "name": "Món ăn từ trên xuống", "category": "objects", "difficulty": 1,
         "tags": ["food"], "tip": "Đưa máy song song mặt bàn, đĩa ăn nằm gọn trong vòng tròn",
         "guides": [target(0.5, 0.5, "1", 0.3)]},
    ]


def scenery_poses():
    return [
        {"id": "scene-thirds", "name": "Quy tắc 1/3", "category": "scenery", "difficulty": 1,
         "tags": ["landscape"], "tip": "Đặt chủ thể chính lên một giao điểm của lưới 1/3",
         "guides": thirds()},
        {"id": "scene-horizon-low", "name": "Trời rộng", "category": "scenery", "difficulty": 1,
         "tags": ["landscape", "sky"], "tip": "Đặt đường chân trời ở 1/3 dưới để bầu trời chiếm phần lớn khung",
         "guides": [line(0, 0.6667, 1, 0.6667)]},
        {"id": "scene-horizon-high", "name": "Đất rộng", "category": "scenery", "difficulty": 1,
         "tags": ["landscape"], "tip": "Đặt đường chân trời ở 1/3 trên để làm nổi mặt đất hoặc mặt nước",
         "guides": [line(0, 0.3333, 1, 0.3333)]},
        {"id": "scene-symmetry", "name": "Đối xứng", "category": "scenery", "difficulty": 2,
         "tags": ["architecture", "reflection"], "tip": "Căn trục giữa vào tâm công trình hoặc mặt nước phản chiếu",
         "guides": [line(0.5, 0, 0.5, 1), line(0, 0.5, 1, 0.5)]},
        {"id": "scene-leading-lines", "name": "Đường dẫn", "category": "scenery", "difficulty": 2,
         "tags": ["street", "road"], "tip": "Để con đường hoặc hàng cây dẫn mắt về điểm hội tụ",
         "guides": [line(0.04, 1, 0.5, 0.42), line(0.96, 1, 0.5, 0.42), line(0, 0.42, 1, 0.42)]},
        {"id": "scene-frame", "name": "Khung trong khung", "category": "scenery", "difficulty": 2,
         "tags": ["architecture"], "tip": "Dùng cửa sổ, cổng hoặc tán cây làm khung bao quanh cảnh",
         "guides": [rect(0.16, 0.16, 0.68, 0.68)]},
        {"id": "scene-person-small", "name": "Người nhỏ giữa cảnh rộng", "category": "scenery", "difficulty": 1,
         "tags": ["travel", "landscape"], "tip": "Người đứng nhỏ ở giao điểm 1/3, để cảnh vật chiếm phần lớn khung",
         "figures": [Figure(0.6667, 0.72, 0.3)], "guides": thirds()},
    ]


def pet_poses():
    return [
        {"id": "pet-eye-level", "name": "Ngang tầm mắt", "category": "pet", "difficulty": 1,
         "tags": ["pet"], "tip": "Hạ máy xuống ngang mắt thú cưng, chờ lúc bé nhìn vào ống kính",
         "guides": [line(0, 0.45, 1, 0.45), target(0.5, 0.55, "1", 0.22)]},
        {"id": "pet-thirds", "name": "Thú cưng lệch 1/3", "category": "pet", "difficulty": 1,
         "tags": ["pet"], "tip": "Đặt thú cưng ở 1/3 khung, chừa khoảng trống phía bé đang nhìn",
         "guides": thirds() + [target(0.3333, 0.62, "1", 0.16)]},
        {"id": "pet-with-owner", "name": "Ngồi cùng thú cưng", "category": "pet", "difficulty": 2,
         "tags": ["pet", "solo"], "tip": "Ngồi xổm cạnh thú cưng để cả hai cùng ngang tầm",
         "figures": [crouch(0.36, 0.72, 0.72)], "guides": [target(0.72, 0.74, "1", 0.13)]},
    ]


POSES = selfie_poses() + solo_poses() + duo_poses() + group_poses() + object_poses() + scenery_poses() + pet_poses()
