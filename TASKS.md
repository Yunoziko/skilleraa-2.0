# Skilleraa — Prioritized Task List

> Generated: July 2026  
> Scope: Full codebase review after Supabase Auth cutover. **No code was changed** for this document.  
> Related: `DEVELOPMENT_PLAN.md`

**Legend:** Estimates are engineering effort for a single developer familiar with the repo (not calendar days with QA/deploy).

---

## Critical

| ID | Type | Task | Why | Est. |
|----|------|------|-----|------|
| C1 | Security | **Require auth on `GET /api/files/{id}`** ✅ | File download currently verifies a token *only if present*; with no token the file is still served. Resumes are world-readable by UUID. | 1–2h |
| C2 | Security | **Add file ACL** (owner and/or clients with an application to that student) | Even with auth, any logged-in user who knows a file UUID can download any resume. | 3–4h |
| C3 | Security | **Restrict CORS** to known frontend origins in production | `allow_origins=["*"]` + `allow_credentials=True` + `allow_origin_regex=".*"` is unsafe for production. | 1–2h |
| C4 | Bug / Ops | **Fill & validate Supabase env vars at startup** | `frontend/.env` and `backend/.env` still have empty `SUPABASE_*` / `REACT_APP_SUPABASE_*`. Fail fast with a clear error if missing in non-dev. | 1–2h |
| C5 | Security | **Stop committing secrets / demo passwords in tracked env & seed docs** | Demo credentials and local secrets live in `.env` / generated `memory/test_credentials.md`. Use `.env.example` only; gate seed credentials. | 2–3h |
| C6 | Security | **Gate or remove hardcoded demo credentials in `Login.jsx`** | `student@skilleraa.com` / `Client@1234` ship in the client bundle. | 30m–1h |
| C7 | Bug | **Ensure role cannot be silently wrong after Google OAuth** | Pending role uses `sessionStorage`; if callback loses it, new users default to `student`. Confirm + harden (e.g. role confirm step if missing). | 2–3h |

**Critical subtotal:** ~11–17h

---

## High

| ID | Type | Task | Why | Est. |
|----|------|------|-----|------|
| H1 | Feature | **Real notifications API + UI** | `/student/notifications` is an empty placeholder; status changes do not notify students. | 2–3d |
| H2 | Feature | **Messaging** (replace `/client/messages` placeholder) | Route reuses empty `Notifications`; no student inbox. | 3–5d |
| H3 | Feature | **Job edit + close/archive** | Clients can only create/delete; no `PUT /jobs/{id}` or status lifecycle. | 1–2d |
| H4 | Feature | **Wire Settings** (password via Supabase, notification prefs) | Settings page is read-only account info. | 1d |
| H5 | Security | **Rate-limit auth-adjacent & public write endpoints** | No rate limits on `/auth/sync`, uploads, AI, apply — abuse / cost risk. | 3–4h |
| H6 | Security | **Reduce token exposure** (prefer cookie strategy or stricter CSP) | Access token mirrored in `localStorage` (`skl_token`); XSS steals sessions. | 1–2d |
| H7 | Bug | **Fix landing false claims** | AI still badge `"Soon"` though matching ships; LinkedIn/GitHub import / “verified clients” / escrow copy are unimplemented. | 1–2h |
| H8 | Performance | **Move AI cache off in-process dict** | `_ai_cache` does not work across Vercel/serverless instances; wasted LLM spend. | 4–6h |
| H9 | Performance | **Replace sync `requests` in async routes with `httpx.AsyncClient`** | Storage/admin HTTP calls block the event loop. | 3–4h |
| H10 | Ops | **Disable seed in production** (`SEED_ON_STARTUP`) | `seed_data()` runs every startup; writes credentials file; creates known users. | 1–2h |
| H11 | Feature | **Application status → notification event** | When client shortlists/hires/rejects, student has no signal except polling Applied Jobs. | 1d (depends on H1) |
| H12 | Code quality | **Startup env validation for Mongo + Supabase** | Missing `SUPABASE_JWT_SECRET` only fails on first authenticated request (503), not at boot. | 2h |

**High subtotal:** ~12–18d

---

## Medium

