"""P1 feature tests: file upload, AI matching (Supabase Auth).

Requires SUPABASE_STUDENT_ACCESS_TOKEN / SUPABASE_CLIENT_ACCESS_TOKEN.
Legacy FastAPI refresh / forgot-password / register flows were removed.
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://minimal-job-platform.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT_TOKEN = os.environ.get("SUPABASE_STUDENT_ACCESS_TOKEN", "")
CLIENT_TOKEN = os.environ.get("SUPABASE_CLIENT_ACCESS_TOKEN", "")

TS = int(time.time())


def _auth_hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _student_token():
    if not STUDENT_TOKEN:
        pytest.skip("Set SUPABASE_STUDENT_ACCESS_TOKEN for authenticated tests")
    requests.post(f"{API}/auth/sync", headers=_auth_hdr(STUDENT_TOKEN), json={})
    return STUDENT_TOKEN


def _client_token():
    if not CLIENT_TOKEN:
        pytest.skip("Set SUPABASE_CLIENT_ACCESS_TOKEN for authenticated tests")
    requests.post(f"{API}/auth/sync", headers=_auth_hdr(CLIENT_TOKEN), json={})
    return CLIENT_TOKEN


# ---------- Legacy auth removed ----------
class TestLegacyAuthRemoved:
    def test_refresh_removed(self):
        r = requests.post(f"{API}/auth/refresh")
        assert r.status_code == 404

    def test_forgot_password_removed(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "a@b.com"})
        assert r.status_code == 404

    def test_reset_password_removed(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "x", "password": "abcdef"})
        assert r.status_code == 404


# ---------- File upload ----------
def _tiny_pdf_bytes() -> bytes:
    return b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


class TestFileUpload:
    def test_upload_resume_and_download(self):
        tok = _student_token()
        files = {"file": ("resume.pdf", _tiny_pdf_bytes(), "application/pdf")}
        r = requests.post(f"{API}/upload?kind=resume", headers=_auth_hdr(tok), files=files)
        if r.status_code == 503:
            pytest.skip("Storage service unavailable")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["id"] and body["url"].startswith("/api/files/")
        assert body["filename"] == "resume.pdf"
        assert body["size"] > 0
        me = requests.get(f"{API}/auth/me", headers=_auth_hdr(tok)).json()
        assert me["resume_url"] == body["url"]
        r = requests.get(f"{BASE_URL}{body['url']}", params={"auth": tok})
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")

    def test_upload_rejects_bad_ext(self):
        tok = _student_token()
        files = {"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")}
        r = requests.post(f"{API}/upload?kind=resume", headers=_auth_hdr(tok), files=files)
        assert r.status_code == 400

    def test_upload_rejects_large(self):
        tok = _student_token()
        big = b"A" * (5 * 1024 * 1024 + 100)
        files = {"file": ("big.pdf", big, "application/pdf")}
        r = requests.post(f"{API}/upload?kind=resume", headers=_auth_hdr(tok), files=files)
        assert r.status_code == 400

    def test_upload_unauthenticated(self):
        files = {"file": ("resume.pdf", _tiny_pdf_bytes(), "application/pdf")}
        r = requests.post(f"{API}/upload?kind=resume", files=files)
        assert r.status_code == 401


# ---------- AI Matching ----------
class TestAiMatching:
    def test_student_matches_and_cache(self):
        tok = _student_token()
        t0 = time.time()
        r = requests.post(f"{API}/ai/match-jobs", headers=_auth_hdr(tok), timeout=60)
        elapsed1 = time.time() - t0
        if r.status_code == 503:
            pytest.skip("AI service unavailable")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "matches" in body
        assert isinstance(body["matches"], list)
        assert len(body["matches"]) <= 5
        if body["matches"]:
            m = body["matches"][0]
            assert "job" in m and "score" in m and "reason" in m
            assert 0 <= m["score"] <= 100
        t1 = time.time()
        r2 = requests.post(f"{API}/ai/match-jobs", headers=_auth_hdr(tok), timeout=60)
        elapsed2 = time.time() - t1
        assert r2.status_code == 200
        assert elapsed2 < max(1.0, elapsed1 / 2)

    def test_client_rank_applicants_and_rbac(self):
        ctok = _client_token()
        jobs = requests.get(f"{API}/jobs/mine", headers=_auth_hdr(ctok)).json()
        if not jobs:
            pytest.skip("No client jobs to rank")
        job_id = jobs[0]["id"]
        r = requests.post(f"{API}/ai/match-applicants/{job_id}", headers=_auth_hdr(ctok), timeout=60)
        if r.status_code == 503:
            pytest.skip("AI service unavailable")
        assert r.status_code == 200, r.text
        assert "matches" in r.json()

        stok = _student_token()
        r = requests.post(f"{API}/ai/match-applicants/{job_id}", headers=_auth_hdr(stok))
        assert r.status_code == 403
