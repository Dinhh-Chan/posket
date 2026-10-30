"""Shared fixtures: a fresh app (own SQLite file and photo folders) per test, inside one temporary
directory per test session; helpers to register users, make friends and upload photos."""

from __future__ import annotations

import io
import itertools
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"
_counter = itertools.count()


def make_image(
    width: int = 640,
    height: int = 480,
    color: tuple[int, int, int] = (200, 60, 40),
    fmt: str = "JPEG",
) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format=fmt)
    return buffer.getvalue()


@pytest.fixture(scope="session")
def data_root(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return tmp_path_factory.mktemp("posecam-data")


@pytest.fixture
def settings(data_root: Path) -> Settings:
    return Settings(
        data_dir=data_root / f"app{next(_counter)}",
        models_dir=data_root / "no-models",
        secret="test-secret-that-is-long-enough-for-hs256",
        secret_is_default=False,
        detector="off",
        bcrypt_rounds=4,
        detector_warmup=False,
    )


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


class Account:
    def __init__(self, user: dict[str, Any], token: str) -> None:
        self.user = user
        self.token = token

    @property
    def id(self) -> int:
        return self.user["id"]

    @property
    def username(self) -> str:
        return self.user["username"]

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


class Api:
    """Small helpers over the HTTP API, so tests read as user stories."""

    def __init__(self, client: TestClient) -> None:
        self.client = client

    def register(self, username: str, password: str = "secret123", **extra: Any) -> Account:
        response = self.client.post(
            "/auth/register",
            json={
                "username": username,
                "password": password,
                "display_name": username.title(),
                **extra,
            },
        )
        assert response.status_code == 201, response.text
        body = response.json()
        return Account(body["user"], body["token"])

    def befriend(self, a: Account, b: Account) -> None:
        sent = self.client.post(
            "/friends/requests", json={"username": b.username}, headers=a.headers
        )
        assert sent.status_code == 201, sent.text
        accepted = self.client.post(
            f"/friends/requests/{sent.json()['id']}/accept", headers=b.headers
        )
        assert accepted.status_code == 200, accepted.text

    def upload(
        self,
        account: Account,
        image: bytes | None = None,
        expect: int = 201,
        **form: Any,
    ) -> dict[str, Any]:
        files = {"file": ("photo.jpg", image if image is not None else make_image(), "image/jpeg")}
        data = {k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in form.items()}
        response = self.client.post("/photos", files=files, data=data, headers=account.headers)
        assert response.status_code == expect, response.text
        return response.json()

    def feed(self, account: Account, **params: Any) -> dict[str, Any]:
        response = self.client.get("/photos/feed", params=params, headers=account.headers)
        assert response.status_code == 200, response.text
        return response.json()


@pytest.fixture
def api(client: TestClient) -> Api:
    return Api(client)
