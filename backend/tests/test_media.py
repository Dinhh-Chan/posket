from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image

from conftest import Api, make_image


def test_photo_media_access(api: Api, client: TestClient) -> None:
    linh, anh, chi = api.register("linh"), api.register("anh"), api.register("chi")
    api.befriend(linh, anh)
    photo = api.upload(linh, make_image(1200, 800))
    url = photo["image_url"]

    for viewer in (linh, anh):
        response = client.get(url, headers=viewer.headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert Image.open(io.BytesIO(response.content)).size == (800, 800)

    stranger = client.get(url, headers=chi.headers)
    assert stranger.status_code in (403, 404)
    assert stranger.json()["detail"] in ("forbidden", "not_found")
    assert client.get(url).status_code == 401
    assert client.get("/media/photos/9999", headers=linh.headers).status_code == 404


def test_avatar_media(api: Api, client: TestClient) -> None:
    linh, anh = api.register("linh"), api.register("anh")
    missing = client.get(f"/media/avatars/{linh.id}", headers=anh.headers)
    assert missing.status_code == 404
    client.post(
        "/me/avatar", files={"file": ("a.jpg", make_image(), "image/jpeg")}, headers=linh.headers
    )
    assert client.get(f"/media/avatars/{linh.id}", headers=anh.headers).status_code == 200
    assert client.get(f"/media/avatars/{linh.id}").status_code == 401
    assert client.get("/media/avatars/9999", headers=anh.headers).status_code == 404
