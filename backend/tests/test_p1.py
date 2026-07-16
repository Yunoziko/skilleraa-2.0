"""P1 feature tests: refresh, forgot/reset password, file upload, AI matching."""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT_EMAIL = "student@skilleraa.com"
STUDENT_PASSWORD = "Student@1234"
CLIENT_EMAIL = "client@skilleraa.com"
CLIENT_PASSWORD = "Client@1234"

TS = int(time.time())


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def _auth_hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Refresh token ----------
class TestRefreshToken:
    def test_refresh_success(self):
        d = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        rt = d["refresh_token"]
        assert rt
        r = requests.post(f"{API}/auth/refresh", headers=_auth_hdr(rt))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("access_token")
        assert body.get("refresh_token")
        # New tokens should be usable
        r2 = requests.get(f"{API}/auth/me", headers=_auth_hdr(body["access_token"]))
        assert r2.status_code == 200

    def test_refresh_with_access_token_rejected(self):
        d = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        r = requests.post(f"{API}/auth/refresh", headers=_auth_hdr(d["access_token"]))
        assert r.status_code == 401

    def test_refresh_no_token(self):
        r = requests.post(f"{API}/auth/refresh")
        assert r.status_code == 401

    def test_refresh_invalid_token(self):
        r = requests.post(f"{API}/auth/refresh", headers=_auth_hdr("not.a.jwt"))
        assert r.status_code == 401


# ---------- Password reset ----------
class TestPasswordReset:
    def test_full_reset_flow(self):
        # forgot
        r = requests.post(f"{API}/auth/forgot-password", json={"email": STUDENT_EMAIL})
        assert r.status_code == 200
        tok = r.json().get("dev_token")
        assert tok
        # reset to a temp password
        new_pw = "Newpass@1234"
        r = requests.post(f"{API}/auth/reset-password", json={"token": tok, "password": new_pw})
        assert r.status_code == 200, r.text
        # login with new
        r = requests.post(f"{API}/auth/login", json={"email": STUDENT_EMAIL, "password": new_pw})
        assert r.status_code == 200
        # reset back to original via new forgot cycle
        r = requests.post(f"{API}/auth/forgot-password", json={"email": STUDENT_EMAIL})
        tok2 = r.json()["dev_token"]
        r = requests.post(f"{API}/auth/reset-password", json={"token": tok2, "password": STUDENT_PASSWORD})
        assert r.status_code == 200
        # confirm original works
        r = requests.post(f"{API}/auth/login", json={"email": STUDENT_EMAIL, "password": STUDENT_PASSWORD})
        assert r.status_code == 200

    def test_reset_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "bogus_token_xxx", "password": "abc123"})
        assert r.status_code == 400

    def test_reset_used_token(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": STUDENT_EMAIL})
        tok = r.json()["dev_token"]
        # use once
        r = requests.post(f"{API}/auth/reset-password", json={"token": tok, "password": STUDENT_PASSWORD})
        assert r.status_code == 200
        # reuse should fail
        r = requests.post(f"{API}/auth/reset-password", json={"token": tok, "password": STUDENT_PASSWORD})
        assert r.status_code == 400

    def test_forgot_unknown_email(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": f"noone_{TS}@nowhere.io"})
        assert r.status_code == 200
        # should NOT return dev_token for unknown user
        assert "dev_token" not in r.json()


# ---------- File upload ----------
def _tiny_pdf_bytes() -> bytes:
    # Minimal valid-ish PDF header; storage service just stores bytes.
    return b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


class TestFileUpload:
    def test_upload_resume_and_download(self):
        d = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
        tok = d["access_token"]
        files = {"file": ("resume.pdf", _tiny_pdf_bytes(), "application/pdf")}
        r = requests.post(f"{API}/upload?kind=resume", headers=_auth_hdr(tok), files=files)
        if r.status_code == 503:
            pytest.skip("Storage service unavailable")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["id"] and body["url"].startswith("/api/files/")
        assert body["filename"] == "resume.pdf"
        assert body["size"] > 0
        # user resume_url updated
        me = requests.get(f"{API}/auth/me", headers=_auth_hdr(tok)).json()
        assert me["resume_url"] == body["url"]
        # download
        r = requests.get(f"{BASE_URL}{body['url']}", params={"auth": tok})
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")

    def test_upload_rejects_bad_ext(self):
        tok = _login(STUDENT_EMAIL, STUDENT_PASSWORD)["access_token"]
        files = {"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")}
        r = requests.post(f"{API}/upload?kind=resume", headers=_auth_hdr(tok), files=files)
        assert r.status_code == 400

    def test_upload_rejects_large(self):
        tok = _login(STUDENT_EMAIL, STUDENT_PASSWORD)["access_token"]
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
        tok = _login(STUDENT_EMAIL, STUDENT_PASSWORD)["access_token"]
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
        # cache
        t1 = time.time()
        r2 = requests.post(f"{API}/ai/match-jobs", headers=_auth_hdr(tok), timeout=60)
        elapsed2 = time.time() - t1
        assert r2.status_code == 200
        # cache hit should be much faster
        assert elapsed2 < max(1.0, elapsed1 / 2)

    def test_incomplete_profile(self):
        email = f"qa+ai_empty_{TS}@test.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "Empty", "role": "student"
        })
        assert r.status_code == 200
        tok = r.json()["access_token"]
        r = requests.post(f"{API}/ai/match-jobs", headers=_auth_hdr(tok))
        assert r.status_code == 400

    def test_client_rank_applicants_and_rbac(self):
        cs = _login(CLIENT_EMAIL, CLIENT_PASSWORD)
        ctok = cs["access_token"]
        # find a job owned by demo client
        jobs = requests.get(f"{API}/jobs/mine", headers=_auth_hdr(ctok)).json()
        if not jobs:
            pytest.skip("No client jobs to rank")
        job_id = jobs[0]["id"]
        r = requests.post(f"{API}/ai/match-applicants/{job_id}", headers=_auth_hdr(ctok), timeout=60)
        if r.status_code == 503:
            pytest.skip("AI service unavailable")
        assert r.status_code == 200, r.text
        assert "matches" in r.json()

        # non-owner client
        other_email = f"qa+client2_{TS}@test.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": other_email, "password": "Passw0rd!", "name": "Other Client", "role": "client"
        })
        assert r.status_code == 200
        otok = r.json()["access_token"]
        r = requests.post(f"{API}/ai/match-applicants/{job_id}", headers=_auth_hdr(otok))
        assert r.status_code == 403
