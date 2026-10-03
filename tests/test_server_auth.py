from fastapi import FastAPI
from fastapi.testclient import TestClient

from server_auth import InternalTokenMiddleware


def make_client(token):
    app = FastAPI()

    @app.get("/list-apps")
    def list_apps():
        return ["a"]

    app.add_middleware(InternalTokenMiddleware, token=token)
    return TestClient(app)


def test_rejects_missing_token():
    assert make_client("s3cret").get("/list-apps").status_code == 401


def test_rejects_wrong_token():
    r = make_client("s3cret").get("/list-apps", headers={"X-Internal-Token": "nope"})
    assert r.status_code == 401


def test_accepts_matching_token():
    r = make_client("s3cret").get("/list-apps", headers={"X-Internal-Token": "s3cret"})
    assert r.status_code == 200
    assert r.json() == ["a"]


def test_open_when_no_token_configured():
    assert make_client(None).get("/list-apps").status_code == 200
