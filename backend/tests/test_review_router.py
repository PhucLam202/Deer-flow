import asyncio
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.gateway.routers.review as review_router
from deerflow.config.paths import Paths


def test_get_review_tree_returns_nested_workspace_tree(tmp_path, monkeypatch):
    base_dir = tmp_path / ".deer-flow"
    thread_root = base_dir / "threads" / "thread-1"
    outputs_dir = thread_root / "user-data" / "outputs"
    workspace_dir = thread_root / "user-data" / "workspace" / "nested"
    outputs_dir.mkdir(parents=True)
    workspace_dir.mkdir(parents=True)
    (outputs_dir / "report.md").write_text("hello", encoding="utf-8")
    (workspace_dir / "app.py").write_text("print('x')", encoding="utf-8")

    monkeypatch.setattr(review_router, "get_paths", lambda: Paths(base_dir))

    app = FastAPI()
    app.include_router(review_router.router)

    with TestClient(app) as client:
        response = client.get("/api/threads/thread-1/review/tree")

    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "directory"
    assert body["path"] == ""
    assert [child["name"] for child in body["children"]] == ["user-data"]

    user_data = body["children"][0]
    assert user_data["kind"] == "directory"
    assert {child["name"] for child in user_data["children"]} == {"outputs", "workspace"}

    outputs = next(child for child in user_data["children"] if child["name"] == "outputs")
    report = outputs["children"][0]
    assert report["kind"] == "file"
    assert report["path"] == "user-data/outputs/report.md"
    assert report["size"] == 5


def test_get_review_tree_rejects_missing_thread(tmp_path, monkeypatch):
    base_dir = tmp_path / ".deer-flow"
    monkeypatch.setattr(review_router, "get_paths", lambda: Paths(base_dir))

    app = FastAPI()
    app.include_router(review_router.router)

    with TestClient(app) as client:
        response = client.get("/api/threads/thread-1/review/tree")

    assert response.status_code == 200
    assert response.json() == {
        "name": "thread-1",
        "path": "",
        "kind": "directory",
        "children": [],
        "size": None,
        "mime_type": None,
    }


def test_get_review_tree_rejects_invalid_thread_id(tmp_path, monkeypatch):
    base_dir = tmp_path / ".deer-flow"
    monkeypatch.setattr(review_router, "get_paths", lambda: Paths(base_dir))

    app = FastAPI()
    app.include_router(review_router.router)

    with TestClient(app) as client:
        response = client.get("/api/threads/../review/tree")

    assert response.status_code == 404


def test_get_review_preview_directory_injects_file_base_href(tmp_path, monkeypatch):
    base_dir = tmp_path / ".deer-flow"
    thread_root = base_dir / "threads" / "thread-1"
    preview_dir = thread_root / "site"
    preview_dir.mkdir(parents=True)
    (preview_dir / "index.html").write_text(
        "<html><head></head><body><link rel='stylesheet' href='/styles.css'></body></html>",
        encoding="utf-8",
    )

    monkeypatch.setattr(review_router, "get_paths", lambda: Paths(base_dir))

    app = FastAPI()
    app.include_router(review_router.router)

    with TestClient(app) as client:
        response = client.get("/api/threads/thread-1/review/preview/site")

    assert response.status_code == 200
    assert '<base href="/api/threads/thread-1/review/file/site/">' in response.text
    assert "href='./styles.css'" in response.text


def test_get_review_preview_html_file_keeps_selected_file(tmp_path, monkeypatch):
    base_dir = tmp_path / ".deer-flow"
    thread_root = base_dir / "threads" / "thread-1"
    preview_dir = thread_root / "site"
    preview_dir.mkdir(parents=True)
    (preview_dir / "landing.html").write_text("<html><head></head><body>ok</body></html>", encoding="utf-8")

    monkeypatch.setattr(review_router, "get_paths", lambda: Paths(base_dir))

    app = FastAPI()
    app.include_router(review_router.router)

    with TestClient(app) as client:
        response = client.get("/api/threads/thread-1/review/preview/site/landing.html")

    assert response.status_code == 200
    assert '<base href="/api/threads/thread-1/review/file/site/">' in response.text
    assert "ok" in response.text
