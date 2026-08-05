from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import re
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field


# --- Logging (configure early so import-time helpers can use it) ---
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
    """True when env vars look like real Supabase credentials (not PLACEHOLDER_*)."""
    if _is_placeholder_env(SUPABASE_URL) or _is_placeholder_env(SUPABASE_JWT_SECRET):
        return False
    if not (SUPABASE_URL.startswith("https://") or SUPABASE_URL.startswith("http://")):
        return False
    return True


def get_supabase_jwt_secret() -> Optional[str]:
    if _is_placeholder_env(SUPABASE_JWT_SECRET):
        return None
    return SUPABASE_JWT_SECRET


# --- DB ---
mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]


# --- App ---
app = FastAPI(title="Skilleraa API")
api = APIRouter(prefix="/api")


# --- Utilities ---
def hash_password(password: str) -> str:
    """Used only for seed / placeholder hashes — auth credentials live in Supabase."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "student"),
        "headline": user.get("headline", ""),
        "bio": user.get("bio", ""),
        "location": user.get("location", ""),
        "skills": user.get("skills", []),
        "education": user.get("education", ""),
        "portfolio_url": user.get("portfolio_url", ""),
        "resume_url": user.get("resume_url", ""),
        "resume_filename": user.get("resume_filename", ""),
        "company_name": user.get("company_name", ""),
        "company_website": user.get("company_website", ""),
        "company_description": user.get("company_description", ""),
        "avatar_letter": (user.get("name") or user.get("email") or "?")[0].upper(),
        "created_at": user.get("created_at").isoformat() if isinstance(user.get("created_at"), datetime) else user.get("created_at"),
    }


def serialize_public_user(user: dict) -> dict:
    """Public profile: omit email and private file pointers."""
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "role": user.get("role", "student"),
        "headline": user.get("headline", ""),
        "bio": user.get("bio", ""),
        "location": user.get("location", ""),
        "skills": user.get("skills", []),
        "education": user.get("education", ""),
        "portfolio_url": user.get("portfolio_url", "") if str(user.get("portfolio_url") or "").startswith("http") else "",
        "company_name": user.get("company_name", ""),
        "company_website": user.get("company_website", ""),
        "company_description": user.get("company_description", ""),
        "avatar_letter": (user.get("name") or user.get("email") or "?")[0].upper(),
        "created_at": user.get("created_at").isoformat() if isinstance(user.get("created_at"), datetime) else user.get("created_at"),
    }


def _extract_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def decode_supabase_access_token(token: str) -> dict:
    """Verify a Supabase access token (HS256 project JWT secret)."""
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


async def find_user_for_supabase(payload: dict) -> Optional[dict]:
    supabase_id = payload.get("sub")
    email = (payload.get("email") or "").lower().strip()
    user = None
    if supabase_id:
        user = await db.users.find_one({"supabase_user_id": supabase_id})
    if not user and email:
        user = await db.users.find_one({"email": email})
    return user


def set_supabase_app_role(supabase_user_id: str, role: str) -> None:
    """Store authorization role in app_metadata (not user_metadata)."""
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
            logging.getLogger("skilleraa").warning(
                "Failed to set Supabase app_metadata.role: %s %s",
                resp.status_code,
                resp.text[:200],
            )
    except Exception as e:
        logging.getLogger("skilleraa").warning("Supabase admin role update failed: %s", e)


async def get_current_user(request: Request) -> dict:
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_supabase_access_token(token)
    user = await find_user_for_supabase(payload)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Profile not synced. Call POST /api/auth/sync after sign-in.",
        )
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


def serialize_job(job: dict, client: Optional[dict] = None) -> dict:
    return {
        "id": str(job["_id"]),
        "title": job.get("title", ""),
        "category": job.get("category", ""),
        "description": job.get("description", ""),
        "skills": job.get("skills", []),
        "budget": job.get("budget", ""),
        "duration": job.get("duration", ""),
        "experience": job.get("experience", "Beginner"),
        "remote": job.get("remote", True),
        "location": job.get("location", ""),
        "client_id": str(job.get("client_id", "")),
        "company_name": (client.get("company_name") if client else job.get("company_name", "")) or "Skilleraa Client",
        "company_letter": ((client.get("company_name") if client else job.get("company_name", "")) or "S")[0].upper(),
        "status": job.get("status", "open"),
        "applications_count": job.get("applications_count", 0),
        "created_at": job.get("created_at").isoformat() if isinstance(job.get("created_at"), datetime) else job.get("created_at"),
    }


def serialize_application(app_doc: dict, job: Optional[dict] = None, student: Optional[dict] = None, client: Optional[dict] = None) -> dict:
    return {
        "id": str(app_doc["_id"]),
        "job_id": str(app_doc.get("job_id", "")),
        "student_id": str(app_doc.get("student_id", "")),
        "cover_letter": app_doc.get("cover_letter", ""),
        "status": app_doc.get("status", "pending"),
        "created_at": app_doc.get("created_at").isoformat() if isinstance(app_doc.get("created_at"), datetime) else app_doc.get("created_at"),
        "job": serialize_job(job, client) if job else None,
        "student": serialize_user(student) if student else None,
    }


# --- Auth (Supabase) ---
@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


@api.post("/auth/sync")
async def sync_supabase_user(payload: SyncIn, request: Request):
    """
    Upsert the MongoDB profile for the authenticated Supabase user.
    Role is written to Supabase app_metadata (authorization) and mirrored in MongoDB.
    """
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
    existing_role = app_meta.get("role")
    if existing_role not in ("student", "client"):
        existing_role = None

    requested_role = payload.role if payload.role in ("student", "client") else None
    name = (payload.name or user_meta.get("name") or email.split("@")[0]).strip()[:100]

    user = await find_user_for_supabase(claims)
    if user:
        updates = {"supabase_user_id": supabase_id, "email": email}
        if payload.name:
            updates["name"] = name
        # Only set role on first assignment (never trust client to escalate later)
        if not user.get("role") and (requested_role or existing_role):
            updates["role"] = requested_role or existing_role
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user = await db.users.find_one({"_id": user["_id"]})
    else:
        role = existing_role or requested_role or "student"
        doc = {
            "email": email,
            "supabase_user_id": supabase_id,
            "name": name,
            "role": role,
            "skills": [],
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(doc)
        user = await db.users.find_one({"_id": result.inserted_id})

    final_role = user.get("role") or "student"
    if existing_role != final_role:
        set_supabase_app_role(supabase_id, final_role)

    return serialize_user(user)


# --- Profile ---
@api.put("/profile")
async def update_profile(payload: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    user = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(user)


@api.get("/profile/{user_id}")
async def get_public_profile(user_id: str):
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_public_user(user)


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
    query: dict = {"status": "open"}
    if q:
        safe_q = re.escape(q[:120])
        query["$or"] = [
            {"title": {"$regex": safe_q, "$options": "i"}},
            {"description": {"$regex": safe_q, "$options": "i"}},
            {"category": {"$regex": safe_q, "$options": "i"}},
        ]
    if category and category != "All":
        query["category"] = category
    if remote is not None:
        query["remote"] = remote
    if experience and experience != "All":
        query["experience"] = experience
    if skill:
        query["skills"] = {"$in": [skill]}

    docs = await db.jobs.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    # Batch fetch clients
    client_ids = list({d.get("client_id") for d in docs if d.get("client_id")})
    clients = {}
    if client_ids:
        async for c in db.users.find({"_id": {"$in": client_ids}}):
            clients[str(c["_id"])] = c
    return [serialize_job(d, clients.get(str(d.get("client_id")))) for d in docs]


@api.get("/jobs/featured")
async def featured_jobs():
    docs = await db.jobs.find({"status": "open"}).sort("created_at", -1).limit(6).to_list(6)
    client_ids = list({d.get("client_id") for d in docs if d.get("client_id")})
    clients = {}
    if client_ids:
        async for c in db.users.find({"_id": {"$in": client_ids}}):
            clients[str(c["_id"])] = c
    return [serialize_job(d, clients.get(str(d.get("client_id")))) for d in docs]


@api.get("/jobs/mine")
async def my_jobs(user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    docs = await db.jobs.find({"client_id": user["_id"]}).sort("created_at", -1).to_list(200)
    return [serialize_job(d, user) for d in docs]


@api.get("/jobs/{job_id}")
async def get_job(job_id: str):
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    client = await db.users.find_one({"_id": job.get("client_id")}) if job.get("client_id") else None
    return serialize_job(job, client)


@api.post("/jobs")
async def create_job(payload: JobIn, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    doc = payload.model_dump()
    doc.update({
        "client_id": user["_id"],
        "company_name": user.get("company_name", user.get("name", "")),
        "status": "open",
        "applications_count": 0,
        "created_at": datetime.now(timezone.utc),
    })
    result = await db.jobs.insert_one(doc)
    job = await db.jobs.find_one({"_id": result.inserted_id})
    return serialize_job(job, user)


@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("client_id") != user["_id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    await db.jobs.delete_one({"_id": job["_id"]})
    await db.applications.delete_many({"job_id": job["_id"]})
    return {"ok": True}


# --- Applications ---
@api.post("/jobs/{job_id}/apply")
async def apply_to_job(job_id: str, payload: ApplicationIn, user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = await db.applications.find_one({"job_id": job["_id"], "student_id": user["_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")
    doc = {
        "job_id": job["_id"],
        "student_id": user["_id"],
        "cover_letter": payload.cover_letter,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.applications.insert_one(doc)
    await db.jobs.update_one({"_id": job["_id"]}, {"$inc": {"applications_count": 1}})
    app_doc = await db.applications.find_one({"_id": result.inserted_id})
    return serialize_application(app_doc, job, user)


@api.get("/applications/mine")
async def my_applications(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    docs = await db.applications.find({"student_id": user["_id"]}).sort("created_at", -1).to_list(200)
    job_ids = [d["job_id"] for d in docs]
    jobs = {}
    async for j in db.jobs.find({"_id": {"$in": job_ids}}):
        jobs[str(j["_id"])] = j
    client_ids = list({j.get("client_id") for j in jobs.values() if j.get("client_id")})
    clients = {}
    if client_ids:
        async for c in db.users.find({"_id": {"$in": client_ids}}):
            clients[str(c["_id"])] = c
    result = []
    for d in docs:
        job = jobs.get(str(d["job_id"]))
        client = clients.get(str(job.get("client_id"))) if job else None
        result.append(serialize_application(d, job, user, client))
    return result


@api.get("/jobs/{job_id}/applicants")
async def job_applicants(job_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job or job.get("client_id") != user["_id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    docs = await db.applications.find({"job_id": job["_id"]}).sort("created_at", -1).to_list(200)
    student_ids = [d["student_id"] for d in docs]
    students = {}
    async for s in db.users.find({"_id": {"$in": student_ids}}):
        students[str(s["_id"])] = s
    return [serialize_application(d, job, students.get(str(d["student_id"])), user) for d in docs]


@api.get("/applicants/all")
async def all_applicants(user: dict = Depends(get_current_user)):
    """All applicants across client's jobs"""
    await require_role(user, "client")
    jobs = await db.jobs.find({"client_id": user["_id"]}).to_list(500)
    job_ids = [j["_id"] for j in jobs]
    if not job_ids:
        return []
    jobs_map = {str(j["_id"]): j for j in jobs}
    docs = await db.applications.find({"job_id": {"$in": job_ids}}).sort("created_at", -1).to_list(500)
    student_ids = [d["student_id"] for d in docs]
    students = {}
    async for s in db.users.find({"_id": {"$in": student_ids}}):
        students[str(s["_id"])] = s
    return [
        serialize_application(d, jobs_map.get(str(d["job_id"])), students.get(str(d["student_id"])), user)
        for d in docs
    ]


