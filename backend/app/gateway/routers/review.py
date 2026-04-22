"""Review mode endpoints for browsing a thread's persisted workspace."""

from __future__ import annotations

import mimetypes
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field

from deerflow.config.paths import get_paths

router = APIRouter(prefix="/api/threads", tags=["review"])

ACTIVE_CONTENT_MIME_TYPES = {
    "text/html",
    "application/xhtml+xml",
    "image/svg+xml",
}


class ReviewTreeNode(BaseModel):
    name: str = Field(description="Display name for the node")
    path: str = Field(description="Thread-relative path")
    kind: str = Field(description="file or directory")
    children: list["ReviewTreeNode"] = Field(default_factory=list)
    size: int | None = Field(default=None, description="File size in bytes")
    mime_type: str | None = Field(default=None, description="Guessed MIME type")


ReviewTreeNode.model_rebuild()


@dataclass
class _TreeBuilder:
    name: str
    path: str
    children: dict[str, "_TreeBuilder"] = field(default_factory=dict)
    size: int | None = None
    mime_type: str | None = None

    def to_node(self) -> ReviewTreeNode:
        if self.children:
            def _sort_key(child: _TreeBuilder) -> tuple[int, str]:
                return (0 if child.children else 1, child.name.lower())

            return ReviewTreeNode(
                name=self.name,
                path=self.path,
                kind="directory",
                children=[child.to_node() for child in sorted(self.children.values(), key=_sort_key)],
            )
        return ReviewTreeNode(
            name=self.name,
            path=self.path,
            kind="file",
            size=self.size,
            mime_type=self.mime_type,
        )


def _thread_root(thread_id: str) -> Path:
    try:
        root = get_paths().thread_dir(thread_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return root


def _resolve_review_path(thread_id: str, path: str) -> Path:
    root = _thread_root(thread_id)
    if not root.exists():
        raise HTTPException(status_code=404, detail=f"Thread {thread_id} not found")

    actual = (root / path).resolve()
    try:
        actual.relative_to(root.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Path traversal detected") from exc
    return actual


def _build_content_disposition(disposition_type: str, filename: str) -> str:
    return f"{disposition_type}; filename*=UTF-8''{quote(filename)}"


def _inject_base_href(html: str, base_href: str) -> str:
    if "<base" in html.lower():
        return html
    head_match = re.search(r"<head[^>]*>", html, flags=re.IGNORECASE)
    if not head_match:
        return html
    insertion = f'{head_match.group(0)}\n    <base href="{base_href}">'
    return html[: head_match.start()] + insertion + html[head_match.end() :]


def _review_file_base_href(thread_id: str, path: str) -> str:
    normalized = path.strip("/")
    if not normalized:
        return f"/api/threads/{thread_id}/review/file/"
    encoded = "/".join(quote(part) for part in normalized.split("/"))
    return f"/api/threads/{thread_id}/review/file/{encoded}/"


def _rewrite_html_for_preview(html: str, *, base_href: str) -> str:
    rewritten = html.replace("%PUBLIC_URL%", ".")
    rewritten = re.sub(
        r'(?P<prefix>\b(?:href|src)=)(?P<quote>["\'])/(?P<path>(?!/)[^"\']+)(?P=quote)',
        lambda match: f'{match.group("prefix")}{match.group("quote")}./{match.group("path")}{match.group("quote")}',
        rewritten,
    )
    return _inject_base_href(rewritten, base_href)


def _build_tree(root: Path) -> ReviewTreeNode:
    builder = _TreeBuilder(name=root.name, path="")
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        parts = rel.split("/")
        cursor = builder
        current_parts: list[str] = []
        for part in parts[:-1]:
            current_parts.append(part)
            cursor = cursor.children.setdefault(
                part,
                _TreeBuilder(name=part, path="/".join(current_parts)),
            )
        file_name = parts[-1]
        cursor.children[file_name] = _TreeBuilder(
            name=file_name,
            path=rel,
            size=path.stat().st_size,
            mime_type=mimetypes.guess_type(path.name)[0],
        )
    return builder.to_node()


@router.get("/{thread_id}/review/tree", response_model=ReviewTreeNode)
async def get_review_tree(thread_id: str) -> ReviewTreeNode:
    """Return a directory tree for a thread's persisted workspace."""
    root = _thread_root(thread_id)
    if not root.exists():
        return ReviewTreeNode(
            name=thread_id,
            path="",
            kind="directory",
            children=[],
        )
    return _build_tree(root)


@router.get("/{thread_id}/review/file/{path:path}")
async def get_review_file(thread_id: str, path: str, download: bool = False) -> Response:
    """Return a file from a thread's persisted workspace."""
    actual_path = _resolve_review_path(thread_id, path)

    if not actual_path.exists():
        raise HTTPException(status_code=404, detail=f"Review file not found: {path}")
    if not actual_path.is_file():
        raise HTTPException(status_code=400, detail=f"Path is not a file: {path}")

    mime_type, _ = mimetypes.guess_type(actual_path)

    if download:
        return FileResponse(
            path=actual_path,
            filename=actual_path.name,
            media_type=mime_type,
            headers={"Content-Disposition": _build_content_disposition("attachment", actual_path.name)},
        )

    if mime_type in ACTIVE_CONTENT_MIME_TYPES:
        return FileResponse(
            path=actual_path,
            filename=actual_path.name,
            media_type=mime_type,
        )

    if mime_type and mime_type.startswith("text/"):
        content = actual_path.read_text(encoding="utf-8")
        if mime_type == "text/html":
            return Response(
                content=_rewrite_html_for_preview(content, base_href=_review_file_base_href(thread_id, path.rsplit("/", 1)[0])),
                media_type="text/html",
            )
        return PlainTextResponse(content=content, media_type=mime_type)

    try:
        content = actual_path.read_text(encoding="utf-8")
        if actual_path.suffix.lower() == ".html":
            return Response(
                content=_rewrite_html_for_preview(content, base_href=_review_file_base_href(thread_id, path.rsplit("/", 1)[0])),
                media_type="text/html",
            )
        return PlainTextResponse(content=content, media_type="text/plain")
    except UnicodeDecodeError:
        return Response(
            content=actual_path.read_bytes(),
            media_type=mime_type or "application/octet-stream",
            headers={"Content-Disposition": _build_content_disposition("inline", actual_path.name)},
        )


@router.get("/{thread_id}/review/preview/{path:path}")
async def get_review_preview(thread_id: str, path: str) -> Response:
    """Return a browser-friendly preview for a directory or HTML file."""
    actual_path = _resolve_review_path(thread_id, path)

    if actual_path.is_dir():
        index_html = actual_path / "index.html"
        if not index_html.exists():
            raise HTTPException(status_code=404, detail=f"No index.html found in preview directory: {path}")
        content = index_html.read_text(encoding="utf-8")
        return Response(
            content=_rewrite_html_for_preview(content, base_href=_review_file_base_href(thread_id, path)),
            media_type="text/html",
        )

    if actual_path.is_file():
        if actual_path.suffix.lower() == ".html":
            content = actual_path.read_text(encoding="utf-8")
            return Response(
                content=_rewrite_html_for_preview(content, base_href=_review_file_base_href(thread_id, path.rsplit("/", 1)[0])),
                media_type="text/html",
            )
        raise HTTPException(status_code=400, detail="Preview is only supported for HTML files or directories")

    raise HTTPException(status_code=404, detail=f"Preview target not found: {path}")
