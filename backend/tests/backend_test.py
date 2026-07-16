"""Skilleraa backend API tests"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://minimal-job-platform.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT_EMAIL = "student@skilleraa.com"
STUDENT_PASSWORD = "Student@1234"
CLIENT_EMAIL = "client@skilleraa.com"
CLIENT_PASSWORD = "Client@1234"

TS = int(time.time())


def _client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(email, password):
    s = _client()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, r.json()


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


# --- Auth ---
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": STUDENT_EMAIL, "password": STUDENT_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert d["user"]["email"] == STUDENT_EMAIL
        assert d["user"]["role"] == "student"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": STUDENT_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_student(self):
        email = f"qa+student_{TS}@test.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "QA Student", "role": "student"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == email
        assert d["user"]["role"] == "student"
        assert "access_token" in d

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": STUDENT_EMAIL, "password": "whatever", "name": "x", "role": "student"
        })
        assert r.status_code == 400

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self):
        s, _ = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == STUDENT_EMAIL

    def test_logout(self):
        s, _ = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200


# --- Profile ---
class TestProfile:
    def test_update_profile_persists(self):
        s, u = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        payload = {
            "headline": f"TEST_headline_{TS}",
            "bio": "TEST bio",
            "skills": ["React", "TestSkill"],
        }
        r = s.put(f"{API}/profile", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["headline"] == payload["headline"]
        # verify persistence
        r2 = s.get(f"{API}/auth/me")
        assert r2.json()["headline"] == payload["headline"]
        assert "TestSkill" in r2.json()["skills"]

    def test_public_profile(self):
        s, u = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        uid = u["user"]["id"]
        r = requests.get(f"{API}/profile/{uid}")
        assert r.status_code == 200
        assert r.json()["email"] == STUDENT_EMAIL

    def test_public_profile_404(self):
        r = requests.get(f"{API}/profile/000000000000000000000000")
        assert r.status_code == 404


# --- Jobs / Applications / Save (integration flow) ---
class TestJobFlow:
    def test_full_flow(self):
        # Client creates job
        cs, _ = _login(CLIENT_EMAIL, CLIENT_PASSWORD)
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

        # Verify GET by id
        r = requests.get(f"{API}/jobs/{job_id}")
        assert r.status_code == 200
        assert r.json()["id"] == job_id

        # Client GET /jobs/mine
        r = cs.get(f"{API}/jobs/mine")
        assert r.status_code == 200
        assert any(j["id"] == job_id for j in r.json())

        # Student registers fresh (avoid duplicate apply)
        email = f"qa+flow_{TS}@test.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "Flow Student", "role": "student"
        })
        assert r.status_code == 200
        stok = r.json()["access_token"]
        ss = requests.Session()
        ss.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {stok}"})

        # Save/unsave
        r = ss.post(f"{API}/jobs/{job_id}/save")
        assert r.status_code == 200 and r.json()["saved"] is True
        r = ss.get(f"{API}/jobs/saved/ids")
        assert job_id in r.json()
        r = ss.get(f"{API}/jobs/saved/list")
        assert any(j["id"] == job_id for j in r.json())
        # Toggle unsave
        r = ss.post(f"{API}/jobs/{job_id}/save")
        assert r.json()["saved"] is False
        # Re-save for later
        ss.post(f"{API}/jobs/{job_id}/save")

        # Apply
        r = ss.post(f"{API}/jobs/{job_id}/apply", json={"cover_letter": "I am very interested in this role."})
        assert r.status_code == 200, r.text
        app_id = r.json()["id"]

        # Duplicate apply prevented
        r = ss.post(f"{API}/jobs/{job_id}/apply", json={"cover_letter": "again"})
        assert r.status_code == 400

        # Student applications list
        r = ss.get(f"{API}/applications/mine")
        assert r.status_code == 200
        assert any(a["id"] == app_id for a in r.json())

        # Client sees applicants
        r = cs.get(f"{API}/jobs/{job_id}/applicants")
        assert r.status_code == 200
        assert any(a["id"] == app_id for a in r.json())

        # Update application status
        r = cs.put(f"{API}/applications/{app_id}/status", json={"status": "shortlisted"})
        assert r.status_code == 200
        # Verify status persisted
        r = ss.get(f"{API}/applications/mine")
        assert any(a["id"] == app_id and a["status"] == "shortlisted" for a in r.json())

        # All applicants endpoint
        r = cs.get(f"{API}/applicants/all")
        assert r.status_code == 200

        # Dashboards
        r = ss.get(f"{API}/dashboard/student")
        assert r.status_code == 200
        for k in ["applications", "saved", "shortlisted", "hired", "profile_completion"]:
            assert k in r.json()
        r = cs.get(f"{API}/dashboard/client")
        assert r.status_code == 200

        # Delete job (client)
        r = cs.delete(f"{API}/jobs/{job_id}")
        assert r.status_code == 200

    def test_student_cannot_post_job(self):
        s, _ = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        r = s.post(f"{API}/jobs", json={
            "title": "x", "category": "Design", "description": "x",
            "skills": [], "budget": "x", "duration": "x", "experience": "Beginner", "remote": True
        })
        assert r.status_code == 403

    def test_client_cannot_apply(self):
        # attempt to apply as client
        s, _ = _login(CLIENT_EMAIL, CLIENT_PASSWORD)
        jobs = requests.get(f"{API}/jobs").json()
        r = s.post(f"{API}/jobs/{jobs[0]['id']}/apply", json={"cover_letter": "hello world test cover"})
        assert r.status_code == 403

    def test_job_not_found(self):
        r = requests.get(f"{API}/jobs/000000000000000000000000")
        assert r.status_code == 404