class AppStatusIn(BaseModel):
    status: Literal["pending", "shortlisted", "hired", "rejected"]


@api.put("/applications/{app_id}/status")
async def update_application_status(app_id: str, payload: AppStatusIn, user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    try:
        app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Application not found")
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    job = await db.jobs.find_one({"_id": app_doc["job_id"]})
    if not job or job.get("client_id") != user["_id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    await db.applications.update_one({"_id": app_doc["_id"]}, {"$set": {"status": payload.status}})
    return {"ok": True, "status": payload.status}


# --- Saved Jobs ---
@api.post("/jobs/{job_id}/save")
async def toggle_save_job(job_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    try:
        job_oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = await db.saved_jobs.find_one({"student_id": user["_id"], "job_id": job_oid})
    if existing:
        await db.saved_jobs.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    await db.saved_jobs.insert_one({
        "student_id": user["_id"],
        "job_id": job_oid,
        "created_at": datetime.now(timezone.utc),
    })
    return {"saved": True}


@api.get("/jobs/saved/list")
async def saved_jobs(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    saved = await db.saved_jobs.find({"student_id": user["_id"]}).sort("created_at", -1).to_list(200)
    job_ids = [s["job_id"] for s in saved]
    jobs = await db.jobs.find({"_id": {"$in": job_ids}}).to_list(200)
    client_ids = list({j.get("client_id") for j in jobs if j.get("client_id")})
    clients = {}
    if client_ids:
        async for c in db.users.find({"_id": {"$in": client_ids}}):
            clients[str(c["_id"])] = c
    return [serialize_job(j, clients.get(str(j.get("client_id")))) for j in jobs]


@api.get("/jobs/saved/ids")
async def saved_job_ids(user: dict = Depends(get_current_user)):
    if user.get("role") != "student":
        return []
    saved = await db.saved_jobs.find({"student_id": user["_id"]}).to_list(500)
    return [str(s["job_id"]) for s in saved]


# --- Stats ---
@api.get("/stats")
async def stats():
    students = await db.users.count_documents({"role": "student"})
    clients = await db.users.count_documents({"role": "client"})
    jobs = await db.jobs.count_documents({})
    applications = await db.applications.count_documents({})
    hired = await db.applications.count_documents({"status": "hired"})
    return {
        "students": students,
        "clients": clients,
        "jobs": jobs,
        "applications": applications,
        "success_rate": round((hired / applications * 100) if applications else 95),
    }


@api.get("/dashboard/student")
async def student_dashboard(user: dict = Depends(get_current_user)):
    await require_role(user, "student")
    applications = await db.applications.count_documents({"student_id": user["_id"]})
    saved = await db.saved_jobs.count_documents({"student_id": user["_id"]})
    shortlisted = await db.applications.count_documents({"student_id": user["_id"], "status": "shortlisted"})
    hired = await db.applications.count_documents({"student_id": user["_id"], "status": "hired"})
    # profile completion
    fields = ["name", "headline", "bio", "location", "skills", "education", "portfolio_url"]
    filled = sum(1 for f in fields if user.get(f))
    completion = round(filled / len(fields) * 100)
    return {
        "applications": applications,
        "saved": saved,
        "shortlisted": shortlisted,
        "hired": hired,
        "profile_completion": completion,
    }


@api.get("/dashboard/client")
async def client_dashboard(user: dict = Depends(get_current_user)):
    await require_role(user, "client")
    total_jobs = await db.jobs.count_documents({"client_id": user["_id"]})
    open_jobs = await db.jobs.count_documents({"client_id": user["_id"], "status": "open"})
    job_ids = [j["_id"] async for j in db.jobs.find({"client_id": user["_id"]}, {"_id": 1})]
    apps = await db.applications.count_documents({"job_id": {"$in": job_ids}}) if job_ids else 0
    hired = await db.applications.count_documents({"job_id": {"$in": job_ids}, "status": "hired"}) if job_ids else 0
    return {
        "total_jobs": total_jobs,
        "open_jobs": open_jobs,
        "applications": apps,
        "hired": hired,
    }


# --- Object Storage ---
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "skilleraa")
_storage_key: Optional[str] = None

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}
ALLOWED_EXTS = set(MIME_TYPES.keys())
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        logger.warning("EMERGENT_LLM_KEY not set — object storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage service unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 403:
        # storage key expired, re-init once
        global _storage_key
        _storage_key = None
        key = init_storage()
        if key:
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
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@api.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    kind: str = Query("resume"),
    user: dict = Depends(get_current_user),
):
    filename = file.filename or "file.bin"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"File type .{ext} not allowed. Allowed: {sorted(ALLOWED_EXTS)}")
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    uid = str(user["_id"])
    path = f"{APP_NAME}/uploads/{uid}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")

    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": file_id,
        "user_id": user["_id"],
        "kind": kind,
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc),
    })

    file_url = f"/api/files/{file_id}"
    # If it's a resume, update user's resume_url pointer for quick access
    if kind == "resume":
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"resume_url": file_url, "resume_filename": filename}})

    return {"id": file_id, "url": file_url, "filename": filename, "size": len(data)}


