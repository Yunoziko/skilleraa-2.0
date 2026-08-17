"""CORS origin allowlist for FastAPI.

Never use "*" with credentialed requests. Production hosts are always merged in
so a stale Railway CORS_ORIGINS (e.g. localhost-only) cannot block skilleraa.com.
"""

from __future__ import annotations

from typing import Iterable, List, Optional

LOCAL_ORIGINS: tuple[str, ...] = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)

PRODUCTION_ORIGINS: tuple[str, ...] = (
    "https://www.skilleraa.com",
    "https://skilleraa.com",
    "https://skilleraa-2-0.vercel.app",
)

REQUIRED_ORIGINS: tuple[str, ...] = LOCAL_ORIGINS + PRODUCTION_ORIGINS

# Exact-host regex (not "*"). Covers optional trailing slash; browsers omit it,
# some proxies send it. Local CRA ports stay allowlisted for development.
CORS_ORIGIN_REGEX = (
    r"https://(www\.)?skilleraa\.com/?"
    r"|https://skilleraa-2-0\.vercel\.app/?"
    r"|http://(localhost|127\.0\.0\.1):\d{2,5}/?"
)


def _clean_part(part: str) -> str:
    return part.strip().strip("\"'").strip()


def _variants(origin: str) -> List[str]:
    base = origin.rstrip("/")
    if not base:
        return []
    return [base, f"{base}/"]


def build_cors_allowlist(
    raw: Optional[str] = None,
    extra: Optional[Iterable[str]] = None,
) -> List[str]:
    """Parse CORS_ORIGINS, drop wildcards, always include required hosts."""
    seen: List[str] = []

    def add(origin: str) -> None:
        cleaned = _clean_part(origin)
        if not cleaned or cleaned == "*":
            return
        for variant in _variants(cleaned):
            if variant not in seen:
                seen.append(variant)

    if raw:
        for part in _clean_part(raw).split(","):
            add(part)

    for origin in REQUIRED_ORIGINS:
        add(origin)

    if extra:
        for origin in extra:
            add(origin)

    return seen
