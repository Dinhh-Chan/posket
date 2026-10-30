# PoseCam API contract (v1)

Base URL in development: `http://10.0.2.2:8000` from the Android emulator, `http://<LAN-IP>:8000`
from a phone. All JSON. Auth: `Authorization: Bearer <jwt>` on every endpoint except register,
login, health and the pose library. Timestamps are ISO-8601 UTC strings. IDs are integers.

Errors: HTTP status + `{"detail": "<machine_code>", "message": "<Vietnamese text for the UI>"}`.
Codes used below: `invalid_credentials`, `username_taken`, `invalid_username`, `not_found`,
`forbidden`, `already_friends`, `request_exists`, `cannot_friend_self`, `invalid_image`,
`caption_too_long`, `no_recipients`.

## Objects

```jsonc
// User
{"id": 1, "username": "linh", "display_name": "Linh", "avatar_url": "/media/avatars/1?v=3" /* or null */}

// Photo (as seen in a feed)
{"id": 12, "sender": User, "image_url": "/media/photos/12", "width": 1080, "height": 1080,
 "caption": "Chiều nay ☀️" /* or null */, "pose_id": "solo-hand-on-hip" /* or null */,
 "created_at": "2026-10-30T15:04:05Z", "is_mine": false,
 "reactions": [{"user": User, "emoji": "❤️", "created_at": "..."}]}

// FriendRequest
{"id": 4, "from_user": User, "to_user": User, "status": "pending", "created_at": "..."}
```

## Health
- `GET /health` → `{"status": "ok", "detector": "mediapipe" | "unavailable"}`

## Auth
- `POST /auth/register` `{"username", "display_name", "password"}` → `201 {"token", "user": User}`.
  Username: 3–20 chars `[a-z0-9_.]`, stored lowercase. Password ≥ 6 chars.
- `POST /auth/login` `{"username", "password"}` → `{"token", "user": User}`
- `GET /me` → `User`
- `PATCH /me` `{"display_name"}` → `User`
- `POST /me/avatar` multipart `file` (jpeg/png) → `User` (server crops square, 400 px)

## Users & friends
- `GET /users/search?q=lin` → `[User]` (prefix match on username, max 20, excludes self)
- `GET /friends` → `[User]`
- `GET /friends/requests` → `{"incoming": [FriendRequest], "outgoing": [FriendRequest]}` (pending only)
- `POST /friends/requests` `{"username"}` → `201 FriendRequest`. If the other user already sent a
  pending request to me, it is accepted instead and the response has `status: "accepted"`.
- `POST /friends/requests/{id}/accept` → `FriendRequest` (only the recipient)
- `POST /friends/requests/{id}/decline` → `FriendRequest` (only the recipient)
- `DELETE /friends/{user_id}` → `204`

## Photos
- `POST /photos` multipart:
  - `file`: JPEG/PNG/WebP, any aspect ratio,
  - `caption` (optional, ≤ 60 chars),
  - `recipient_ids` (optional, comma-separated; omitted or empty = all friends; must be friends),
  - `mirror` (`true`/`false`, default false: flip horizontally, for front-camera snapshots that are not mirrored),
  - `pose_id` (optional).
  The server crops the centre square, applies EXIF orientation, mirrors if asked, resizes to at most
  1080×1080, strips metadata and stores JPEG q=88. → `201 Photo`.
- `GET /photos/feed?before_id=&limit=30` → `{"items": [Photo], "next_before_id": 7 | null}`.
  Photos I sent plus photos sent to me, newest first.
- `GET /photos/latest` → `Photo` (newest photo a friend sent to me) or `204` if none. Used by the widget.
- `GET /photos/{id}` → `Photo` (sender or recipient only)
- `DELETE /photos/{id}` → `204` (sender only)
- `POST /photos/{id}/reactions` `{"emoji"}` → `Photo`. One reaction per user per photo; sending
  again replaces it. `DELETE /photos/{id}/reactions` → `Photo`.

## Media (auth required, same Bearer header)
- `GET /media/photos/{id}` → `image/jpeg` (sender or recipient only)
- `GET /media/avatars/{user_id}` → `image/jpeg` (any logged-in user)