@api.get("/files/{file_id}")
async def download_file(file_id: str, authorization: Optional[str] = Header(None)):
    # Bearer only — never accept JWT via query string (leaks via logs/Referer)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    payload = decode_supabase_access_token(token)
    user = await find_user_for_supabase(payload)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    rec = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    if rec.get("user_id") != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        data, content_type = get_object(rec["storage_path"])
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail="Download failed")

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", rec.get("original_filename") or "file")[:120]
    return Response(
        content=data,
        media_type=rec.get("content_type", content_type),
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )


# --- AI Job Matching (Emergent LLM key + Claude Sonnet) ---
_ai_cache: dict = {}  # session_id -> (timestamp, result)
_AI_CACHE_TTL_SEC = 300  # 5 minutes


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
        # send_message is fine here — we need structured JSON, not user-facing streaming
        response = await chat.send_message(UserMessage(text=user_text))
        return response if isinstance(response, str) else str(response)
    except Exception as e:
        logger.error(f"AI call failed: {e}")
        raise HTTPException(status_code=502, detail="AI matching failed")


def _parse_json_from_llm(text: str) -> list:
    # Try direct parse, then extract from ```json blocks or first [ ... ] block
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
        logger.error(f"Failed to parse LLM JSON: {text[:400]}")
        return []


