"""Supabase PostgREST helpers for the FastAPI backend (service role)."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Union

import requests
from fastapi import HTTPException

logger = logging.getLogger("skilleraa.supabase_db")


def _placeholder(value: Optional[str]) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return "placeholder" in lowered or "your_" in lowered or "your-" in lowered


def supabase_url() -> str:
    return (os.environ.get("SUPABASE_URL") or "").rstrip("/")


def service_key() -> str:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""


def require_supabase() -> tuple[str, str]:
    url = supabase_url()
    key = service_key()
    if _placeholder(url) or _placeholder(key):
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    if not (url.startswith("https://") or url.startswith("http://")):
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    return url, key


def rest(
    method: str,
    table: str,
    *,
    params: Optional[Dict[str, str]] = None,
    json_body: Any = None,
    prefer: str = "return=representation",
    user_token: Optional[str] = None,
) -> Any:
    """
    Call PostgREST. Uses service role by default (bypasses RLS).
    Pass user_token to act as the authenticated user instead.
    """
    url, key = require_supabase()
    token = user_token or key
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": key,
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    resp = requests.request(
        method,
        f"{url}/rest/v1/{table.lstrip('/')}",
        headers=headers,
        params=params,
        json=json_body,
        timeout=30,
    )
    if resp.status_code >= 400:
        logger.error("Supabase REST %s %s -> %s %s", method, table, resp.status_code, resp.text[:400])
        raise HTTPException(status_code=502, detail="Database error")
    if resp.status_code == 204 or not resp.content:
        return None
    return resp.json()


def get_rows(table: str, params: Dict[str, str]) -> List[dict]:
    data = rest("GET", table, params=params)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]


def get_one(table: str, params: Dict[str, str]) -> Optional[dict]:
    rows = get_rows(table, {**params, "limit": "1"})
    return rows[0] if rows else None


def count_rows(table: str, params: Optional[Dict[str, str]] = None) -> int:
    url, key = require_supabase()
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Prefer": "count=exact",
        "Range-Unit": "items",
        "Range": "0-0",
    }
    resp = requests.get(
        f"{url}/rest/v1/{table.lstrip('/')}",
        headers=headers,
        params={**(params or {}), "select": "id"},
        timeout=30,
    )
    if resp.status_code >= 400:
        logger.error("Supabase count %s -> %s %s", table, resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="Database error")
    # Content-Range: 0-0/123
    cr = resp.headers.get("Content-Range") or resp.headers.get("content-range") or ""
    if "/" in cr:
        total = cr.split("/")[-1]
        if total.isdigit():
            return int(total)
    return 0
