from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from conftest import Account, Api, make_image


def three_friends(api: Api) -> tuple[Account, Account, Account, Account]:
    """linh is friends with anh and bao; chi is a stranger."""
    linh, anh, bao, chi = (api.register(n) for n in ("linh", "anh", "bao", "chi"))
    api.befriend(linh, anh)
    api.befriend(bao, linh)
    return linh, anh, bao, chi


def feed_ids(api: Api, account: Account, **params: object) -> list[int]:
    return [p["id"] for p in api.feed(account, **params)["items"]]


def test_upload_to_all_friends(api: Api, client: TestClient, settings: Settings) -> None:
    linh, anh, bao, chi = three_friends(api)
    photo = api.upload(
        linh, make_image(1600, 1200), caption="  Chiều nay ☀️ ", pose_id="solo-hand-on-hip"
    )
    assert photo["sender"]["id"] == linh.id
    assert photo["image_url"] == f"/media/photos/{photo['id']}"
    assert (photo["width"], photo["height"]) == (1080, 1080)
    assert photo["caption"] == "Chiều nay ☀️"
    assert photo["pose_id"] == "solo-hand-on-hip"
    assert photo["is_mine"] is True
    assert photo["reactions"] == []
    assert photo["created_at"].endswith("Z")
    assert (settings.photos_dir / f"{photo['id']}.jpg").is_file()

    assert feed_ids(api, anh) == [photo["id"]]
    assert feed_ids(api, bao) == [photo["id"]]
    assert feed_ids(api, chi) == []
    seen = api.feed(anh)["items"][0]
    assert seen["is_mine"] is False


def test_upload_to_selected_recipients(api: Api) -> None:
    linh, anh, bao, _ = three_friends(api)
    photo = api.upload(linh, recipient_ids=f" {anh.id} ,{anh.id}")
    assert feed_ids(api, anh) == [photo["id"]]
    assert feed_ids(api, bao) == []
    assert feed_ids(api, linh) == [photo["id"]]


def test_upload_rejects_non_friend_recipient(api: Api) -> None:
    linh, anh, _, chi = three_friends(api)
    body = api.upload(linh, recipient_ids=f"{anh.id},{chi.id}", expect=403)
    assert body["detail"] == "forbidden"
    assert api.upload(linh, recipient_ids=str(linh.id), expect=403)["detail"] == "forbidden"
    assert api.upload(linh, recipient_ids="abc", expect=422)["detail"] == "validation_error"
    assert feed_ids(api, anh) == []


def test_upload_without_friends(api: Api) -> None:
    loner = api.register("loner")
    assert api.upload(loner, expect=400)["detail"] == "no_recipients"


def test_caption_length(api: Api) -> None:
    linh, *_ = three_friends(api)
    assert api.upload(linh, caption="x" * 61, expect=422)["detail"] == "caption_too_long"
    assert api.upload(linh, caption="x" * 60)["caption"] == "x" * 60
    assert api.upload(linh, caption="   ")["caption"] is None


def test_upload_rejects_non_image(api: Api) -> None:
    linh, *_ = three_friends(api)
    assert api.upload(linh, b"definitely not a jpeg", expect=400)["detail"] == "invalid_image"
    assert api.upload(linh, b"", expect=400)["detail"] == "invalid_image"


def test_upload_accepts_png_and_webp(api: Api) -> None:
    linh, *_ = three_friends(api)
    png = api.upload(linh, make_image(300, 500, fmt="PNG"))
    assert (png["width"], png["height"]) == (300, 300)
    webp = api.upload(linh, make_image(500, 300, fmt="WEBP"))
    assert (webp["width"], webp["height"]) == (300, 300)


def test_feed_pagination(api: Api) -> None:
    linh, anh, *_ = three_friends(api)
    mine = [api.upload(linh)["id"] for _ in range(3)]
    theirs = [api.upload(anh)["id"] for _ in range(2)]
    everything = sorted(mine + theirs, reverse=True)

    first = api.feed(anh, limit=2)
    assert [p["id"] for p in first["items"]] == everything[:2]
    assert first["next_before_id"] == everything[1]
    second = api.feed(anh, limit=2, before_id=first["next_before_id"])
    assert [p["id"] for p in second["items"]] == everything[2:4]
    third = api.feed(anh, limit=2, before_id=second["next_before_id"])
    assert [p["id"] for p in third["items"]] == everything[4:]
    assert third["next_before_id"] is None

    assert feed_ids(api, anh, before_id="") == everything  # empty before_id = first page
    exact = api.feed(anh, limit=5)
    assert exact["next_before_id"] is None


def test_feed_rejects_bad_parameters(api: Api, client: TestClient) -> None:
    linh, *_ = three_friends(api)
    assert client.get("/photos/feed", params={"limit": 0}, headers=linh.headers).status_code == 422
    assert (
        client.get("/photos/feed", params={"before_id": "x"}, headers=linh.headers).status_code
        == 422
    )