@api.post("/ai/match-jobs")
async def ai_match_jobs(user: dict = Depends(get_current_user)):
    """Match top 5 open jobs to the current student's profile."""
    await require_role(user, "student")

    cache_key = f"student:{user['_id']}"
    now = datetime.now(timezone.utc).timestamp()
    cached = _ai_cache.get(cache_key)
    if cached and now - cached[0] < _AI_CACHE_TTL_SEC:
        return cached[1]

    profile = {
        "headline": user.get("headline", ""),
        "bio": user.get("bio", ""),
        "skills": user.get("skills", []),
        "education": user.get("education", ""),
    }
    if not profile["skills"] and not profile["headline"] and not profile["bio"]:
        raise HTTPException(status_code=400, detail="Complete your profile (skills, headline, bio) to get AI matches")

    jobs_docs = await db.jobs.find({"status": "open"}).sort("created_at", -1).limit(30).to_list(30)
    if not jobs_docs:
        return {"matches": []}

    jobs_min = [
        {
            "id": str(j["_id"]),
            "title": j.get("title", ""),
            "category": j.get("category", ""),
            "skills": j.get("skills", []),
            "experience": j.get("experience", ""),
            "description": (j.get("description", "") or "")[:400],
        }
        for j in jobs_docs
    ]

    system = (
        "You are an expert freelance job matcher. Given a student profile and a list of open jobs, "
        "rank the top 5 best-fitting jobs. Respond with ONLY valid JSON — no prose, no markdown fences. "
        'Format: [{"job_id": "<id>", "score": 0-100, "reason": "<one short sentence>"}, ...] '
        "sorted by score descending, max 5 items."
    )
    user_text = json.dumps({"student": profile, "jobs": jobs_min})

    raw = await _run_claude(system, user_text)
    ranked = _parse_json_from_llm(raw)

    jobs_map = {str(j["_id"]): j for j in jobs_docs}
    client_ids = list({j.get("client_id") for j in jobs_docs if j.get("client_id")})
    clients = {}
    if client_ids:
        async for c in db.users.find({"_id": {"$in": client_ids}}):
            clients[str(c["_id"])] = c

    matches = []
    for item in ranked[:5]:
        jid = item.get("job_id")
        job = jobs_map.get(jid)
        if not job:
            continue
        matches.append({
            "job": serialize_job(job, clients.get(str(job.get("client_id")))),
            "score": int(item.get("score", 0)),
            "reason": item.get("reason", ""),
        })

    result = {"matches": matches}
    _ai_cache[cache_key] = (now, result)
    return result


