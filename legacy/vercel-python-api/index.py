"""
Legacy Vercel Python entry (DISABLED).

Do not put this back under /api — Vercel treats /api as serverless and will
serve FastAPI instead of the React app (symptoms: {"detail":"Not Found"} on /).

Production API: Railway (backend/Dockerfile).
"""
import os
import sys

# legacy/vercel-python-api → repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

from backend.server import app  # noqa: E402, F401