## Pose library
- `GET /poses` → the library JSON below (no auth). The app also bundles the same file.

```jsonc
{
  "version": 1,
  "keypoints": ["nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder",
                "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
                "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"],
  "limbs": [ {"id": "left_upper_arm", "from": 5, "to": 7, "label": "cánh tay trái"}, ... ],
  "categories": [ {"id": "selfie", "label": "Selfie", "emoji": "🤳"}, ... ],
  "poses": [
    {
      "id": "solo-hand-on-hip", "name": "Chống hông", "category": "solo",
      "kind": "body",                 // "body" (match people) | "composition" (guides only, or objects)
      "people": 1,                    // number of people the pose expects (0 for composition)
      "objects": 0,                   // number of objects expected (composition with targets)
      "difficulty": 1,                // 1 easy … 3 hard
      "tags": ["standing"],
      "tip": "Một tay chống hông, dồn trọng tâm sang một chân",
      // kind=body: one entry per person, 17 keypoints [x, y] normalised to the SQUARE frame
      // (0..1, y down, as displayed on screen); null = not part of the pose (e.g. selfie legs)
      // "head" is the circle to draw for the head (already sized for the pose's scale and yaw)
      "persons": [ {"keypoints": [[0.52, 0.18], ...], "head": {"cx": 0.52, "cy": 0.16, "r": 0.05}} ],
      // optional on any pose; drawn as dashed guide strokes
      "guides": [ {"type": "line", "x1": 0, "y1": 0.33, "x2": 1, "y2": 0.33},
                  {"type": "rect", "x": 0.2, "y": 0.2, "w": 0.6, "h": 0.6},
                  {"type": "ellipse", "cx": 0.5, "cy": 0.35, "rx": 0.18, "ry": 0.23},
                  {"type": "target", "cx": 0.33, "cy": 0.66, "r": 0.08, "label": "1"} ]
    }
  ]
}
```

Rendering rules for the app: draw guides as dashed white strokes (opacity 0.6); for each person draw
each limb whose two keypoints are non-null as a thick rounded white stroke (width ≈ 0.028 of the
square side), plus a neck stroke from the shoulder midpoint to the head circle, and the head as the
`head` circle. Targets are circles with their label in the centre. When a `match` is present, colour each limb by
`limbs[i].ok` (green `#4ADE80` / red `#F87171`); limbs absent from `match.limbs` stay white.

## Live analysis
- `POST /analyze` multipart:
  - `file` (JPEG snapshot, any aspect ratio),
  - `mirror` (`true` if the app displays a mirrored preview and the snapshot is not mirrored),
  - `pose_id` (optional: score against this pose).

  The server crops the centre square and mirrors if asked, so every coordinate below is in
  displayed-square space (0..1, y down).

```jsonc
{
  "persons": [ {"keypoints": [[x, y, visibility], ... 17], "bbox": [x, y, w, h], "score": 0.93} ],
  "objects": [ {"label": "cup", "score": 0.81, "bbox": [x, y, w, h]} ],   // persons excluded
  "scene": {"kind": "solo", "person_count": 1, "object_count": 0},
  // kind ∈ selfie | solo | duo | group | objects | pet | scenery
  "suggestions": [ {"pose_id": "solo-arms-crossed", "score": 0.82, "reason": "Phát hiện 1 người"} ],  // ≤ 8
  "match": null | {
    "pose_id": "solo-hand-on-hip",
    "status": "ok" | "no_person" | "wrong_count" | "partial" | "not_applicable",
    "score": 87,                 // 0..100, null unless status is ok or partial
    "ready": true,               // score >= 85 and status == ok
    "limbs": [ {"person": 0, "limb": "left_upper_arm", "ok": true, "score": 0.93} ],
    "hints": ["Giơ tay phải cao hơn", "Lùi ra xa một chút"]   // Vietnamese, most important first, ≤ 2
  },
  "elapsed_ms": 140
}
```

The app calls `/analyze` at most every ~650 ms while the camera screen is focused and a pose is
selected (or the Gợi ý tab is open), skips a tick if the previous request is still running, and
uses a small snapshot (longest side ≤ 640 px, JPEG quality ≈ 50).