@api.post("/ai/match-applicants/{job_id}")
async def ai_match_applicants(job_id: str, user: dict = Depends(get_current_user)):
    """For a client's job, rank the top applicants."""
    await require_role(user, "client")
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job or job.get("client_id") != user["_id"]:
        raise HTTPException(status_code=403, detail="Not the owner")

    cache_key = f"job:{job_id}"
    now = datetime.now(timezone.utc).timestamp()
    cached = _ai_cache.get(cache_key)
    if cached and now - cached[0] < _AI_CACHE_TTL_SEC:
        return cached[1]

    apps = await db.applications.find({"job_id": job["_id"]}).to_list(100)
    if not apps:
        return {"matches": []}

    student_ids = [a["student_id"] for a in apps]
    students = {}
    async for s in db.users.find({"_id": {"$in": student_ids}}):
        students[str(s["_id"])] = s

    applicants_min = [
        {
            "application_id": str(a["_id"]),
            "student_id": str(a["student_id"]),
            "name": students.get(str(a["student_id"]), {}).get("name", ""),
            "headline": students.get(str(a["student_id"]), {}).get("headline", ""),
            "skills": students.get(str(a["student_id"]), {}).get("skills", []),
            "cover_letter": (a.get("cover_letter", "") or "")[:400],
        }
        for a in apps
    ]

    job_min = {
        "title": job.get("title", ""),
        "description": (job.get("description", "") or "")[:600],
        "skills": job.get("skills", []),
        "experience": job.get("experience", ""),
    }

    system = (
        "You are an expert recruiting assistant. Given a job and its applicants, rank the top 5 best-fit applicants. "
        "Respond with ONLY valid JSON — no prose, no markdown fences. "
        'Format: [{"application_id": "<id>", "score": 0-100, "reason": "<one short sentence>"}, ...] '
        "sorted by score descending, max 5 items."
    )
    user_text = json.dumps({"job": job_min, "applicants": applicants_min})
    raw = await _run_claude(system, user_text)
    ranked = _parse_json_from_llm(raw)

    apps_map = {str(a["_id"]): a for a in apps}
    matches = []
    for item in ranked[:5]:
        aid = item.get("application_id")
        a = apps_map.get(aid)
        if not a:
            continue
        matches.append({
            "application": serialize_application(a, job, students.get(str(a["student_id"])), user),
            "score": int(item.get("score", 0)),
            "reason": item.get("reason", ""),
        })

    result = {"matches": matches}
    _ai_cache[cache_key] = (now, result)
    return result