def test_latest_for_widget(api: Api, client: TestClient) -> None:
    linh, anh, bao, _ = three_friends(api)
    assert client.get("/photos/latest", headers=anh.headers).status_code == 204
    api.upload(anh)  # my own photo does not count
    assert client.get("/photos/latest", headers=anh.headers).status_code == 204

    first = api.upload(linh)
    response = client.get("/photos/latest", headers=anh.headers)
    assert response.status_code == 200
    assert response.json()["id"] == first["id"]

    newer = api.upload(linh)
    assert client.get("/photos/latest", headers=anh.headers).json()["id"] == newer["id"]
    to_bao_only = api.upload(linh, recipient_ids=str(bao.id))
    assert client.get("/photos/latest", headers=anh.headers).json()["id"] == newer["id"]
    assert client.get("/photos/latest", headers=bao.headers).json()["id"] == to_bao_only["id"]

    # once no longer friends, their photos leave the widget
    client.delete(f"/friends/{linh.id}", headers=anh.headers)
    assert client.get("/photos/latest", headers=anh.headers).status_code == 204


def test_get_photo_permissions(api: Api, client: TestClient) -> None:
    linh, anh, _, chi = three_friends(api)
    photo = api.upload(linh)
    assert client.get(f"/photos/{photo['id']}", headers=linh.headers).json()["is_mine"] is True
    assert client.get(f"/photos/{photo['id']}", headers=anh.headers).status_code == 200
    stranger = client.get(f"/photos/{photo['id']}", headers=chi.headers)
    assert stranger.status_code == 403 and stranger.json()["detail"] == "forbidden"
    assert client.get("/photos/9999", headers=linh.headers).status_code == 404


def test_delete_photo(api: Api, client: TestClient, settings: Settings) -> None:
    linh, anh, _, chi = three_friends(api)
    photo = api.upload(linh)
    client.post(f"/photos/{photo['id']}/reactions", json={"emoji": "❤️"}, headers=anh.headers)
    for other in (anh, chi):
        response = client.delete(f"/photos/{photo['id']}", headers=other.headers)
        assert response.status_code == 403
        assert response.json()["detail"] == "forbidden"

    assert client.delete(f"/photos/{photo['id']}", headers=linh.headers).status_code == 204
    assert not (settings.photos_dir / f"{photo['id']}.jpg").exists()
    assert feed_ids(api, anh) == []
    assert client.get(f"/photos/{photo['id']}", headers=linh.headers).status_code == 404
    assert client.delete(f"/photos/{photo['id']}", headers=linh.headers).status_code == 404


def test_reactions(api: Api, client: TestClient) -> None:
    linh, anh, bao, chi = three_friends(api)
    photo_id = api.upload(linh)["id"]
    url = f"/photos/{photo_id}/reactions"

    first = client.post(url, json={"emoji": "❤️"}, headers=anh.headers)
    assert first.status_code == 200
    assert [(r["user"]["id"], r["emoji"]) for r in first.json()["reactions"]] == [(anh.id, "❤️")]

    client.post(url, json={"emoji": "😂"}, headers=bao.headers)
    replaced = client.post(url, json={"emoji": "🔥"}, headers=anh.headers).json()
    assert sorted((r["user"]["id"], r["emoji"]) for r in replaced["reactions"]) == sorted(
        [(anh.id, "🔥"), (bao.id, "😂")]
    )
    assert replaced["is_mine"] is False

    removed = client.delete(url, headers=anh.headers)
    assert removed.status_code == 200
    assert [(r["user"]["id"], r["emoji"]) for r in removed.json()["reactions"]] == [(bao.id, "😂")]
    assert client.delete(url, headers=anh.headers).status_code == 200  # nothing left to remove

    feed_photo = api.feed(linh)["items"][0]
    assert [r["emoji"] for r in feed_photo["reactions"]] == ["😂"]

    assert client.post(url, json={"emoji": "❤️"}, headers=chi.headers).status_code == 403
    assert client.post(url, json={"emoji": ""}, headers=anh.headers).status_code == 422
    assert (
        client.post("/photos/9999/reactions", json={"emoji": "❤️"}, headers=anh.headers).status_code
        == 404
    )


def test_retried_upload_with_same_client_id_creates_one_photo(api: Api) -> None:
    linh, anh, _, chi = three_friends(api)
    first = api.upload(linh, client_id="cap-7f3a9c21", caption="Một lần thôi")
    again = api.upload(linh, client_id="cap-7f3a9c21", caption="Một lần thôi")
    assert again["id"] == first["id"]
    assert feed_ids(api, anh) == [first["id"]]
    # Another sender may use the same key; the key only deduplicates per sender.
    api.befriend(chi, anh)
    other = api.upload(chi, client_id="cap-7f3a9c21")
    assert other["id"] != first["id"]
    # A new key is a new photo; malformed keys are rejected.
    assert api.upload(linh, client_id="cap-8b4d0e55")["id"] != first["id"]
    assert api.upload(linh, client_id="bad key!", expect=422)["detail"] == "validation_error"
