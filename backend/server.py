"""
Skilleraa FastAPI backend — Supabase Postgres is the data store (no MongoDB).
"""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import re
import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional, Literal

import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File, Header
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import supabase_db as sb
except ImportError:
    from backend import supabase_db as sb  # noqa: E402

# --- Logging ---
_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("skilleraa")

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def _is_placeholder_env(value: Optional[str]) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return (
        "placeholder" in lowered
        or "your_project" in lowered
        or "your-anon" in lowered
        or "your-publishable" in lowered
        or "your-service" in lowered
        or "your-jwt" in lowered
    )


def is_supabase_configured() -> bool:
    if _is_placeholder_env(SUPABASE_URL) or _is_placeholder_env(SUPABASE_JWT_SECRET):
        return False
    if not (SUPABASE_URL.startswith("https://") or SUPABASE_URL.startswith("http://")):
        return False
    return True


def get_supabase_jwt_secret() -> Optional[str]:
    if _is_placeholder_env(SUPABASE_JWT_SECRET):
        return None
    return SUPABASE_JWT_SECRET


# --- App ---
app = FastAPI(title="Skilleraa API")
api = APIRouter(prefix="/api")


def serialize_user(user: dict) -> dict:
    return {
        "id": str(user.get("id") or user.get("_id") or ""),
        "email": user.get("email", ""),
        "name": user.get("name") or user.get("full_name") or "",
        "role": user.get("role", "student"),
        "headline": user.get("headline", ""),
        "bio": user.get("bio", ""),
        "location": user.get("location", ""),
        "skills": user.get("skills") or [],
        "education": user.get("education", ""),
        "portfolio_url": user.get("portfolio_url", "") or "",
        "resume_url": user.get("resume_url", "") or "",
        "resume_filename": user.get("resume_filename", "") or "",
        "company_name": user.get("company_name", ""),
        "company_website": user.get("company_website", ""),
        "company_description": user.get("company_description", ""),
        "avatar_letter": (user.get("name") or user.get("full_name") or user.get("email") or "?")[0].upper(),
        "created_at": user.get("created_at"),
        "status": user.get("status") or "active",
    }


def serialize_public_user(user: dict) -> dict:
    return {
        "id": str(user.get("id") or ""),
        "name": user.get("name") or user.get("full_name") or "",
        "role": user.get("role", "student"),
        "headline": user.get("headline", ""),
        "bio": user.get("bio", ""),
        "location": user.get("location", ""),
        "skills": user.get("skills") or [],
        "education": user.get("education", ""),
        "portfolio_url": user.get("portfolio_url", "")
        if str(user.get("portfolio_url") or "").startswith("http")
        else "",
        "company_name": user.get("company_name", ""),
        "company_website": user.get("company_website", ""),
        "company_description": user.get("company_description", ""),
        "avatar_letter": (user.get("name") or user.get("full_name") or user.get("email") or "?")[0].upper(),
        "created_at": user.get("created_at"),
    }


def _extract_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def decode_supabase_access_token(token: str) -> dict:
    secret = get_supabase_jwt_secret()
    if not secret:
        raise HTTPException(status_code=503, detail="Supabase auth is not configured on the server")
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _profile_to_user(profile: dict, email: str = "") -> dict:
    uid = str(profile.get("id") or "")
    name = profile.get("full_name") or ""
    return {
        "id": uid,
        "_id": uid,
        "email": email,
        "name": name,
        "full_name": name,
        "role": profile.get("role") or "student",
        "status": profile.get("status") or "active",
        "avatar_url": profile.get("avatar_url") or "",
        "resume_url": profile.get("resume_url") or "",
        "portfolio_url": profile.get("portfolio_url") or "",
        "headline": "",
        "bio": "",
        "location": "",
        "skills": [],
        "education": "",
        "created_at": profile.get("created_at"),
    }