| ID | Type | Task | Why | Est. |
|----|------|------|-----|------|
| M1 | Feature | **Pagination** on jobs, applications, applicants, saved lists | Hard caps (50–500) will break at scale; no cursor/page API. | 1–2d |
| M2 | Feature | **Advanced job filters in UI** | Backend supports `skill`; no budget range / multi-skill UI. | 1d |
| M3 | Feature | **Onboarding wizard** for new student/client | Profile completion checklist exists; no guided first-run flow. | 2d |
| M4 | Feature | **Reviews after hire** | No ratings collection or UI. | 2–3d |
| M5 | Feature | **Email verification UX** | Supabase handles verify; app lacks clear resend / “check your email” states beyond basic signup redirect. | 4–6h |
| M6 | Feature | **Change password / account delete (GDPR)** | Settings incomplete; no delete-account API. | 1–2d |
| M7 | Security | **Public profile should not expose email** | `serialize_user` includes `email` on `GET /profile/{id}`. | 1h |
| M8 | Security | **Sanitize / limit `$regex` search input** | Untrusted `q` used in Mongo `$regex` — ReDoS / injection risk. | 2–3h |
| M9 | Performance | **Add DB indexes for common filters** | e.g. jobs by `category`, `client_id`, applications by `status`. | 2–3h |
| M10 | Performance | **Adopt React Query (already installed) for data fetching** | Every page re-fetches independently; no shared cache/deduping. | 1–2d |
| M11 | Code quality | **Split monolithic `server.py`** into routers/services | ~1,100+ lines: auth, jobs, AI, storage, seed in one file. | 1–2d |
| M12 | Code quality | **Migrate FastAPI `@app.on_event` → `lifespan`** | Deprecated pattern. | 1–2h |
| M13 | Code quality | **Add React error boundary** | Uncaught render errors blank the app. | 2h |
| M14 | Code quality | **Proper root `README.md`** | Setup, env vars, Supabase, run instructions. | 2–3h |
| M15 | Bug | **JobDetail “already applied” check** | Relies on `a.job_id === id`; confirm type consistency after ObjectId serialization across edge cases. | 1–2h |
| M16 | Bug | **Mobile nav truncates to 5 items** | Profile/settings hard to reach on small screens. | 2–3h |
| M17 | Ops | **CI: lint + pytest + build on PR** | No GitHub Actions visible. | 4–6h |
| M18 | Ops | **Health endpoint** (`/api/health`) checking Mongo + storage config | Only `/api/` status ok today. | 2–3h |
| M19 | Feature | **Terms / Privacy pages** | Needed before public launch / payments. | 4h (content dependent) |
| M20 | Security | **Magic-byte validation on uploads** | Extension-only MIME checks; easy to spoof. | 3–4h |

**Medium subtotal:** ~14–22d

---

## Low

| ID | Type | Task | Why | Est. |
|----|------|------|-----|------|
| L1 | Feature | **Dark mode** (`next-themes` installed, unused) | Design tokens exist in `design_guidelines.json`. | 1d |
| L2 | Feature | **Stripe escrow / payments** | Marketing claims “secure hiring”; no payments stack. | 1–2w |
| L3 | Feature | **Client analytics dashboard** | Funnel / view-apply ratios missing. | 3–5d |
| L4 | Feature | **Admin moderation role** | Seeded “admin” is just a client; no admin APIs. | 3–5d |
| L5 | Feature | **LinkedIn/GitHub import** | Claimed on landing only. | 3–5d |
| L6 | Feature | **Portfolio upload kind** | Resume upload exists; portfolio files do not. | 4–6h |
| L7 | Feature | **Numeric budget model + filter** | Budget is free-text; cannot sort/filter by range. | 1–2d |
| L8 | Performance | **Job search via Atlas Search / text index** | Regex `$or` does not scale. | 1–2d |
| L9 | Code quality | **Remove unused frontend deps** | React Query unused (or adopt M10), `swr`, `recharts`, etc. | 1–2h |
| L10 | Code quality | **Trim unused backend deps** | `pandas`, `numpy`, `jq`, `typer`, `python-jose` likely unused. | 1–2h |
| L11 | Code quality | **CRA → Vite migration** | CRA is maintenance-mode. | 2–3d |
| L12 | Code quality | **Frontend unit tests** (auth context, api interceptor) | Almost no component/unit tests. | 2–3d |
| L13 | Code quality | **docker-compose** for Mongo + API + frontend | Onboarding friction. | 4–6h |
| L14 | Code quality | **Remove dead `password_hash` / bcrypt from seed path long-term** | Auth is Supabase; hashes are leftover. | 1–2h |
| L15 | Feature | **SEO meta + sitemap** | SPA has minimal SEO. | 4–6h |
| L16 | Feature | **WebSocket/SSE for live notifications** | After H1, upgrade from poll. | 2–3d |
| L17 | Security | **Security headers** (CSP, HSTS, X-Frame-Options) via Vercel/middleware | Not configured. | 2–3h |
| L18 | Ops | **Sentry (or similar) error monitoring** | No production observability. | 3–4h |
| L19 | Bug / UX | **Fold ResetPassword Supabase session listen into AuthContext** | Small duplication of auth-adjacent logic. | 1–2h |
| L20 | Feature | **Avatar upload** | Letter avatars only. | 4–6h |

**Low subtotal:** ~4–7w (selective)

---

## Suggested order of attack

```
Week 1     C1–C6, H5, H7, H10, H12     Secure files, CORS, env, seed, landing copy
Week 2     H3, H4, M7, M8, M14         Job edit/close, Settings, privacy, README
Week 3–4   H1, H11, H2                 Notifications then messaging
Ongoing    H8–H9, M1, M10–M12, M17     Perf + modularization + CI
Later      M3–M6, L2–L5                Growth / monetization
```

---

## Category rollup

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Bugs | C4, C7 | H7 | M15, M16 | L19 |
| Missing features | — | H1–H4, H11 | M1–M6, M19 | L1–L7, L15–L16, L20 |
| Performance | — | H8, H9 | M9, M10 | L8 |
| Security | C1–C3, C5–C6 | H5, H6 | M7, M8, M20 | L17 |
| Code quality / Ops | — | H10, H12 | M11–M14, M17–M18 | L9–L14, L18 |

---

## Out of scope for this list

- Changing UI design system / visual redesign  
- Full Mongo → Supabase Postgres migration  
- Rewriting the marketplace domain model  

---

*Update this file as tasks are completed. Prefer linking PRs next to each ID.*
