"""Secure uploads to Supabase Storage with MIME/size validation."""

from __future__ import annotations

import logging
import os
import re
import uuid
from typing import Callable, Optional, Set
from urllib.parse import quote

import requests
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile

logger = logging.getLogger("skilleraa.storage")

RESUME_MAX = 10 * 1024 * 1024
PORTFOLIO_MAX = 50 * 1024 * 1024

RESUME_MIME = {"application/pdf"}
PORTFOLIO_MIME = {
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "image/png",
    "image/jpeg",
}

RESUME_EXT = {"pdf"}
PORTFOLIO_EXT = {"pdf", "zip", "png", "jpg", "jpeg"}

EXT_TO_MIME = {
    "pdf": "application/pdf",
    "zip": "application/zip",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}


def _safe_filename(name: str) -> str:
    base = (name or "file").split("/")[-1].split("\\")[-1]
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return (base or "file")[:120]


def _ext(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def _assert_magic_bytes(ext: str, data: bytes) -> None:
    """Reject extension/MIME spoofing when content signatures do not match."""
    if ext == "pdf":
        if not data.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="File content is not a valid PDF")
    elif ext == "png":
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(status_code=400, detail="File content is not a valid PNG")
    elif ext in {"jpg", "jpeg"}:
        if not data.startswith(b"\xff\xd8\xff"):
            raise HTTPException(status_code=400, detail="File content is not a valid JPEG")
    elif ext == "zip":
        if not (data.startswith(b"PK\x03\x04") or data.startswith(b"PK\x05\x06") or data.startswith(b"PK\x07\x08")):
            raise HTTPException(status_code=400, detail="File content is not a valid ZIP")