def find_user_for_supabase(payload: dict) -> Optional[dict]:
    supabase_id = payload.get("sub")
    email = (payload.get("email") or "").lower().strip()
    if not supabase_id:
        return None
    try:
        profile = sb.get_one(
            "profiles",
            {"id": f"eq.{supabase_id}", "select": "id,full_name,role,status,avatar_url,resume_url,portfolio_url,created_at"},
        )
    except HTTPException:
        return None
    if not profile:
        return None
    return _profile_to_user(profile, email=email)


def set_supabase_app_role(supabase_user_id: str, role: str) -> None:
    if (
        _is_placeholder_env(SUPABASE_URL)
        or _is_placeholder_env(SUPABASE_SERVICE_ROLE_KEY)
        or not is_supabase_configured()
    ):
        return
    try:
        resp = requests.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{supabase_user_id}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json",
            },
            json={"app_metadata": {"role": role}},
            timeout=20,
        )
        if resp.status_code >= 400:
            logger.warning(
                "Failed to set Supabase app_metadata.role: %s %s",
                resp.status_code,
                resp.text[:200],
            )
    except Exception as e:
        logger.warning("Supabase admin role update failed: %s", e)


async def get_current_user(request: Request) -> dict:
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_supabase_access_token(token)
    user = find_user_for_supabase(payload)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Profile not synced. Call POST /api/auth/sync after sign-in.",
        )
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    return user


async def require_role(user: dict, role: str) -> None:
    if user.get("role") != role:
        raise HTTPException(status_code=403, detail=f"{role.capitalize()} access required")


# --- Models ---
class SyncIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    role: Optional[Literal["student", "client"]] = None


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    education: Optional[str] = None
    portfolio_url: Optional[str] = None
    resume_url: Optional[str] = None
    resume_filename: Optional[str] = None
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    company_description: Optional[str] = None


class JobIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    category: str
    description: str = Field(min_length=1)
    skills: List[str] = []
    budget: str
    duration: str
    experience: Literal["Beginner", "Intermediate", "Expert"] = "Beginner"
    remote: bool = True
    location: Optional[str] = ""


class ApplicationIn(BaseModel):
    cover_letter: str = Field(min_length=1, max_length=2000)
    bid_amount: Optional[float] = None
    estimated_days: Optional[int] = None


class AppStatusIn(BaseModel):
    status: Literal["pending", "accepted", "rejected", "completed", "shortlisted", "hired"]


def serialize_job(job: dict, client: Optional[dict] = None) -> dict:
    client_name = ""
    if client:
        client_name = client.get("full_name") or client.get("name") or client.get("company_name") or ""
    job_type = (job.get("job_type") or ("remote" if job.get("remote", True) else "onsite")).lower()
    return {
        "id": str(job.get("id") or job.get("_id") or ""),
        "title": job.get("title", ""),
        "category": job.get("category", ""),
        "description": job.get("description", ""),
        "skills": job.get("skills") or [],
        "budget": job.get("budget", ""),
        "duration": job.get("duration", ""),
        "experience": job.get("experience", "Beginner"),
        "remote": job_type in ("remote", "hybrid") or bool(job.get("remote", True)),
        "location": job.get("location", ""),
        "job_type": job_type,
        "client_id": str(job.get("client_id", "")),
        "company_name": client_name or "Skilleraa Client",
        "company_letter": (client_name or "S")[0].upper(),
        "status": job.get("status", "open"),
        "applications_count": job.get("applications_count", 0),
        "created_at": job.get("created_at"),
    }


def serialize_application(
    app_doc: dict,
    job: Optional[dict] = None,
    student: Optional[dict] = None,
    client: Optional[dict] = None,
) -> dict:
    return {
        "id": str(app_doc.get("id") or app_doc.get("_id") or ""),
        "job_id": str(app_doc.get("job_id", "")),
        "student_id": str(app_doc.get("freelancer_id") or app_doc.get("student_id") or ""),
        "freelancer_id": str(app_doc.get("freelancer_id") or app_doc.get("student_id") or ""),
        "cover_letter": app_doc.get("proposal") or app_doc.get("cover_letter") or "",
        "status": app_doc.get("status", "pending"),
        "created_at": app_doc.get("created_at"),
        "job": serialize_job(job, client) if job else None,
        "student": serialize_user(student) if student else None,
    }


