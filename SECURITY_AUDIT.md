# Skilleraa Security Audit Report

**Date:** 2026-08-02  
**Scope:** Supabase RLS/storage/grants, FastAPI API auth, frontend auth/routes, payments, uploads, env/secrets  
**Constraint:** Hardening only — no new product features  

---

## 1. Executive summary

Critical payment forgery paths, file download IDOR, open CORS, metadata admin privilege escalation, and over-broad storage/profile exposure were identified and fixed. Migrations were applied to the live Supabase project (`ntplmmiqdmbricrcksvg`). Frontend build and lint pass.

**Production readiness score: 78 / 100**

---

## 2. Findings fixed

| Severity | Issue | Fix |
|----------|--------|-----|
| Critical | Clients could INSERT/UPDATE payments (amount/payee forge) | Revoked client write grants; payments created only via service role; freeze trigger |
| Critical | `GET /api/files/{id}` IDOR (any authed user) | Ownership check + remove `?auth=` JWT query param |
| Critical | CORS `*` + credentials | `CORS_ORIGINS` allowlist |
| Critical | Profile INSERT could set `role=admin` | INSERT `WITH CHECK` limited to student/client |
| High | Rating columns forgeable on profile UPDATE | Trigger locks `average_rating` / `review_count` |
| High | Suspended users still mutate data | `is_active_account()` on jobs/apps/messages/reviews/profile/storage |
| High | Storage: clients could read whole applicant folders | SELECT limited to current `resume_url` / `portfolio_url` path |
| High | Anon could see closed jobs + sensitive profile columns | Anon: open jobs only; column-level profile SELECT |
| High | Anon retained INSERT/UPDATE/DELETE on payments/wallets | Revoked anon/authenticated mutate grants |
| High | Mongo `$regex` from raw `q` | `re.escape` + length cap |
| High | Unconditional demo seed with passwords | Gated behind `SEED_DEMO_DATA` |
| High | `resolveAuthRole` accepted `admin` from user_metadata | Admin only via `resolveAppRole(dbProfile.role)` |
| Medium | Upload MIME/ext spoofing | Magic-byte validation for pdf/png/jpeg/zip |
| Medium | Payment verify trusted row amount/payee | Re-validates bid + freelancer + job client |
| Medium | Public Mongo profile leaked email/resume | `serialize_public_user` |
| Medium | Privileged RPCs executable by anon | Revoked anon EXECUTE; authenticated + `is_admin()` checks remain |
| Low | Message edit trigger missing `search_path` | Set `search_path = public` |

---

## 3. Files changed

### Migrations (applied remotely)
- `supabase/migrations/20260802140000_security_hardening.sql`
- `supabase/migrations/20260802141000_security_active_profile_update.sql`
- `supabase/migrations/20260802142000_security_revoke_anon_table_grants.sql`

### Backend
- `backend/server.py` — CORS, seed gate, file ownership, regex escape, public profile
- `backend/storage_uploads.py` — magic-byte checks
- `backend/payments_razorpay.py` — verify re-binds to application bid/payee
- `backend/.env.example` — `CORS_ORIGINS`, `SEED_DEMO_DATA`, secret guidance

### Frontend
- `frontend/src/lib/supabase.js` — `resolveAuthRole` / `resolveAppRole`
- `frontend/src/context/AuthContext.jsx` — admin only from DB profile
- `frontend/src/lib/profilesService.js` — signup role never admin

### Report
- `SECURITY_AUDIT.md` (this file)

---

## 4. Remaining risks

1. **Suspended JWTs still read** — mutations blocked; SELECT on open data may still work until session refresh/sign-out. Prefer Auth ban or short JWT TTL.
2. **Payment wallet credit not transactional** — REST patch + insert can race under rare failures; prefer a single Postgres RPC with row locks.
3. **Dual data stores (Mongo + Supabase)** — some legacy Mongo routes remain; keep treating Supabase as source of truth for authz.
4. **Admin RPCs are SECURITY DEFINER** — intentional; protected by `is_admin()`, but any future bug in those functions is high impact.
5. **Leaked-password protection disabled** in Supabase Auth (advisor WARN) — enable in dashboard.
6. **`notifications` table RLS with no policies** — locked down (deny-all) until real policies land; OK if unused.
7. **Service role key on backend** — must never ship to frontend; rotate if ever exposed.
8. **Production env** — set real `CORS_ORIGINS`, keep `SEED_DEMO_DATA=false`, use Razorpay live keys only in prod with webhook verification preferred long-term.

---

## 5. Production readiness score: **78 / 100**

| Area | Score | Notes |
|------|------:|-------|
| RLS / grants | 85 | Core money paths locked; advisors still warn on definer RPCs |
| Auth / admin | 82 | DB role + route guards; no metadata admin |
| API / CORS / IDOR | 80 | Fixed; dual-backend residual risk |
| Payments | 75 | Forgery closed; atomic credit still pending |
| Storage / uploads | 80 | Path-bound reads + magic bytes |
| Secrets / env | 78 | Examples hardened; ops discipline required |
| XSS / injection | 88 | No `dangerouslySetInnerHTML`; Mongo regex escaped |

**Not 90+ yet** because of non-atomic wallet credit, suspended-user read gap, and dual Mongo/Supabase surface.

---

## 6. Pre-prod checklist

- [ ] `CORS_ORIGINS` = production frontend origin(s) only  
- [ ] `SEED_DEMO_DATA=false`  
- [ ] Confirm only anon/publishable keys in frontend env  
- [ ] Enable Supabase leaked-password protection  
- [ ] Promote admins only via SQL: `update profiles set role='admin' where id=...`  
- [ ] Rotate any keys that ever lived in git or chat logs  
