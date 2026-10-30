from __future__ import annotations

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.security import create_token
from conftest import Api, make_image


def test_register_returns_token_and_lowercase_user(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={"username": "Linh.Nguyen", "display_name": "Linh", "password": "secret1"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["token"]
    assert body["user"] == {
        "id": 1,
        "username": "linh.nguyen",
        "display_name": "Linh",
        "avatar_url": None,
    }

    me = client.get("/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json() == body["user"]


def test_display_name_defaults_to_username(client: TestClient) -> None:
    response = client.post("/auth/register", json={"username": "minh_99", "password": "secret1"})
    assert response.status_code == 201
    assert response.json()["user"]["display_name"] == "minh_99"


def test_login(api: Api, client: TestClient) -> None:
    api.register("linh", password="secret123")
    response = client.post("/auth/login", json={"username": "LINH", "password": "secret123"})
    assert response.status_code == 200
    assert response.json()["user"]["username"] == "linh"
    token = response.json()["token"]
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


@pytest.mark.parametrize("username,password", [("linh", "wrong-password"), ("nobody", "secret123")])
def test_login_rejects_bad_credentials(
    api: Api, client: TestClient, username: str, password: str
) -> None:
    api.register("linh", password="secret123")
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_credentials"
    assert response.json()["message"]


@pytest.mark.parametrize(
    "username", ["ab", "a" * 21, "linh nguyen", "linh-n", "líinh", "linh!", ""]
)
def test_register_rejects_invalid_username(client: TestClient, username: str) -> None:
    response = client.post(
        "/auth/register", json={"username": username, "display_name": "X", "password": "secret1"}
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "invalid_username"


def test_register_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/auth/register", json={"username": "linh", "display_name": "Linh", "password": "12345"}
    )
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "validation_error"
    assert "6" in body["message"]


def test_register_rejects_missing_fields(client: TestClient) -> None:
    response = client.post("/auth/register", json={"username": "linh"})
    assert response.status_code == 422
    assert response.json()["detail"] == "validation_error"


def test_register_rejects_duplicate_username_case_insensitively(
    api: Api, client: TestClient
) -> None:
    api.register("linh")
    response = client.post(
        "/auth/register", json={"username": "Linh", "display_name": "L", "password": "secret1"}
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "username_taken"


@pytest.mark.parametrize("header", [None, "Bearer not-a-jwt", "Basic abc"])
def test_protected_endpoints_need_a_valid_token(client: TestClient, header: str | None) -> None:
    headers = {"Authorization": header} if header else {}
    response = client.get("/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "unauthorized"


def test_token_signed_with_another_secret_is_rejected(api: Api, client: TestClient) -> None:
    account = api.register("linh")
    forged = create_token(account.id, "some-other-secret-of-sufficient-length!!", 30)
    response = client.get("/me", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_update_display_name(api: Api, client: TestClient) -> None:
    account = api.register("linh")
    response = client.patch(
        "/me", json={"display_name": "  Linh   Nguyễn "}, headers=account.headers
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Linh Nguyễn"

    bad = client.patch("/me", json={"display_name": "   "}, headers=account.headers)
    assert bad.status_code == 422
    assert bad.json()["detail"] == "validation_error"


def test_avatar_upload(api: Api, client: TestClient) -> None:
    account = api.register("linh")
    files = {"file": ("me.png", make_image(900, 600, fmt="PNG"), "image/png")}
    response = client.post("/me/avatar", files=files, headers=account.headers)
    assert response.status_code == 200
    assert response.json()["avatar_url"] == f"/media/avatars/{account.id}?v=1"

    again = client.post("/me/avatar", files=files, headers=account.headers)
    assert again.json()["avatar_url"] == f"/media/avatars/{account.id}?v=2"

    other = api.register("anh")
    image = client.get(f"/media/avatars/{account.id}", headers=other.headers)
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/jpeg"

    assert Image.open(BytesIO(image.content)).size == (400, 400)


def test_avatar_rejects_non_image(api: Api, client: TestClient) -> None:
    account = api.register("linh")
    files = {"file": ("notes.txt", b"hello, not an image", "text/plain")}
    response = client.post("/me/avatar", files=files, headers=account.headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "invalid_image"


def test_health_without_detector(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "detector": "unavailable"}
