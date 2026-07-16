from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# --- Config ---
JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 1 day for demo convenience
REFRESH_TTL_DAYS = 30


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# --- DB ---
mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]


# --- App ---
app = FastAPI(title="Skilleraa API")
api = APIRouter(prefix="/api")


# --- Utilities ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=True,
        samesite="none", max_age=ACCESS_TTL_MIN * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=True,
        samesite="none", max_age=REFRESH_TTL_DAYS * 24 * 3600, path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


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
        "company_name": user.get("company_name", ""),
        "company_website": user.get("company_website", ""),
        "company_description": user.get("company_description", ""),
        "avatar_letter": (user.get("name") or user.get("email") or "?")[0].upper(),
        "created_at": user.get("created_at").isoformat() if isinstance(user.get("created_at"), datetime) else user.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_role(user: dict, role: str) -> None:
    if user.get("role") != role:
        raise HTTPException(status_code=403, detail=f"{role.capitalize()} access required")


# --- Models ---
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    role: Literal["student", "client"] = "student"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    education: Optional[str] = None
    portfolio_url: Optional[str] = None
    resume_url: Optional[str] = None
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


# --- Auth Routes ---
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": payload.role,
        "skills": [],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    user = await db.users.find_one({"_id": result.inserted_id})
    access = create_access_token(str(user["_id"]), user["email"], user["role"])
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return {"user": serialize_user(user), "access_token": access}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(str(user["_id"]), user["email"], user["role"])
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return {"user": serialize_user(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
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
    return serialize_user(user)


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
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
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


# --- Seed ---
async def seed_data():
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
    memory_dir = Path("/app/memory")
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

## Auth Endpoints
- POST `/api/auth/register` — body: `{{email, password, name, role}}` (role: student|client)
- POST `/api/auth/login` — body: `{{email, password}}`
- POST `/api/auth/logout`
- GET  `/api/auth/me`

## Notes
Auth uses httpOnly cookies (samesite=none, secure=true). Also returns `access_token` in JSON body which the frontend sends as `Authorization: Bearer` fallback.
"""
    )


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index([("status", 1), ("created_at", -1)])
    await db.applications.create_index([("student_id", 1), ("job_id", 1)], unique=True)
    await db.saved_jobs.create_index([("student_id", 1), ("job_id", 1)], unique=True)
    await seed_data()


@app.on_event("shutdown")
async def on_shutdown():
    mongo_client.close()


@api.get("/")
async def root():
    return {"service": "skilleraa", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("skilleraa")