def _profiles_by_ids(ids: List[str]) -> dict:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    rows = sb.get_rows(
        "profiles",
        {"id": f"in.({','.join(ids)})", "select": "id,full_name,role,avatar_url,resume_url,portfolio_url,created_at"},
    )
    return {str(r["id"]): r for r in rows}


def _jobs_by_ids(ids: List[str]) -> dict:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    rows = sb.get_rows("jobs", {"id": f"in.({','.join(ids)})", "select": "*"})
    return {str(r["id"]): r for r in rows}


# --- Auth ---
@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


@api.post("/auth/sync")
async def sync_supabase_user(payload: SyncIn, request: Request):
    """Ensure a Supabase profiles row exists for the authenticated user."""
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    claims = decode_supabase_access_token(token)
    supabase_id = claims.get("sub")
    email = (claims.get("email") or "").lower().strip()
    if not supabase_id or not email:
        raise HTTPException(status_code=401, detail="Invalid Supabase token claims")

    app_meta = claims.get("app_metadata") or {}
    user_meta = claims.get("user_metadata") or {}
    existing_role = app_meta.get("role") if app_meta.get("role") in ("student", "client") else None
    requested_role = payload.role if payload.role in ("student", "client") else None
    name = (payload.name or user_meta.get("name") or user_meta.get("full_name") or email.split("@")[0]).strip()[:100]

    profile = sb.get_one(
        "profiles",
        {"id": f"eq.{supabase_id}", "select": "id,full_name,role,status,avatar_url,resume_url,portfolio_url,created_at"},
    )
    if profile:
        updates = {}
        if payload.name and name and profile.get("full_name") != name:
            updates["full_name"] = name
        if updates:
            updated = sb.rest(
                "PATCH",
                "profiles",
                params={"id": f"eq.{supabase_id}"},
                json_body=updates,
            )
            if isinstance(updated, list) and updated:
                profile = updated[0]
        user = _profile_to_user(profile, email=email)
    else:
        role = existing_role or requested_role or "student"
        created = sb.rest(
            "POST",
            "profiles",
            json_body={"id": supabase_id, "full_name": name, "role": role, "status": "active"},
            prefer="return=representation",
        )
        profile = created[0] if isinstance(created, list) else created
        user = _profile_to_user(profile, email=email)

    final_role = user.get("role") or "student"
    if existing_role != final_role and final_role in ("student", "client"):
        set_supabase_app_role(supabase_id, final_role)
    return serialize_user(user)