def register_storage_routes(
    api_router,
    *,
    decode_token: Callable,
    supabase_url_getter: Callable[[], str],
    service_key_getter: Callable[[], Optional[str]],
    is_supabase_ready: Callable[[], bool],
):
    @api_router.post("/storage/upload")
    async def storage_upload(
        request: Request,
        file: UploadFile = File(...),
        kind: str = Query(...),
    ):
        kind = (kind or "").strip().lower()
        if kind not in {"resume", "portfolio"}:
            raise HTTPException(status_code=400, detail="kind must be 'resume' or 'portfolio'")
        if not is_supabase_ready():
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        supabase_url = (supabase_url_getter() or "").rstrip("/")
        service_key = service_key_getter()
        if not service_key:
            raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY is required for uploads")

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(auth_header[7:])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")

        original = _safe_filename(file.filename or "file")
        ext = _ext(original)
        content_type = (file.content_type or "").split(";")[0].strip().lower()

        if kind == "resume":
            max_bytes = RESUME_MAX
            allowed_mime: Set[str] = RESUME_MIME
            allowed_ext: Set[str] = RESUME_EXT
            bucket = "resumes"
            profile_col = "resume_url"
        else:
            max_bytes = PORTFOLIO_MAX
            allowed_mime = PORTFOLIO_MIME
            allowed_ext = PORTFOLIO_EXT
            bucket = "portfolios"
            profile_col = "portfolio_url"

        if ext not in allowed_ext:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type .{ext or '?'}. Allowed: {', '.join(sorted(allowed_ext))}",
            )

        expected_mime = EXT_TO_MIME.get(ext)
        # Browsers sometimes send empty/octet-stream; fall back to extension map
        if not content_type or content_type == "application/octet-stream":
            content_type = expected_mime or content_type
        if content_type not in allowed_mime:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid MIME type '{content_type or 'unknown'}'. Allowed: {', '.join(sorted(allowed_mime))}",
            )
        if expected_mime and content_type != expected_mime and not (
            ext == "zip" and content_type in {"application/zip", "application/x-zip-compressed"}
        ):
            # jpg/jpeg both map to image/jpeg
            if not (ext in {"jpg", "jpeg"} and content_type == "image/jpeg"):
                raise HTTPException(
                    status_code=400,
                    detail=f"MIME type '{content_type}' does not match file extension .{ext}",
                )

        data = await file.read()
        size = len(data)
        if size == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        if size > max_bytes:
            mb = max_bytes // (1024 * 1024)
            raise HTTPException(status_code=400, detail=f"File too large (max {mb} MB)")
        _assert_magic_bytes(ext, data)

        # Fetch previous path for cleanup
        prev_path = None
        try:
            prev_resp = requests.get(
                f"{supabase_url}/rest/v1/profiles",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key,
                },
                params={"id": f"eq.{uid}", "select": profile_col},
                timeout=20,
            )
            if prev_resp.ok and prev_resp.json():
                prev_path = prev_resp.json()[0].get(profile_col)
        except Exception as e:
            logger.warning("Could not load previous %s: %s", profile_col, e)

        object_path = f"{uid}/{uuid.uuid4().hex}.{ext}"
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{quote(object_path, safe='/')}"
        up = requests.post(
            upload_url,
            headers={
                "Authorization": f"Bearer {service_key}",
                "apikey": service_key,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            data=data,
            timeout=120,
        )
        if up.status_code >= 400:
            logger.error("Storage upload failed: %s %s", up.status_code, up.text[:300])
            raise HTTPException(status_code=502, detail="Failed to store file in Supabase Storage")

        # Persist path on profiles (bucket/path form for private buckets)
        stored_path = f"{bucket}/{object_path}"
        patch = requests.patch(
            f"{supabase_url}/rest/v1/profiles",
            headers={
                "Authorization": f"Bearer {service_key}",
                "apikey": service_key,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={"id": f"eq.{uid}"},
            json={profile_col: stored_path},
            timeout=20,
        )
        if patch.status_code >= 400:
            logger.error("Profile update failed: %s %s", patch.status_code, patch.text[:300])
            raise HTTPException(status_code=502, detail="File uploaded but failed to update profile")

        # Best-effort delete previous object in same bucket
        if prev_path and isinstance(prev_path, str) and prev_path.startswith(f"{bucket}/"):
            old_obj = prev_path[len(bucket) + 1 :]
            if old_obj and old_obj != object_path:
                try:
                    requests.delete(
                        f"{supabase_url}/storage/v1/object/{bucket}/{quote(old_obj, safe='/')}",
                        headers={
                            "Authorization": f"Bearer {service_key}",
                            "apikey": service_key,
                        },
                        timeout=20,
                    )
                except Exception as e:
                    logger.warning("Failed to delete previous file: %s", e)

        return {
            "ok": True,
            "kind": kind,
            "bucket": bucket,
            "path": stored_path,
            "filename": original,
            "size": size,
            "content_type": content_type,
            profile_col: stored_path,
        }

    @api_router.get("/storage/signed-url")
    async def signed_url(
        request: Request,
        path: str = Query(..., min_length=3),
        expires_in: int = Query(3600, ge=60, le=86400),
    ):
        """Create a short-lived signed URL for the owner's private file."""
        if not is_supabase_ready():
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        supabase_url = (supabase_url_getter() or "").rstrip("/")
        service_key = service_key_getter()
        if not service_key:
            raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY is required")

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(auth_header[7:])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")

        if "/" not in path:
            raise HTTPException(status_code=400, detail="Invalid path")
        bucket, object_path = path.split("/", 1)
        if bucket not in {"resumes", "portfolios"}:
            raise HTTPException(status_code=400, detail="Invalid bucket")
        owner_id = object_path.split("/", 1)[0]
        allowed = owner_id == uid
        if not allowed and bucket in {"resumes", "portfolios"}:
            # Job owners may open files for freelancers who applied to their jobs
            check = requests.get(
                f"{supabase_url}/rest/v1/applications",
                params={
                    "select": "id,jobs!inner(client_id)",
                    "freelancer_id": f"eq.{owner_id}",
                    "jobs.client_id": f"eq.{uid}",
                    "limit": "1",
                },
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key,
                },
                timeout=15,
            )
            if check.status_code < 400 and check.json():
                allowed = True
        if not allowed:
            raise HTTPException(status_code=403, detail="Not allowed")

        resp = requests.post(
            f"{supabase_url}/storage/v1/object/sign/{bucket}/{quote(object_path, safe='/')}",
            headers={
                "Authorization": f"Bearer {service_key}",
                "apikey": service_key,
                "Content-Type": "application/json",
            },
            json={"expiresIn": expires_in},
            timeout=20,
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail="Could not create signed URL")
        signed = resp.json().get("signedURL") or resp.json().get("signedUrl")
        if not signed:
            raise HTTPException(status_code=502, detail="Could not create signed URL")
        if signed.startswith("http"):
            url = signed
        else:
            url = f"{supabase_url}/storage/v1{signed}"
        return {"url": url, "path": path}
