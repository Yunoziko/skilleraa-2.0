"""Skilleraa backend API tests (Supabase Auth).

Authenticated tests require:
  SUPABASE_STUDENT_ACCESS_TOKEN
  SUPABASE_CLIENT_ACCESS_TOKEN

Obtain tokens by signing in via the SPA (or Supabase Auth API), then export them.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://minimal-job-platform.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT_TOKEN = os.environ.get("SUPABASE_STUDENT_ACCESS_TOKEN", "")
CLIENT_TOKEN = os.environ.get("SUPABASE_CLIENT_ACCESS_TOKEN", "")

TS = int(time.time())


def _client(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def _require_student():
    if not STUDENT_TOKEN:
        pytest.skip("Set SUPABASE_STUDENT_ACCESS_TOKEN for authenticated tests")
    return _client(STUDENT_TOKEN)


def _require_client():
    if not CLIENT_TOKEN:
        pytest.skip("Set SUPABASE_CLIENT_ACCESS_TOKEN for authenticated tests")
    return _client(CLIENT_TOKEN)


# --- Health / Public ---
class TestPublic:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_stats(self):
        r = requests.get(f"{API}/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ["students", "clients", "jobs", "applications", "success_rate"]:
            assert k in data

    def test_list_jobs(self):
        r = requests.get(f"{API}/jobs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_featured_jobs(self):
        r = requests.get(f"{API}/jobs/featured")
        assert r.status_code == 200
        assert len(r.json()) <= 6

    def test_job_filters(self):
        r = requests.get(f"{API}/jobs", params={"category": "Design"})
        assert r.status_code == 200
        for j in r.json():
            assert j["category"] == "Design"
        r2 = requests.get(f"{API}/jobs", params={"q": "React"})
        assert r2.status_code == 200


# --- Auth (Supabase) ---
class TestAuth:
    def test_legacy_login_removed(self):
        r = requests.post(f"{API}/auth/login", json={"email": "a@b.com", "password": "x"})
        assert r.status_code == 404

    def test_legacy_register_removed(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": "a@b.com", "password": "Passw0rd!", "name": "x", "role": "student"
        })
        assert r.status_code == 404

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_supabase_token(self):
        s = _require_student()
        r = s.get(f"{API}/auth/me")
        if r.status_code == 401:
            # Token valid for Supabase but profile not synced yet
            r = s.post(f"{API}/auth/sync", json={})
            assert r.status_code == 200, r.text
            r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json().get("email")

    def test_sync_upserts_profile(self):
        s = _require_student()
        r = s.post(f"{API}/auth/sync", json={"name": f"QA Student {TS}"})
        assert r.status_code == 200, r.text
        assert r.json().get("id")
        assert r.json().get("role") in ("student", "client")


# --- Profile ---
class TestProfile:
    def test_update_profile_persists(self):
        s = _require_student()
        s.post(f"{API}/auth/sync", json={})
        payload = {
            "headline": f"TEST_headline_{TS}",
            "bio": "TEST bio",
            "skills": ["React", "TestSkill"],
        }
        r = s.put(f"{API}/profile", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["headline"] == payload["headline"]
        r2 = s.get(f"{API}/auth/me")
        assert r2.json()["headline"] == payload["headline"]
        assert "TestSkill" in r2.json()["skills"]

    def test_public_profile(self):
        s = _require_student()
        s.post(f"{API}/auth/sync", json={})
        me = s.get(f"{API}/auth/me").json()
        uid = me["id"]
        r = requests.get(f"{API}/profile/{uid}")
        assert r.status_code == 200
        assert r.json()["email"] == me["email"]

    def test_public_profile_404(self):
        r = requests.get(f"{API}/profile/000000000000000000000000")
        assert r.status_code == 404


# --- Jobs / Applications / Save (integration flow) ---
class TestJobFlow:
    def test_full_flow(self):
        cs = _require_client()
        cs.post(f"{API}/auth/sync", json={})
        ss = _require_student()
        ss.post(f"{API}/auth/sync", json={})

        job_payload = {
            "title": f"TEST_Job_{TS}",
            "category": "Development",
            "description": "Test job description for integration testing.",
            "skills": ["Python", "FastAPI"],
            "budget": "₹10,000 - ₹20,000",
            "duration": "1 week",
            "experience": "Beginner",
            "remote": True,
            "location": "Remote",
        }
        r = cs.post(f"{API}/jobs", json=job_payload)
        assert r.status_code == 200, r.text
        job = r.json()
        job_id = job["id"]
        assert job["title"] == job_payload["title"]

        r = requests.get(f"{API}/jobs/{job_id}")
        assert r.status_code == 200
        assert r.json()["id"] == job_id

        r = cs.get(f"{API}/jobs/mine")
        assert r.status_code == 200
        assert any(j["id"] == job_id for j in r.json())

        r = ss.post(f"{API}/jobs/{job_id}/save")
        assert r.status_code == 200 and r.json()["saved"] is True
        r = ss.get(f"{API}/jobs/saved/ids")
        assert job_id in r.json()
        r = ss.get(f"{API}/jobs/saved/list")
        assert any(j["id"] == job_id for j in r.json())
        r = ss.post(f"{API}/jobs/{job_id}/save")
        assert r.json()["saved"] is False
        ss.post(f"{API}/jobs/{job_id}/save")

        r = ss.post(f"{API}/jobs/{job_id}/apply", json={"cover_letter": "I am very interested in this role."})
        assert r.status_code == 200, r.text
        app_id = r.json()["id"]

        r = ss.post(f"{API}/jobs/{job_id}/apply", json={"cover_letter": "again"})
        assert r.status_code == 400

        r = ss.get(f"{API}/applications/mine")
        assert r.status_code == 200
        assert any(a["id"] == app_id for a in r.json())

        r = cs.get(f"{API}/jobs/{job_id}/applicants")
        assert r.status_code == 200
        assert any(a["id"] == app_id for a in r.json())

        r = cs.put(f"{API}/applications/{app_id}/status", json={"status": "shortlisted"})
        assert r.status_code == 200
        r = ss.get(f"{API}/applications/mine")
        assert any(a["id"] == app_id and a["status"] == "shortlisted" for a in r.json())

        r = cs.get(f"{API}/applicants/all")
        assert r.status_code == 200

        r = ss.get(f"{API}/dashboard/student")
        assert r.status_code == 200
        for k in ["applications", "saved", "shortlisted", "hired", "profile_completion"]:
            assert k in r.json()
        r = cs.get(f"{API}/dashboard/client")
        assert r.status_code == 200

        r = cs.delete(f"{API}/jobs/{job_id}")
        assert r.status_code == 200

    def test_student_cannot_post_job(self):
        s = _require_student()
        s.post(f"{API}/auth/sync", json={})
        r = s.post(f"{API}/jobs", json={
            "title": "x", "category": "Design", "description": "x",
            "skills": [], "budget": "x", "duration": "x", "experience": "Beginner", "remote": True
        })
        assert r.status_code == 403

    def test_client_cannot_apply(self):
        s = _require_client()
        s.post(f"{API}/auth/sync", json={})
        jobs = requests.get(f"{API}/jobs").json()
        r = s.post(f"{API}/jobs/{jobs[0]['id']}/apply", json={"cover_letter": "hello world test cover"})
        assert r.status_code == 403

    def test_job_not_found(self):
        r = requests.get(f"{API}/jobs/000000000000000000000000")
        assert r.status_code == 404