# --- Profile ---
@api.put("/profile")
async def update_profile(payload: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    updates = {}
    if payload.name is not None:
        updates["full_name"] = payload.name.strip()[:100]
    if payload.portfolio_url is not None:
        updates["portfolio_url"] = payload.portfolio_url
    if payload.resume_url is not None:
        updates["resume_url"] = payload.resume_url
    # headline/bio/skills/etc. are not columns on profiles — ignored (frontend keeps local/mock extras)
    if updates:
        updated = sb.rest(
            "PATCH",
            "profiles",
            params={"id": f"eq.{user['id']}"},
            json_body=updates,
        )
        if isinstance(updated, list) and updated:
            user = _profile_to_user(updated[0], email=user.get("email", ""))
    return serialize_user(user)


@api.get("/profile/{user_id}")
async def get_public_profile(user_id: str):
    profile = sb.get_one(
        "profiles",
        {"id": f"eq.{user_id}", "select": "id,full_name,role,avatar_url,portfolio_url,created_at,average_rating,review_count"},
    )
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_public_user(_profile_to_user(profile))


# --- Jobs ---
@api.get("/jobs")
async def list_jobs(
    q: Optional[str] = None,
    category: Optional[str] = None,
    remote: Optional[bool] = None,
    experience: Optional[str] = None,
    skill: Optional[str] = None,
    limit: int = Query(50, le=100),
):
    params = {
        "status": "eq.open",
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if category and category != "All":
        params["category"] = f"eq.{category}"
    if experience and experience != "All":
        params["experience"] = f"eq.{experience}"
    docs = sb.get_rows("jobs", params)
    if q:
        safe = q[:120].lower()
        docs = [
            j
            for j in docs
            if safe in (j.get("title") or "").lower()
            or safe in (j.get("description") or "").lower()
            or safe in (j.get("category") or "").lower()
        ]
    if remote is not None:
        docs = [
            j
            for j in docs
            if (str(j.get("job_type") or "").lower() in ("remote", "hybrid")) == remote
            or bool(j.get("remote")) == remote
        ]
    if skill:
        sk = skill.lower()
        docs = [j for j in docs if any(sk in str(s).lower() for s in (j.get("skills") or []))]
    clients = _profiles_by_ids([str(j.get("client_id")) for j in docs])
    return [serialize_job(j, clients.get(str(j.get("client_id")))) for j in docs]


@api.get("/jobs/featured")
async def featured_jobs():
    docs = sb.get_rows(
        "jobs",
        {"status": "eq.open", "select": "*", "order": "created_at.desc", "limit": "6"},
    )
    clients = _profiles_by_ids([str(j.get("client_id")) for j in docs])
    return [serialize_job(j, clients.get(str(j.get("client_id")))) for j in docs]


@api.get("/jobs/mine")
async def my_jobs(user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    docs = sb.get_rows(
        "jobs",
        {"client_id": f"eq.{user['id']}", "select": "*", "order": "created_at.desc", "limit": "200"},
    )
    return [serialize_job(j, None) for j in docs]


@api.get("/jobs/saved/list")
async def saved_jobs_list(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    saved = sb.get_rows(
        "saved_jobs",
        {"student_id": f"eq.{user['id']}", "select": "job_id,created_at", "order": "created_at.desc", "limit": "200"},
    )
    jobs = _jobs_by_ids([str(s.get("job_id")) for s in saved])
    clients = _profiles_by_ids([str(jobs[jid].get("client_id")) for jid in jobs])
    return [
        serialize_job(jobs[str(s["job_id"])], clients.get(str(jobs[str(s["job_id"])].get("client_id"))))
        for s in saved
        if str(s.get("job_id")) in jobs
    ]


@api.get("/jobs/saved/ids")
async def saved_job_ids(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    saved = sb.get_rows(
        "saved_jobs",
        {"student_id": f"eq.{user['id']}", "select": "job_id", "limit": "500"},
    )
    return {"ids": [str(s["job_id"]) for s in saved]}


@api.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = sb.get_one("jobs", {"id": f"eq.{job_id}", "select": "*"})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    client = None
    if job.get("client_id"):
        client = sb.get_one("profiles", {"id": f"eq.{job['client_id']}", "select": "id,full_name"})
    return serialize_job(job, client)


@api.post("/jobs")
async def create_job(payload: JobIn, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    job_type = "remote" if payload.remote else "onsite"
    created = sb.rest(
        "POST",
        "jobs",
        json_body={
            "client_id": user["id"],
            "title": payload.title,
            "category": payload.category,
            "description": payload.description,
            "skills": payload.skills or [],
            "budget": payload.budget,
            "duration": payload.duration,
            "experience": payload.experience,
            "job_type": job_type,
            "location": payload.location or "",
            "status": "open",
        },
    )
    job = created[0] if isinstance(created, list) else created
    return serialize_job(job, None)


@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    job = sb.get_one("jobs", {"id": f"eq.{job_id}", "select": "id,client_id"})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if str(job.get("client_id")) != user["id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    sb.rest("DELETE", "jobs", params={"id": f"eq.{job_id}"}, prefer="return=minimal")
    return {"ok": True}


@api.post("/jobs/{job_id}/apply")
async def apply_to_job(job_id: str, payload: ApplicationIn, user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    job = sb.get_one("jobs", {"id": f"eq.{job_id}", "select": "*"})
    if not job or job.get("status") != "open":
        raise HTTPException(status_code=400, detail="Job not open")
    if str(job.get("client_id")) == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot apply to your own job")
    existing = sb.get_one(
        "applications",
        {"job_id": f"eq.{job_id}", "freelancer_id": f"eq.{user['id']}", "select": "id"},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already applied")
    created = sb.rest(
        "POST",
        "applications",
        json_body={
            "job_id": job_id,
            "freelancer_id": user["id"],
            "proposal": payload.cover_letter,
            "bid_amount": float(payload.bid_amount or 0),
            "estimated_days": int(payload.estimated_days or 7),
            "status": "pending",
        },
    )
    app_doc = created[0] if isinstance(created, list) else created
    return serialize_application(app_doc, job, user, None)


@api.get("/applications/mine")
async def my_applications(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    docs = sb.get_rows(
        "applications",
        {"freelancer_id": f"eq.{user['id']}", "select": "*", "order": "created_at.desc", "limit": "200"},
    )
    jobs = _jobs_by_ids([str(a.get("job_id")) for a in docs])
    clients = _profiles_by_ids([str(jobs[jid].get("client_id")) for jid in jobs])
    out = []
    for a in docs:
        job = jobs.get(str(a.get("job_id")))
        client = clients.get(str(job.get("client_id"))) if job else None
        out.append(serialize_application(a, job, user, client))
    return out


@api.get("/jobs/{job_id}/applicants")
async def job_applicants(job_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    job = sb.get_one("jobs", {"id": f"eq.{job_id}", "select": "*"})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if str(job.get("client_id")) != user["id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    docs = sb.get_rows(
        "applications",
        {"job_id": f"eq.{job_id}", "select": "*", "order": "created_at.desc", "limit": "200"},
    )
    students = _profiles_by_ids([str(a.get("freelancer_id")) for a in docs])
    return [
        serialize_application(a, job, _profile_to_user(students[str(a["freelancer_id"])]) if str(a.get("freelancer_id")) in students else None, user)
        for a in docs
    ]


@api.get("/applicants/all")
async def all_applicants(user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    jobs = sb.get_rows("jobs", {"client_id": f"eq.{user['id']}", "select": "id", "limit": "500"})
    job_ids = [str(j["id"]) for j in jobs]
    if not job_ids:
        return []
    docs = sb.get_rows(
        "applications",
        {"job_id": f"in.({','.join(job_ids)})", "select": "*", "order": "created_at.desc", "limit": "500"},
    )
    jobs_map = _jobs_by_ids(job_ids)
    students = _profiles_by_ids([str(a.get("freelancer_id")) for a in docs])
    return [
        serialize_application(
            a,
            jobs_map.get(str(a.get("job_id"))),
            _profile_to_user(students[str(a["freelancer_id"])]) if str(a.get("freelancer_id")) in students else None,
            user,
        )
        for a in docs
    ]


@api.put("/applications/{app_id}/status")
async def update_application_status(app_id: str, payload: AppStatusIn, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    app_doc = sb.get_one("applications", {"id": f"eq.{app_id}", "select": "*"})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    job = sb.get_one("jobs", {"id": f"eq.{app_doc['job_id']}", "select": "id,client_id"})
    if not job or str(job.get("client_id")) != user["id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    # Map legacy statuses to schema
    status = payload.status
    if status in ("shortlisted", "hired"):
        status = "accepted" if status == "hired" else "pending"
    if status not in ("pending", "accepted", "rejected", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    updated = sb.rest(
        "PATCH",
        "applications",
        params={"id": f"eq.{app_id}"},
        json_body={"status": status},
    )
    row = updated[0] if isinstance(updated, list) and updated else {**app_doc, "status": status}
    return serialize_application(row, job, None, user)


# --- Saved jobs ---
@api.post("/jobs/{job_id}/save")
async def toggle_save_job(job_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    job = sb.get_one("jobs", {"id": f"eq.{job_id}", "select": "id"})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = sb.get_one(
        "saved_jobs",
        {"student_id": f"eq.{user['id']}", "job_id": f"eq.{job_id}", "select": "id"},
    )
    if existing:
        sb.rest("DELETE", "saved_jobs", params={"id": f"eq.{existing['id']}"}, prefer="return=minimal")
        return {"saved": False}
    sb.rest(
        "POST",
        "saved_jobs",
        json_body={"student_id": user["id"], "job_id": job_id},
        prefer="return=minimal",
    )
    return {"saved": True}


# --- Stats / dashboards ---
@api.get("/stats")
async def stats():
    students = sb.count_rows("profiles", {"role": "eq.student"})
    clients = sb.count_rows("profiles", {"role": "eq.client"})
    jobs = sb.count_rows("jobs", {})
    applications = sb.count_rows("applications", {})
    hired = sb.count_rows("applications", {"status": "eq.accepted"})
    return {
        "students": students,
        "clients": clients,
        "jobs": jobs,
        "applications": applications,
        "hired": hired,
    }


@api.get("/dashboard/student")
async def student_dashboard(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    applications = sb.count_rows("applications", {"freelancer_id": f"eq.{user['id']}"})
    saved = sb.count_rows("saved_jobs", {"student_id": f"eq.{user['id']}"})
    hired = sb.count_rows("applications", {"freelancer_id": f"eq.{user['id']}", "status": "eq.accepted"})
    completed = sb.count_rows("applications", {"freelancer_id": f"eq.{user['id']}", "status": "eq.completed"})
    return {
        "applications": applications,
        "saved": saved,
        "shortlisted": 0,
        "hired": hired + completed,
    }


@api.get("/dashboard/client")
async def client_dashboard(user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    total_jobs = sb.count_rows("jobs", {"client_id": f"eq.{user['id']}"})
    open_jobs = sb.count_rows("jobs", {"client_id": f"eq.{user['id']}", "status": "eq.open"})
    jobs = sb.get_rows("jobs", {"client_id": f"eq.{user['id']}", "select": "id", "limit": "500"})
    job_ids = [str(j["id"]) for j in jobs]
    apps = sb.count_rows("applications", {"job_id": f"in.({','.join(job_ids)})"}) if job_ids else 0
    hired = (
        sb.count_rows("applications", {"job_id": f"in.({','.join(job_ids)})", "status": "eq.accepted"})
        if job_ids
        else 0
    )
    return {"total_jobs": total_jobs, "open_jobs": open_jobs, "applications": apps, "hired": hired}


# --- Legacy Emergent object storage (optional) ---
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "skilleraa")
_storage_key: Optional[str] = None
MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "pdf": "application/pdf",
}
ALLOWED_EXTS = set(MIME_TYPES.keys())
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.warning("Storage init failed: %s", e)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage service unavailable — use /api/storage/upload")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage service unavailable")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@api.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    kind: str = Query("resume"),
    user: dict = Depends(get_current_user),
):
    """Legacy upload — prefer POST /api/storage/upload (Supabase Storage)."""
    filename = file.filename or "file.bin"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"File type .{ext} not allowed")
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Upload failed: %s", e)
        raise HTTPException(status_code=500, detail="Upload failed")
    file_url = result.get("url") or result.get("path") or path
    if kind == "resume":
        sb.rest(
            "PATCH",
            "profiles",
            params={"id": f"eq.{user['id']}"},
            json_body={"resume_url": file_url},
            prefer="return=minimal",
        )
    return {"id": str(uuid.uuid4()), "url": file_url, "filename": filename, "size": len(data)}


@api.get("/files/{file_id}")
async def download_file(file_id: str, authorization: Optional[str] = Header(None)):
    raise HTTPException(
        status_code=410,
        detail="Legacy file IDs removed. Use Supabase Storage signed URLs via /api/storage/signed-url.",
    )


# --- AI matching ---
_ai_cache: dict = {}
_AI_CACHE_TTL_SEC = 300


async def _run_claude(system: str, user_text: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    session_id = f"skilleraa-{uuid.uuid4()}"
    chat = LlmChat(api_key=key, session_id=session_id, system_message=system).with_model(
        "anthropic", "claude-sonnet-4-6"
    )
    try:
        response = await chat.send_message(UserMessage(text=user_text))
        return response if isinstance(response, str) else str(response)
    except Exception as e:
        logger.error("AI call failed: %s", e)
        raise HTTPException(status_code=502, detail="AI matching failed")


def _parse_json_from_llm(text: str) -> list:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    try:
        return json.loads(text)
    except Exception:
        logger.error("Failed to parse LLM JSON: %s", text[:400])
        return []


@api.post("/ai/match-jobs")
async def ai_match_jobs(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    cache_key = f"student:{user['id']}"
    now = datetime.now(timezone.utc).timestamp()
    cached = _ai_cache.get(cache_key)
    if cached and now - cached[0] < _AI_CACHE_TTL_SEC:
        return cached[1]

    profile = {
        "headline": user.get("headline", ""),
        "bio": user.get("bio", ""),
        "skills": user.get("skills") or [],
        "education": user.get("education", ""),
    }
    jobs_docs = sb.get_rows(
        "jobs",
        {"status": "eq.open", "select": "*", "order": "created_at.desc", "limit": "30"},
    )
    if not jobs_docs:
        return {"matches": []}

    jobs_min = [
        {
            "id": str(j["id"]),
            "title": j.get("title", ""),
            "category": j.get("category", ""),
            "skills": j.get("skills") or [],
            "experience": j.get("experience", ""),
            "description": (j.get("description") or "")[:400],
        }
        for j in jobs_docs
    ]
    system = (
        "You are an expert freelance job matcher. Given a student profile and a list of open jobs, "
        "rank the top 5 best-fitting jobs. Respond with ONLY valid JSON — no prose, no markdown fences. "
        'Format: [{"job_id": "<id>", "score": 0-100, "reason": "<one short sentence>"}, ...] '
        "sorted by score descending, max 5 items."
    )
    raw = await _run_claude(system, json.dumps({"student": profile, "jobs": jobs_min}))
    ranked = _parse_json_from_llm(raw)
    jobs_map = {str(j["id"]): j for j in jobs_docs}
    clients = _profiles_by_ids([str(j.get("client_id")) for j in jobs_docs])
    matches = []
    for item in ranked[:5]:
        job = jobs_map.get(item.get("job_id"))
        if not job:
            continue
        matches.append(
            {
                "job": serialize_job(job, clients.get(str(job.get("client_id")))),
                "score": int(item.get("score", 0)),
                "reason": item.get("reason", ""),
            }
        )
    result = {"matches": matches}
    _ai_cache[cache_key] = (now, result)
    return result


@api.post("/ai/match-applicants/{job_id}")
async def ai_match_applicants(job_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    job = sb.get_one("jobs", {"id": f"eq.{job_id}", "select": "*"})
    if not job or str(job.get("client_id")) != user["id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    cache_key = f"job:{job_id}"
    now = datetime.now(timezone.utc).timestamp()
    cached = _ai_cache.get(cache_key)
    if cached and now - cached[0] < _AI_CACHE_TTL_SEC:
        return cached[1]
    apps = sb.get_rows("applications", {"job_id": f"eq.{job_id}", "select": "*", "limit": "100"})
    if not apps:
        return {"matches": []}
    students = _profiles_by_ids([str(a.get("freelancer_id")) for a in apps])
    applicants_min = [
        {
            "application_id": str(a["id"]),
            "student_id": str(a["freelancer_id"]),
            "name": students.get(str(a["freelancer_id"]), {}).get("full_name", ""),
            "headline": "",
            "skills": [],
            "cover_letter": (a.get("proposal") or "")[:400],
        }
        for a in apps
    ]
    job_min = {
        "title": job.get("title", ""),
        "description": (job.get("description") or "")[:600],
        "skills": job.get("skills") or [],
        "experience": job.get("experience", ""),
    }
    system = (
        "You are an expert recruiting assistant. Given a job and its applicants, rank the top 5 best-fit applicants. "
        "Respond with ONLY valid JSON — no prose, no markdown fences. "
        'Format: [{"application_id": "<id>", "score": 0-100, "reason": "<one short sentence>"}, ...] '
        "sorted by score descending, max 5 items."
    )
    raw = await _run_claude(system, json.dumps({"job": job_min, "applicants": applicants_min}))
    ranked = _parse_json_from_llm(raw)
    apps_map = {str(a["id"]): a for a in apps}
    matches = []
    for item in ranked[:5]:
        a = apps_map.get(item.get("application_id"))
        if not a:
            continue
        stu = students.get(str(a["freelancer_id"]))
        matches.append(
            {
                "application": serialize_application(
                    a, job, _profile_to_user(stu) if stu else None, user
                ),
                "score": int(item.get("score", 0)),
                "reason": item.get("reason", ""),
            }
        )
    result = {"matches": matches}
    _ai_cache[cache_key] = (now, result)
    return result


@api.get("/")
async def root():
    return {"service": "skilleraa", "status": "ok", "db": "supabase"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "skilleraa"}


@app.on_event("startup")
async def on_startup():
    if not is_supabase_configured():
        logger.warning(
            "Supabase auth is not configured (SUPABASE_URL / SUPABASE_JWT_SECRET). "
            "Replace values in backend/.env and restart."
        )
    elif _is_placeholder_env(SUPABASE_SERVICE_ROLE_KEY):
        logger.warning(
            "SUPABASE_SERVICE_ROLE_KEY is a placeholder; data APIs will return 503 until set."
        )
    try:
        from payments_razorpay import razorpay_configured
    except ImportError:
        from backend.payments_razorpay import razorpay_configured
    if not razorpay_configured():
        logger.warning("Razorpay is not configured — payment endpoints will return 503 until set.")
    init_storage()


# --- Payments + Supabase Storage ---
try:
    from payments_razorpay import register_payment_routes, razorpay_configured  # noqa: E402
except ImportError:
    from backend.payments_razorpay import register_payment_routes, razorpay_configured  # noqa: E402

register_payment_routes(
    api,
    decode_token=decode_supabase_access_token,
    supabase_url_getter=lambda: SUPABASE_URL,
    service_key_getter=lambda: None
    if _is_placeholder_env(SUPABASE_SERVICE_ROLE_KEY)
    else SUPABASE_SERVICE_ROLE_KEY,
    is_supabase_ready=is_supabase_configured,
)

try:
    from storage_uploads import register_storage_routes  # noqa: E402
except ImportError:
    from backend.storage_uploads import register_storage_routes  # noqa: E402

register_storage_routes(
    api,
    decode_token=decode_supabase_access_token,
    supabase_url_getter=lambda: SUPABASE_URL,
    service_key_getter=lambda: None
    if _is_placeholder_env(SUPABASE_SERVICE_ROLE_KEY)
    else SUPABASE_SERVICE_ROLE_KEY,
    is_supabase_ready=is_supabase_configured,
)

app.include_router(api)

_cors_raw = os.environ.get("CORS_ORIGINS", "http://localhost:3000").strip()
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()] or ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started = datetime.now(timezone.utc)
    response = await call_next(request)
    if request.url.path.startswith("/api") or request.url.path == "/health":
        elapsed_ms = (datetime.now(timezone.utc) - started).total_seconds() * 1000
        logger.info("%s %s -> %s (%.1fms)", request.method, request.url.path, response.status_code, elapsed_ms)
    return response
