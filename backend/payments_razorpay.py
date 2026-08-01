"""Razorpay Test Mode: create order + verify payment, persist via Supabase service role."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger("skilleraa.payments")

router = APIRouter(prefix="/payments", tags=["payments"])

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_CURRENCY = (os.environ.get("RAZORPAY_CURRENCY") or "INR").upper()


def _placeholder(value: Optional[str]) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return (
        "placeholder" in lowered
        or "your_" in lowered
        or "xxxx" in lowered
    )


def razorpay_configured() -> bool:
    return not _placeholder(RAZORPAY_KEY_ID) and not _placeholder(RAZORPAY_KEY_SECRET)


class CreateOrderIn(BaseModel):
    application_id: str = Field(min_length=1)


class VerifyPaymentIn(BaseModel):
    payment_id: str = Field(min_length=1)
    razorpay_order_id: str = Field(min_length=1)
    razorpay_payment_id: str = Field(min_length=1)
    razorpay_signature: str = Field(min_length=1)


def _sb_headers(service_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _supabase_rest(
    method: str,
    path: str,
    *,
    supabase_url: str,
    service_key: str,
    params: Optional[Dict[str, str]] = None,
    json_body: Any = None,
    prefer: Optional[str] = None,
) -> Any:
    headers = _sb_headers(service_key)
    if prefer:
        headers["Prefer"] = prefer
    url = f"{supabase_url}/rest/v1/{path.lstrip('/')}"
    resp = requests.request(
        method,
        url,
        headers=headers,
        params=params,
        json=json_body,
        timeout=30,
    )
    if resp.status_code >= 400:
        logger.error("Supabase REST error %s %s: %s", method, path, resp.text[:400])
        raise HTTPException(status_code=502, detail="Database error while processing payment")
    if resp.status_code == 204 or not resp.content:
        return None
    return resp.json()


def _get_supabase_uid_and_role(request: Request, decode_token, supabase_url: str, service_key: str) -> Dict[str, str]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    payload = decode_token(token)
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    rows = _supabase_rest(
        "GET",
        "profiles",
        supabase_url=supabase_url,
        service_key=service_key,
        params={"id": f"eq.{uid}", "select": "id,role,full_name"},
    )
    if not rows:
        raise HTTPException(status_code=403, detail="Profile not found")
    profile = rows[0]
    return {
        "id": uid,
        "role": profile.get("role") or "",
        "name": profile.get("full_name") or "",
        "email": (payload.get("email") or "").strip(),
    }


def _create_razorpay_order(amount_paise: int, receipt: str, notes: Dict[str, str]) -> Dict[str, Any]:
    if not razorpay_configured():
        raise HTTPException(status_code=503, detail="Razorpay is not configured")
    resp = requests.post(
        "https://api.razorpay.com/v1/orders",
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
        json={
            "amount": amount_paise,
            "currency": RAZORPAY_CURRENCY,
            "receipt": receipt[:40],
            "notes": notes,
            "payment_capture": 1,
        },
        timeout=30,
    )
    if resp.status_code >= 400:
        logger.error("Razorpay order failed: %s", resp.text[:400])
        raise HTTPException(status_code=502, detail="Failed to create Razorpay order")
    return resp.json()


def _verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    body = f"{order_id}|{payment_id}".encode("utf-8")
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _ensure_wallet(supabase_url: str, service_key: str, user_id: str) -> Dict[str, Any]:
    rows = _supabase_rest(
        "GET",
        "wallets",
        supabase_url=supabase_url,
        service_key=service_key,
        params={"user_id": f"eq.{user_id}", "select": "*"},
    )
    if rows:
        return rows[0]
    created = _supabase_rest(
        "POST",
        "wallets",
        supabase_url=supabase_url,
        service_key=service_key,
        json_body={"user_id": user_id},
        prefer="return=representation",
    )
    if isinstance(created, list) and created:
        return created[0]
    raise HTTPException(status_code=502, detail="Failed to create wallet")


def register_payment_routes(api_router, *, decode_token, supabase_url_getter, service_key_getter, is_supabase_ready):
    """Attach payment routes onto the main /api router."""

    @api_router.post("/payments/create-order")
    async def create_order(body: CreateOrderIn, request: Request):
        if not is_supabase_ready():
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        if not razorpay_configured():
            raise HTTPException(status_code=503, detail="Razorpay is not configured")

        supabase_url = supabase_url_getter()
        service_key = service_key_getter()
        if not service_key:
            raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY is required for payments")

        auth = _get_supabase_uid_and_role(request, decode_token, supabase_url, service_key)
        if auth["role"] != "client":
            raise HTTPException(status_code=403, detail="Only clients can create payments")

        apps = _supabase_rest(
            "GET",
            "applications",
            supabase_url=supabase_url,
            service_key=service_key,
            params={
                "id": f"eq.{body.application_id}",
                "select": "id,status,freelancer_id,bid_amount,job_id,jobs(id,client_id,title)",
            },
        )
        if not apps:
            raise HTTPException(status_code=404, detail="Application not found")
        app = apps[0]
        job = app.get("jobs") or {}
        if app.get("status") != "accepted":
            raise HTTPException(status_code=400, detail="Application must be accepted before payment")
        if job.get("client_id") != auth["id"]:
            raise HTTPException(status_code=403, detail="You can only pay for your own jobs")

        amount = float(app.get("bid_amount") or 0)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid bid amount on application")

        amount_paise = int(round(amount * 100))
        if amount_paise < 100:
            raise HTTPException(status_code=400, detail="Minimum payment amount is ₹1.00")

        existing = _supabase_rest(
            "GET",
            "payments",
            supabase_url=supabase_url,
            service_key=service_key,
            params={
                "application_id": f"eq.{body.application_id}",
                "select": "*",
            },
        )
        if existing:
            payment = existing[0]
            if payment.get("status") == "paid":
                raise HTTPException(status_code=400, detail="This application is already paid")
            # Reuse pending payment with a fresh Razorpay order
            order = _create_razorpay_order(
                amount_paise,
                receipt=str(payment["id"]).replace("-", "")[:40],
                notes={
                    "application_id": body.application_id,
                    "payment_id": payment["id"],
                },
            )
            updated = _supabase_rest(
                "PATCH",
                "payments",
                supabase_url=supabase_url,
                service_key=service_key,
                params={"id": f"eq.{payment['id']}"},
                json_body={
                    "amount": amount,
                    "currency": RAZORPAY_CURRENCY,
                    "razorpay_order_id": order["id"],
                    "status": "pending",
                    "razorpay_payment_id": None,
                    "razorpay_signature": None,
                },
                prefer="return=representation",
            )
            payment = updated[0] if isinstance(updated, list) and updated else {**payment, "razorpay_order_id": order["id"]}
        else:
            # Insert payment row first to get id for receipt
            created = _supabase_rest(
                "POST",
                "payments",
                supabase_url=supabase_url,
                service_key=service_key,
                json_body={
                    "application_id": body.application_id,
                    "client_id": auth["id"],
                    "freelancer_id": app["freelancer_id"],
                    "amount": amount,
                    "currency": RAZORPAY_CURRENCY,
                    "status": "pending",
                },
                prefer="return=representation",
            )
            payment = created[0] if isinstance(created, list) else created
            order = _create_razorpay_order(
                amount_paise,
                receipt=str(payment["id"]).replace("-", "")[:40],
                notes={
                    "application_id": body.application_id,
                    "payment_id": payment["id"],
                },
            )
            updated = _supabase_rest(
                "PATCH",
                "payments",
                supabase_url=supabase_url,
                service_key=service_key,
                params={"id": f"eq.{payment['id']}"},
                json_body={"razorpay_order_id": order["id"]},
                prefer="return=representation",
            )
            payment = updated[0] if isinstance(updated, list) and updated else {**payment, "razorpay_order_id": order["id"]}

        return {
            "payment_id": payment["id"],
            "application_id": body.application_id,
            "amount": amount,
            "currency": RAZORPAY_CURRENCY,
            "razorpay_order_id": payment["razorpay_order_id"],
            "razorpay_key_id": RAZORPAY_KEY_ID,
            "job_title": job.get("title") or "Skilleraa job",
            "prefill": {
                "name": auth.get("name") or "",
                "email": auth.get("email") or "",
            },
        }

    @api_router.post("/payments/verify")
    async def verify_payment(body: VerifyPaymentIn, request: Request):
        if not is_supabase_ready():
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        if not razorpay_configured():
            raise HTTPException(status_code=503, detail="Razorpay is not configured")

        supabase_url = supabase_url_getter()
        service_key = service_key_getter()
        if not service_key:
            raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY is required for payments")

        auth = _get_supabase_uid_and_role(request, decode_token, supabase_url, service_key)
        if auth["role"] != "client":
            raise HTTPException(status_code=403, detail="Only clients can verify payments")

        rows = _supabase_rest(
            "GET",
            "payments",
            supabase_url=supabase_url,
            service_key=service_key,
            params={"id": f"eq.{body.payment_id}", "select": "*"},
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Payment not found")
        payment = rows[0]

        if payment.get("client_id") != auth["id"]:
            raise HTTPException(status_code=403, detail="Not your payment")
        if payment.get("status") == "paid":
            return {"ok": True, "status": "paid", "payment": payment}
        if payment.get("razorpay_order_id") != body.razorpay_order_id:
            raise HTTPException(status_code=400, detail="Order mismatch")

        if not _verify_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
            _supabase_rest(
                "PATCH",
                "payments",
                supabase_url=supabase_url,
                service_key=service_key,
                params={"id": f"eq.{payment['id']}"},
                json_body={"status": "failed"},
            )
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        amount = float(payment.get("amount") or 0)
        freelancer_id = payment["freelancer_id"]
        wallet = _ensure_wallet(supabase_url, service_key, freelancer_id)

        # Idempotency: skip wallet credit if a credit txn already exists for this payment
        existing_tx = _supabase_rest(
            "GET",
            "wallet_transactions",
            supabase_url=supabase_url,
            service_key=service_key,
            params={
                "payment_id": f"eq.{payment['id']}",
                "type": "eq.credit",
                "select": "id",
            },
        )

        updated_payment = _supabase_rest(
            "PATCH",
            "payments",
            supabase_url=supabase_url,
            service_key=service_key,
            params={"id": f"eq.{payment['id']}"},
            json_body={
                "status": "paid",
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_signature": body.razorpay_signature,
            },
            prefer="return=representation",
        )
        payment = updated_payment[0] if isinstance(updated_payment, list) and updated_payment else payment

        if not existing_tx:
            pending = float(wallet.get("pending_balance") or 0) + amount
            lifetime = float(wallet.get("lifetime_earnings") or 0) + amount
            _supabase_rest(
                "PATCH",
                "wallets",
                supabase_url=supabase_url,
                service_key=service_key,
                params={"id": f"eq.{wallet['id']}"},
                json_body={
                    "pending_balance": pending,
                    "lifetime_earnings": lifetime,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            _supabase_rest(
                "POST",
                "wallet_transactions",
                supabase_url=supabase_url,
                service_key=service_key,
                json_body={
                    "wallet_id": wallet["id"],
                    "payment_id": payment["id"],
                    "amount": amount,
                    "type": "credit",
                    "description": "Payment received for accepted application",
                },
                prefer="return=minimal",
            )

        return {"ok": True, "status": "paid", "payment": payment}

    @api_router.get("/payments/by-application/{application_id}")
    async def payment_by_application(application_id: str, request: Request):
        if not is_supabase_ready():
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        supabase_url = supabase_url_getter()
        service_key = service_key_getter()
        if not service_key:
            raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY is required")

        auth = _get_supabase_uid_and_role(request, decode_token, supabase_url, service_key)
        rows = _supabase_rest(
            "GET",
            "payments",
            supabase_url=supabase_url,
            service_key=service_key,
            params={
                "application_id": f"eq.{application_id}",
                "select": "id,application_id,client_id,freelancer_id,amount,currency,status,created_at,razorpay_order_id,razorpay_payment_id",
            },
        )
        if not rows:
            return {"payment": None}
        payment = rows[0]
        if auth["id"] not in (payment.get("client_id"), payment.get("freelancer_id")):
            raise HTTPException(status_code=403, detail="Not allowed")
        return {"payment": payment}