# --- Seed ---
async def seed_data():
    # Opt-in only — never seed demo accounts/passwords in production by default
    if os.environ.get("SEED_DEMO_DATA", "").strip().lower() not in ("1", "true", "yes"):
        logger.info("Skipping demo seed (set SEED_DEMO_DATA=true to enable)")
        return

    # Users
    async def ensure_user(email: str, password: str, name: str, role: str, extras: dict) -> ObjectId:
        u = await db.users.find_one({"email": email})
        if u:
            return u["_id"]
        doc = {
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "role": role,
            "created_at": datetime.now(timezone.utc),
            **extras,
        }
        r = await db.users.insert_one(doc)
        return r.inserted_id

    student_id = await ensure_user(
        os.environ["DEMO_STUDENT_EMAIL"], os.environ["DEMO_STUDENT_PASSWORD"],
        "Aarav Sharma", "student",
        {
            "headline": "Frontend Developer & UI Designer",
            "bio": "Final-year CS student passionate about building minimal, delightful interfaces.",
            "location": "Bengaluru, India",
            "skills": ["React", "TypeScript", "Tailwind CSS", "Figma", "Framer Motion"],
            "education": "B.Tech Computer Science, IIT Roorkee",
            "portfolio_url": "https://aarav.dev",
        },
    )

    client_id = await ensure_user(
        os.environ["DEMO_CLIENT_EMAIL"], os.environ["DEMO_CLIENT_PASSWORD"],
        "Priya Mehta", "client",
        {
            "company_name": "Northwind Labs",
            "company_website": "https://northwind.example.com",
            "company_description": "We build tools for modern remote teams. Small team, big ambitions.",
            "location": "Remote",
        },
    )

    await ensure_user(
        os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"],
        "Skilleraa Admin", "client",
        {"company_name": "Skilleraa"},
    )

    # Additional demo clients for job variety
    client2_id = await ensure_user(
        "hello@lumen.co", "Client@1234", "Rohan Kapoor", "client",
        {"company_name": "Lumen Studio", "location": "Remote"},
    )
    client3_id = await ensure_user(
        "hi@parallax.dev", "Client@1234", "Sara Nair", "client",
        {"company_name": "Parallax", "location": "Bengaluru"},
    )

    # Jobs
    if await db.jobs.count_documents({}) < 5:
        now = datetime.now(timezone.utc)
        sample_jobs = [
            {
                "title": "UI Designer for SaaS Dashboard",
                "category": "Design",
                "description": "Design a minimal, modern dashboard UI for our analytics product. Deliverables include Figma file with responsive layouts and interactive prototypes.",
                "skills": ["Figma", "UI Design", "Prototyping"],
                "budget": "₹25,000 - ₹40,000",
                "duration": "2-3 weeks",
                "experience": "Intermediate",
                "remote": True,
                "location": "Remote",
                "client_id": client_id,
                "company_name": "Northwind Labs",
            },
            {
                "title": "React Developer — Landing Page",
                "category": "Development",
                "description": "Build a pixel-perfect marketing landing page in React + Tailwind with Framer Motion animations. Reference: Linear, Vercel.",
                "skills": ["React", "Tailwind CSS", "Framer Motion"],
                "budget": "₹18,000 - ₹28,000",
                "duration": "1-2 weeks",
                "experience": "Beginner",
                "remote": True,
                "location": "Remote",
                "client_id": client2_id,
                "company_name": "Lumen Studio",
            },
            {
                "title": "Video Editor for Product Explainer",
                "category": "Video",
                "description": "Edit a 60-90 sec product explainer video with motion graphics and minimal soundtrack. Provide 2 revisions.",
                "skills": ["Premiere Pro", "After Effects", "Motion Graphics"],
                "budget": "₹10,000 - ₹15,000",
                "duration": "1 week",
                "experience": "Intermediate",
                "remote": True,
                "location": "Remote",
                "client_id": client3_id,
                "company_name": "Parallax",
            },
            {
                "title": "Content Writer — Technical Blog",
                "category": "Writing",
                "description": "Write 4 technical blog posts (~1200 words each) on developer productivity. SEO-focused, human-first tone.",
                "skills": ["SEO", "Copywriting", "Technical Writing"],
                "budget": "₹8,000 - ₹12,000",
                "duration": "2 weeks",
                "experience": "Beginner",
                "remote": True,
                "location": "Remote",
                "client_id": client2_id,
                "company_name": "Lumen Studio",
            },
            {
                "title": "Graphic Designer for Social Media",
                "category": "Design",
                "description": "Create a set of 15 branded Instagram + LinkedIn posts using our monochrome style guide.",
                "skills": ["Illustrator", "Photoshop", "Branding"],
                "budget": "₹6,000 - ₹10,000",
                "duration": "1 week",
                "experience": "Beginner",
                "remote": True,
                "location": "Remote",
                "client_id": client_id,
                "company_name": "Northwind Labs",
            },
            {
                "title": "Full-Stack Developer — MVP",
                "category": "Development",
                "description": "Build MVP for a productivity SaaS. Stack: React + FastAPI + MongoDB. Auth, CRUD, dashboard.",
                "skills": ["React", "FastAPI", "MongoDB"],
                "budget": "₹60,000 - ₹90,000",
                "duration": "4-6 weeks",
                "experience": "Expert",
                "remote": True,
                "location": "Remote",
                "client_id": client3_id,
                "company_name": "Parallax",
            },
            {
                "title": "Mobile App UI — Fitness Tracker",
                "category": "Design",
                "description": "Design a minimal iOS/Android UI kit for a fitness tracker app. 20+ screens.",
                "skills": ["Figma", "Mobile UI", "Prototyping"],
                "budget": "₹30,000 - ₹45,000",
                "duration": "3 weeks",
                "experience": "Intermediate",
                "remote": True,
                "location": "Remote",
                "client_id": client2_id,
                "company_name": "Lumen Studio",
            },
            {
                "title": "Copywriter — Website Refresh",
                "category": "Writing",
                "description": "Rewrite our marketing website copy — hero, features, pricing, about — with a bold minimal voice.",
                "skills": ["Copywriting", "Brand Voice"],
                "budget": "₹12,000 - ₹18,000",
                "duration": "1 week",
                "experience": "Intermediate",
                "remote": True,
                "location": "Remote",
                "client_id": client_id,
                "company_name": "Northwind Labs",
            },
        ]
        for i, j in enumerate(sample_jobs):
            j["status"] = "open"
            j["applications_count"] = 0
            j["created_at"] = now - timedelta(days=i)
            await db.jobs.insert_one(j)

    # Write test credentials
    memory_dir = Path(__file__).parent.parent / "memory"
    memory_dir.mkdir(exist_ok=True)
    (memory_dir / "test_credentials.md").write_text(
        f"""# Skilleraa Test Credentials

## Demo Student
- **Email**: `{os.environ["DEMO_STUDENT_EMAIL"]}`
- **Password**: `{os.environ["DEMO_STUDENT_PASSWORD"]}`
- **Role**: student

## Demo Client
- **Email**: `{os.environ["DEMO_CLIENT_EMAIL"]}`
- **Password**: `{os.environ["DEMO_CLIENT_PASSWORD"]}`
- **Role**: client

## Admin (client role)
- **Email**: `{os.environ["ADMIN_EMAIL"]}`
- **Password**: `{os.environ["ADMIN_PASSWORD"]}`

## Auth
Authentication is handled by Supabase Auth.
- GET  `/api/auth/me` — current Mongo profile (requires Supabase Bearer token + prior `/auth/sync`)
- POST `/api/auth/sync` — upsert Mongo profile from Supabase JWT
"""
    )


