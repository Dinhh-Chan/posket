from __future__ import annotations

from fastapi.testclient import TestClient

from conftest import Api


def names(users: list[dict]) -> list[str]:
    return [u["username"] for u in users]


def test_search_by_prefix_excludes_self(api: Api, client: TestClient) -> None:
    me = api.register("linh")
    for name in ("lina", "linh_2", "lin.x", "an", "bao"):
        if len(name) >= 3:
            api.register(name)
    response = client.get("/users/search", params={"q": "LIN"}, headers=me.headers)
    assert response.status_code == 200
    assert names(response.json()) == ["lin.x", "lina", "linh_2"]
    # "_" is matched literally, not as a wildcard
    assert names(client.get("/users/search", params={"q": "linh_"}, headers=me.headers).json()) == [
        "linh_2"
    ]
    assert client.get("/users/search", params={"q": ""}, headers=me.headers).json() == []


def test_search_returns_at_most_20(api: Api, client: TestClient) -> None:
    me = api.register("me_user")
    for i in range(23):
        api.register(f"user{i:02d}")
    response = client.get("/users/search", params={"q": "user"}, headers=me.headers)
    assert len(response.json()) == 20


def test_request_and_accept(api: Api, client: TestClient) -> None:
    linh, anh = api.register("linh"), api.register("anh")
    sent = client.post("/friends/requests", json={"username": "Anh"}, headers=linh.headers)
    assert sent.status_code == 201
    request = sent.json()
    assert request["status"] == "pending"
    assert request["from_user"]["id"] == linh.id and request["to_user"]["id"] == anh.id

    incoming = client.get("/friends/requests", headers=anh.headers).json()
    assert [r["id"] for r in incoming["incoming"]] == [request["id"]] and incoming["outgoing"] == []
    outgoing = client.get("/friends/requests", headers=linh.headers).json()
    assert [r["id"] for r in outgoing["outgoing"]] == [request["id"]] and outgoing["incoming"] == []

    accepted = client.post(f"/friends/requests/{request['id']}/accept", headers=anh.headers)
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert names(client.get("/friends", headers=linh.headers).json()) == ["anh"]
    assert names(client.get("/friends", headers=anh.headers).json()) == ["linh"]
    assert client.get("/friends/requests", headers=anh.headers).json() == {
        "incoming": [],
        "outgoing": [],
    }


def test_only_the_recipient_can_answer(api: Api, client: TestClient) -> None:
    linh, anh, bao = api.register("linh"), api.register("anh"), api.register("bao")
    request_id = client.post(
        "/friends/requests", json={"username": "anh"}, headers=linh.headers
    ).json()["id"]
    for account in (linh, bao):
        for action in ("accept", "decline"):
            response = client.post(
                f"/friends/requests/{request_id}/{action}", headers=account.headers
            )
            assert response.status_code == 403
            assert response.json()["detail"] == "forbidden"
    missing = client.post("/friends/requests/999/accept", headers=anh.headers)
    assert missing.status_code == 404 and missing.json()["detail"] == "not_found"


def test_decline(api: Api, client: TestClient) -> None:
    linh, anh = api.register("linh"), api.register("anh")
    request_id = client.post(
        "/friends/requests", json={"username": "anh"}, headers=linh.headers
    ).json()["id"]
    declined = client.post(f"/friends/requests/{request_id}/decline", headers=anh.headers)
    assert declined.status_code == 200
    assert declined.json()["status"] == "declined"
    assert client.get("/friends", headers=linh.headers).json() == []
    assert client.get("/friends/requests", headers=linh.headers).json()["outgoing"] == []
    # a declined request can no longer be accepted, but a new one can be sent
    assert (
        client.post(f"/friends/requests/{request_id}/accept", headers=anh.headers).status_code
        == 404
    )
    assert (
        client.post("/friends/requests", json={"username": "anh"}, headers=linh.headers).status_code
        == 201
    )


def test_request_to_someone_who_already_asked_me_is_accepted(api: Api, client: TestClient) -> None:
    linh, anh = api.register("linh"), api.register("anh")
    first = client.post("/friends/requests", json={"username": "anh"}, headers=linh.headers).json()
    response = client.post("/friends/requests", json={"username": "linh"}, headers=anh.headers)
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == first["id"]
    assert body["status"] == "accepted"
    assert names(client.get("/friends", headers=anh.headers).json()) == ["linh"]
    assert client.get("/friends/requests", headers=linh.headers).json() == {
        "incoming": [],
        "outgoing": [],
    }


def test_request_errors(api: Api, client: TestClient) -> None:
    linh, anh = api.register("linh"), api.register("anh")

    def send(username: str) -> tuple[int, str | None]:
        response = client.post(
            "/friends/requests", json={"username": username}, headers=linh.headers
        )
        return response.status_code, response.json().get("detail")

    assert send("linh") == (400, "cannot_friend_self")
    assert send("nobody") == (404, "not_found")
    assert send("anh")[0] == 201
    assert send("anh") == (409, "request_exists")
    request_id = client.get("/friends/requests", headers=anh.headers).json()["incoming"][0]["id"]
    client.post(f"/friends/requests/{request_id}/accept", headers=anh.headers)
    assert send("anh") == (409, "already_friends")


def test_remove_friend(api: Api, client: TestClient) -> None:
    linh, anh = api.register("linh"), api.register("anh")
    api.befriend(linh, anh)
    response = client.delete(f"/friends/{anh.id}", headers=linh.headers)
    assert response.status_code == 204
    assert client.get("/friends", headers=linh.headers).json() == []
    assert client.get("/friends", headers=anh.headers).json() == []
    again = client.delete(f"/friends/{anh.id}", headers=linh.headers)
    assert again.status_code == 404
    # they can become friends again
    api.befriend(anh, linh)
    assert names(client.get("/friends", headers=linh.headers).json()) == ["anh"]


def test_friend_endpoints_need_auth(client: TestClient) -> None:
    assert client.get("/friends").status_code == 401
    assert client.get("/users/search", params={"q": "a"}).status_code == 401
    assert client.post("/friends/requests", json={"username": "x"}).status_code == 401