@app.on_event("startup")
async def on_startup():
    if not is_supabase_configured():
        logger.warning(
            "Supabase auth is not configured (PLACEHOLDER_* or missing SUPABASE_URL / "
            "SUPABASE_JWT_SECRET). Replace values in backend/.env and restart — no code changes needed."
        )
    elif _is_placeholder_env(SUPABASE_SERVICE_ROLE_KEY):
        logger.warning(
            "SUPABASE_SERVICE_ROLE_KEY is a placeholder; role sync to app_metadata will be skipped until set."
        )
    if not razorpay_configured():
        logger.warning(
            "Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET). "
            "Payment endpoints will return 503 until set."
        )
    await db.users.create_index("email", unique=True)
    await db.users.create_index("supabase_user_id", unique=True, sparse=True)
    await db.jobs.create_index([("status", 1), ("created_at", -1)])
    await db.applications.create_index([("student_id", 1), ("job_id", 1)], unique=True)
    await db.saved_jobs.create_index([("student_id", 1), ("job_id", 1)], unique=True)
    await db.files.create_index("id", unique=True)
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init at startup failed (non-fatal): {e}")
    await seed_data()


@app.on_event("shutdown")
async def on_shutdown():
    mongo_client.close()


@api.get("/")
async def root():
    return {"service": "skilleraa", "status": "ok"}


@app.get("/health")
async def health():
    """Railway / load-balancer liveness — no auth, no DB dependency."""
    return {"status": "ok", "service": "skilleraa"}


# --- Razorpay payments (Test Mode) ---
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

# --- Supabase Storage uploads (resume / portfolio) ---
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
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
if not _cors_origins:
    _cors_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log method/path/status without tokens or bodies."""
    started = datetime.now(timezone.utc)
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        elapsed_ms = (datetime.now(timezone.utc) - started).total_seconds() * 1000
        logger.info(
            "%s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
    return response
