# Skilleraa — Development Plan

> **Generated:** July 2026  
> **Scope:** Read-only analysis of the full codebase. No existing functionality or UI was modified.  
> **Source of truth:** `memory/PRD.md`, `backend/server.py`, `frontend/src/`, test reports, and deployment config.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Architecture](#3-architecture)
4. [Current Frontend](#4-current-frontend)
5. [Current Backend](#5-current-backend)
6. [Existing Routes](#6-existing-routes)
7. [Existing Components](#7-existing-components)
8. [Authentication](#8-authentication)
9. [Database](#9-database)
10. [Missing APIs](#10-missing-apis)
11. [Missing Pages](#11-missing-pages)
12. [Missing Features](#12-missing-features)
13. [Technical Debt](#13-technical-debt)
14. [Security Issues](#14-security-issues)
15. [Development Roadmap: MVP → Production](#15-development-roadmap-mvp--production)

---

## 1. Executive Summary

**Skilleraa** is a black-and-white freelancing marketplace connecting students/freshers with clients (startups, agencies, SMBs). The project is a **functional MVP** with core job marketplace flows implemented end-to-end:

| Area | Status |
|------|--------|
| Auth (register, login, JWT refresh, password reset) | ✅ Complete |
| Student flows (browse, apply, save, profile, dashboard) | ✅ Complete |
| Client flows (post job, manage applicants, status updates) | ✅ Complete |
| Resume upload + AI job/applicant matching | ✅ Complete (P1) |
| Notifications & messaging | ❌ Placeholder UI only |
| Payments, reviews, email delivery | ❌ Not started |
| Production hardening (CORS, rate limits, modular backend) | ⚠️ Partial |

**Test coverage:** 34/34 backend pytest cases pass (sequential). Frontend Playwright flows pass for core and P1 features.

**Primary gaps before production:** real email delivery, notifications/messaging, job editing, security hardening, backend modularization, and deployment concerns (serverless AI cache, seed-on-startup).

---

## 2. Project Overview

### Purpose

A minimal, premium freelancing platform inspired by Linear/Vercel/Notion aesthetics. Two personas:

1. **Student** — browse jobs, apply with cover letter, save jobs, build profile, get AI-matched jobs.
2. **Client** — post jobs, review applicants, update application status (pending → shortlisted → hired/rejected), AI-rank applicants.

### Repository Structure

```
skilleraa-2.0-main/
├── api/                    # Vercel serverless entry (re-exports backend.server)
│   ├── index.py
│   └── emergentintegrations/llm/chat.py   # LLM wrapper (Anthropic / Emergent)
├── backend/
│   ├── server.py           # Monolithic FastAPI app (~1,240 lines)
│   ├── requirements.txt
│   └── tests/              # backend_test.py (19), test_p1.py (15)
├── frontend/
│   ├── src/
│   │   ├── pages/          # Route-level pages
│   │   ├── components/     # Feature + layout + shadcn/ui
│   │   ├── context/        # AuthContext
│   │   └── lib/            # api.js, utils.js
│   ├── package.json
│   └── craco.config.js
├── memory/
│   ├── PRD.md
│   └── test_credentials.md  # Auto-generated on backend startup
├── vercel.json             # Dual build: Python API + static frontend
└── design_guidelines.json
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, CRA + CRACO, Tailwind CSS 3, shadcn/ui (Radix), Framer Motion, React Router 7, Axios, Sonner |
| Backend | FastAPI 0.110, Motor (async MongoDB), PyJWT, bcrypt |
| Database | MongoDB (`skilleraa_db` via `DB_NAME` env) |
| AI | Claude Sonnet via `emergentintegrations` / Emergent LLM key |
| File storage | Emergent object storage (`integrations.emergentagent.com/objstore`) |
| Deployment | Vercel (static frontend + Python serverless `/api/*`) |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                   │
│  AuthContext → api.js (Axios + Bearer + cookie + refresh)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS /api/*
┌──────────────────────────▼──────────────────────────────────┐
│              Vercel / Local Uvicorn                            │
│  api/index.py → backend/server.py (FastAPI)                 │
└──────┬─────────────────┬──────────────────┬─────────────────┘
       │                 │                  │
       ▼                 ▼                  ▼
   MongoDB         Emergent Storage    Emergent LLM / Anthropic
   (Motor)         (resume files)      (AI matching)
```

**Key design decisions:**

- **Dual auth transport:** httpOnly cookies (`access_token`, `refresh_token`) plus JSON body tokens stored in `localStorage` (`skl_token`, `skl_refresh`) as Bearer fallback for cross-origin cookie issues.
- **Monolithic backend:** All routes, models, seed, AI, and storage logic live in a single `server.py`.
- **In-process AI cache:** 5-minute TTL dict keyed by user/job — not shared across serverless instances.
- **Startup seed:** Demo users and 8 sample jobs are ensured on every app startup.

---

## 4. Current Frontend

### Framework & Tooling

- **Build:** Create React App via CRACO with `@/` path alias.
- **Styling:** Tailwind + custom `.skl-border`, `.font-display` (Cabinet Grotesk), Inter for body.
- **UI library:** Full shadcn/ui component set under `components/ui/` (40+ primitives).
- **State:** React Context for auth only. `@tanstack/react-query` and `swr` are installed but **unused**.
- **Theming:** `next-themes` installed; dark mode tokens exist in `design_guidelines.json` but **not implemented** in UI.
- **Testing:** `data-testid` attributes on interactive elements; no Jest/RTL test files in `src/`.

### Page Inventory

| Route | File | Backend Integration | Notes |
|-------|------|---------------------|-------|
| `/` | `Landing.jsx` | `/jobs/featured`, `/stats` | Hero, mockup, features, testimonials |
| `/login` | `Login.jsx` | AuthContext → `/auth/login` | Demo one-tap accounts |
| `/signup` | `Signup.jsx` | AuthContext → `/auth/register` | Role selector (student/client) |
| `/forgot-password` | `ForgotPassword.jsx` | `/auth/forgot-password` | Shows `dev_token` in demo |
| `/reset-password` | `ResetPassword.jsx` | `/auth/reset-password` | Token via query param |
| `/jobs` | `Jobs.jsx` | `/jobs`, `/jobs/saved/ids`, save toggle | Search + filters |
| `/jobs/:id` | `JobDetail.jsx` | `/jobs/:id`, apply, applications check | Cover letter apply flow |
| `/about` | `About.jsx` | None | Static content |
| `/u/:id` | `PublicProfile.jsx` | `/profile/:id`, `/jobs` (client jobs) | Public student/client profile |
| `/post-job` | `PostJobGate` in `App.js` | Role redirect | Clients → `/client/post` |
| `/student` | `StudentDashboard.jsx` | dashboard, applications, jobs, AI | Stats, AI matches, checklist |
| `/student/applied` | `AppliedJobs.jsx` | `/applications/mine` | Application list |
| `/student/saved` | `SavedJobs.jsx` | `/jobs/saved/list`, save toggle | Saved jobs |
| `/student/profile` | `StudentProfile.jsx` | `/profile`, `/upload` | Resume upload |
| `/student/notifications` | `Notifications.jsx` | **None** | Empty state placeholder |
| `/student/settings` | `Settings.jsx` | **None** (reads AuthContext) | Read-only account info |
| `/client` | `ClientDashboard.jsx` | dashboard, jobs/mine, applicants/all | Stats + recent activity |
| `/client/post` | `PostJob.jsx` | `POST /jobs` | Create job only (no edit) |
| `/client/jobs` | `MyJobs.jsx` | `/jobs/mine`, `DELETE /jobs/:id` | Delete only |
| `/client/applicants` | `Applicants.jsx` | applicants, status, AI rank | Full applicant management |
| `/client/messages` | `Notifications.jsx` (reused) | **None** | Same empty placeholder |
| `/client/profile` | `ClientProfile.jsx` | `/profile` | Company profile |
| `/client/settings` | `Settings.jsx` (reused) | **None** | Read-only account info |
| `*` | `NotFound.jsx` | None | 404 page |

### API Client (`lib/api.js`)

- Axios instance with `withCredentials: true`.
- Request interceptor: attaches `Authorization: Bearer ${skl_token}`.
- Response interceptor: on 401, calls `/auth/refresh`, retries queued requests, clears tokens on failure.
- Helpers: `saveTokens`, `saveToken`, `clearToken`, `formatApiError`.

### Known Frontend Inconsistencies (non-blocking)

- Landing page feature card still shows **"AI Job Matching — Soon"** badge while AI matching is live on the student dashboard.
- Landing mentions "Import from LinkedIn or GitHub" — not implemented.
- "Verified Clients" and "Milestone-based safety" are marketing copy without backend support.

---

## 5. Current Backend

### Single-File Architecture (`backend/server.py`)

All logic is in one file organized by comment sections:

| Section | Lines (approx.) | Responsibility |
|---------|-----------------|----------------|
| Config & DB | 26–39 | JWT TTL, Mongo connection |
| Utilities | 48–143 | Password hash, JWT, cookies, auth dependency, role check |
| Models | 146–220 | Pydantic input/output schemas |
| Auth routes | 224–339 | register, login, logout, refresh, forgot/reset, me |
| Profile | 343–360 | update, public get |
| Jobs | 364–458 | CRUD (no update), list, featured, mine, apply |
| Applications | 462–562 | mine, applicants, all, status update |
| Saved jobs | 566–604 | toggle, list, ids |
| Stats/Dashboard | 608–657 | public stats, student/client dashboards |
| Object storage | 660–805 | upload, download |
| AI matching | 808–992 | match-jobs, match-applicants |
| Seed | 998–1199 | demo users, jobs, test_credentials.md |
| Lifecycle | 1202–1241 | indexes, startup seed, CORS, router mount |

### Complete API Reference

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/` | No | — | Health check |
| POST | `/api/auth/register` | No | — | Create account |
| POST | `/api/auth/login` | No | — | Login |
| POST | `/api/auth/logout` | No | — | Clear cookies |
| POST | `/api/auth/refresh` | Refresh token | — | Rotate access + refresh |
| POST | `/api/auth/forgot-password` | No | — | Create reset token (returns `dev_token` in demo) |
| POST | `/api/auth/reset-password` | No | — | Reset password with token |
| GET | `/api/auth/me` | Yes | any | Current user |
| PUT | `/api/profile` | Yes | any | Update profile fields |
| GET | `/api/profile/{user_id}` | No | — | Public profile |
| GET | `/api/jobs` | No | — | List open jobs (filters: q, category, remote, experience, skill) |
| GET | `/api/jobs/featured` | No | — | Top 6 open jobs |
| GET | `/api/jobs/mine` | Yes | client | Client's jobs |
| GET | `/api/jobs/{job_id}` | No | — | Job detail |
| POST | `/api/jobs` | Yes | client | Create job |
| DELETE | `/api/jobs/{job_id}` | Yes | client (owner) | Delete job + applications |
| POST | `/api/jobs/{job_id}/apply` | Yes | student | Apply with cover letter |
| GET | `/api/applications/mine` | Yes | student | Student's applications |
| GET | `/api/jobs/{job_id}/applicants` | Yes | client (owner) | Applicants for one job |
| GET | `/api/applicants/all` | Yes | client | All applicants across client's jobs |
| PUT | `/api/applications/{app_id}/status` | Yes | client (owner) | Update status |
| POST | `/api/jobs/{job_id}/save` | Yes | student | Toggle saved job |
| GET | `/api/jobs/saved/list` | Yes | student | Saved jobs with details |
| GET | `/api/jobs/saved/ids` | Yes | student* | Saved job ID list |
| GET | `/api/stats` | No | — | Platform counts |
| GET | `/api/dashboard/student` | Yes | student | Dashboard stats + profile completion |
| GET | `/api/dashboard/client` | Yes | client | Dashboard stats |
| POST | `/api/upload?kind=resume` | Yes | any | Upload file (5MB, PDF/PNG/JPG) |
| GET | `/api/files/{file_id}` | Optional JWT | — | Download file |
| POST | `/api/ai/match-jobs` | Yes | student | AI top-5 job matches |
| POST | `/api/ai/match-applicants/{job_id}` | Yes | client (owner) | AI top-5 applicant ranks |

### External Dependencies

| Service | Env Var | Used For |
|---------|---------|----------|
| MongoDB | `MONGO_URL`, `DB_NAME` | Primary data store |
| JWT | `JWT_SECRET` | Token signing |
| Emergent | `EMERGENT_LLM_KEY` | Object storage init + LLM calls |
| Demo seed | `DEMO_STUDENT_*`, `DEMO_CLIENT_*`, `ADMIN_*` | Startup seed users |
| App identity | `APP_NAME` | Storage path prefix |

### Tests

| File | Cases | Coverage |
|------|-------|----------|
| `backend_test.py` | 19 | Public, auth, jobs, applications, saved, profile, dashboards |
| `test_p1.py` | 15 | Refresh token, password reset, upload, AI matching |

**Caveat:** Password reset test mutates demo student password; fails under `pytest-xdist` parallel workers.

---

## 6. Existing Routes

### Frontend Routes (React Router 7)

```
Public
  /                          Landing
  /login                     Login
  /signup                    Signup
  /forgot-password           Forgot Password
  /reset-password            Reset Password (?token=)
  /jobs                      Job listing
  /jobs/:id                  Job detail
  /about                     About
  /u/:id                     Public profile
  /post-job                  Role gate → redirect

Student (ProtectedRoute role=student)
  /student                   Dashboard
  /student/applied           Applied jobs
  /student/saved             Saved jobs
  /student/profile           Profile + resume
  /student/notifications     Placeholder
  /student/settings          Read-only settings

Client (ProtectedRoute role=client)
  /client                    Dashboard
  /client/post               Post job
  /client/jobs               My jobs
  /client/applicants         Applicants + AI rank
  /client/messages           Placeholder (reuses Notifications)
  /client/profile            Company profile
  /client/settings           Read-only settings

  *                          404 NotFound
```

### Route Protection

`ProtectedRoute.jsx`:
- Shows spinner while `AuthContext.loading`.
- Redirects unauthenticated users to `/login` with `state.from`.
- Redirects wrong-role users to their role dashboard.

---

## 7. Existing Components

### Feature Components

| Component | File | Purpose |
|-----------|------|---------|
| `AiMatches` | `components/AiMatches.jsx` | Student AI job matching panel |
| `DashboardMockup` | `components/DashboardMockup.jsx` | Landing page dashboard preview |
| `EmptyState` | `components/EmptyState.jsx` | Reusable empty state with CTA |
| `JobCard` | `components/JobCard.jsx` | Job listing card with save toggle |
| `ResumeUpload` | `components/ResumeUpload.jsx` | Resume upload/replace/remove |

### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| `DashboardShell` | `layout/DashboardShell.jsx` | Sidebar + mobile nav + page shell |
| `Footer` | `layout/Footer.jsx` | Site footer |
| `Navbar` | `layout/Navbar.jsx` | Public nav with auth-aware links |
| `ProtectedRoute` | `layout/ProtectedRoute.jsx` | Auth + role guard |

### UI Primitives (`components/ui/`)

Full shadcn/ui set: accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip.

**Usage note:** Most pages use hand-rolled form inputs rather than shadcn `Form`/`Input` wrappers.

### Context & Hooks

| Module | Purpose |
|--------|---------|
| `context/AuthContext.jsx` | User state, login/register/logout/refresh |
| `hooks/use-toast.js` | shadcn toast hook (Sonner used directly in pages) |
| `lib/api.js` | HTTP client |
| `lib/utils.js` | `cn()` Tailwind merge helper |
| `constants/testIds/` | Test ID constants (auth, home) |

---

## 8. Authentication

> **Update (Jul 2026):** Primary SPA auth is **Supabase Auth**. FastAPI verifies Supabase JWTs and syncs MongoDB profiles via `POST /api/auth/sync`. Roles live in Supabase `app_metadata.role` and MongoDB `users.role`.

### Flow (Supabase)

```
Register/Login / Google OAuth
    → Supabase Auth issues session (persisted by supabase-js)
    → Frontend mirrors access_token to localStorage (skl_token)
    → POST /api/auth/sync upserts MongoDB user + sets app_metadata.role
    → Protected routes use AuthContext.user (Mongo profile shape unchanged)
```

### Legacy FastAPI JWT (transitional)

```
Register/Login
    → Server creates access (1 day) + refresh (30 day) JWTs
    → Sets httpOnly cookies (secure, samesite=none)
    → Returns tokens in JSON body
    → Frontend stores in localStorage (skl_token, skl_refresh)

Authenticated requests
    → Cookie sent automatically (withCredentials)
    → Bearer header from localStorage as fallback

401 response (non-auth endpoints)
    → Axios interceptor refreshes via Supabase session (SPA) or legacy /auth/refresh
    → Retries original request with new access token
    → On refresh failure: clear localStorage, reject

Logout
    → supabase.auth.signOut() (SPA)
    → clearToken() in frontend
```

### JWT Payload

**Access token:**
```json
{ "sub": "<user_id>", "email": "...", "role": "student|client", "exp": "...", "type": "access" }
```

**Refresh token:**
```json
{ "sub": "<user_id>", "exp": "...", "type": "refresh" }
```

### Password Reset

1. `POST /auth/forgot-password` — creates TTL token (1h), logs token, returns `dev_token` in demo.
2. `POST /auth/reset-password` — validates token, updates `password_hash`, marks token used.
3. MongoDB TTL index on `password_reset_tokens.expires_at`.

### Roles

- `student` — apply, save jobs, AI match jobs
- `client` — post/manage jobs, review applicants, AI rank applicants
- No dedicated `admin` role in code (admin user seeded as `client`)

---

## 9. Database

### Engine

- **MongoDB** via Motor (`AsyncIOMotorClient`)
- Database name from `DB_NAME` env (default in local `.env`: implied `skilleraa_db`)

### Collections

#### `users`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `email` | string | Unique index |
| `password_hash` | string | bcrypt |
| `name` | string | |
| `role` | `"student"` \| `"client"` | |
| `headline`, `bio`, `location` | string | Student profile |
| `skills` | string[] | |
| `education`, `portfolio_url` | string | |
| `resume_url`, `resume_filename` | string | Points to `/api/files/{id}` |
| `company_name`, `company_website`, `company_description` | string | Client profile |
| `created_at` | datetime | UTC |

#### `jobs`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `title`, `category`, `description` | string | |
| `skills` | string[] | |
| `budget`, `duration` | string | Free-text (not numeric) |
| `experience` | enum | Beginner / Intermediate / Expert |
| `remote` | bool | |
| `location` | string | |
| `client_id` | ObjectId | FK → users |
| `company_name` | string | Denormalized |
| `status` | string | `"open"` (no close/archive API) |
| `applications_count` | int | Denormalized counter |
| `created_at` | datetime | |

**Index:** `(status, created_at DESC)`

#### `applications`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `job_id` | ObjectId | |
| `student_id` | ObjectId | |
| `cover_letter` | string | 1–2000 chars |
| `status` | enum | pending / shortlisted / hired / rejected |
| `created_at` | datetime | |

**Index:** Unique `(student_id, job_id)`

#### `saved_jobs`

| Field | Type |
|-------|------|
| `_id` | ObjectId |
| `student_id` | ObjectId |
| `job_id` | ObjectId |
| `created_at` | datetime |

**Index:** Unique `(student_id, job_id)`

#### `password_reset_tokens`

| Field | Type | Notes |
|-------|------|-------|
| `user_id` | ObjectId | |
| `token` | string | Unique |
| `used` | bool | |
| `expires_at` | datetime | TTL index (auto-delete) |
| `created_at` | datetime | |

#### `files`

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | Unique index, used in URL |
| `user_id` | ObjectId | Owner |
| `kind` | string | e.g. `"resume"` |
| `storage_path` | string | Emergent object store path |
| `original_filename` | string | |
| `content_type` | string | |
| `size` | int | |
| `is_deleted` | bool | Soft delete flag (no delete API) |
| `created_at` | datetime | |

### Missing Collections (for future features)

- `notifications` — user notification feed
- `messages` / `conversations` — client-student messaging
- `reviews` — post-hire ratings
- `payments` / `transactions` — Stripe escrow
- `email_verifications` — signup verification tokens
- `refresh_token_blacklist` — revoked refresh tokens

---

## 10. Missing APIs

### Critical for Production

| API | Method | Purpose | Frontend Need |
|-----|--------|---------|---------------|
| `/api/notifications` | GET | List user notifications | `/student/notifications`, `/client/messages` |
| `/api/notifications/{id}/read` | PUT | Mark read | Notification UI |
| `/api/notifications/read-all` | PUT | Mark all read | Notification UI |
| `/api/messages/conversations` | GET | List conversations | Messaging page |
| `/api/messages/conversations/{id}` | GET | Thread messages | Messaging page |
| `/api/messages` | POST | Send message | Messaging page |
| `/api/jobs/{id}` | PUT/PATCH | Edit job | My Jobs edit flow |
| `/api/jobs/{id}/status` | PUT | Close/archive job | Job lifecycle |
| `/api/auth/change-password` | POST | Change password while logged in | Settings |
| `/api/auth/verify-email` | POST | Email verification | Signup flow |
| `/api/auth/resend-verification` | POST | Resend verification email | Signup flow |

### Important (P2)

| API | Method | Purpose |
|-----|--------|---------|
| `/api/reviews` | POST | Submit review after hire |
| `/api/reviews/user/{id}` | GET | Public reviews on profile |
| `/api/payments/create-intent` | POST | Stripe payment intent |
| `/api/payments/webhook` | POST | Stripe webhook handler |
| `/api/upload?kind=portfolio` | POST | Portfolio file uploads |
| `/api/files/{id}` | DELETE | Remove uploaded file |
| `/api/account` | DELETE | Delete account (GDPR) |
| `/api/admin/users` | GET | Admin user management |
| `/api/admin/jobs` | GET | Admin job moderation |
| `/api/analytics/client` | GET | Client funnel metrics |

### Enhancements

| API | Purpose |
|-----|---------|
| Pagination (`?page=&limit=`) on `/jobs`, `/applications/mine`, `/applicants/all` | Scale beyond 200-item caps |
| `/jobs` budget range filter | Advanced search |
| `/jobs` multi-skill filter | Advanced search |
| WebSocket or SSE `/api/events` | Real-time notifications |
| `/api/ai/match-jobs` GET with caching headers | Reduce LLM cost |
| Health `/api/health` with DB/storage/LLM checks | Observability |

---

## 11. Missing Pages

| Page | Suggested Route | Status |
|------|-----------------|--------|
| **Messaging (client)** | `/client/messages` | Route exists; renders empty `Notifications` placeholder |
| **Messaging (student)** | — | No dedicated student messages route |
| **Notifications (functional)** | `/student/notifications` | Empty state only |
| **Job edit** | `/client/jobs/:id/edit` | No route; only create + delete |
| **Onboarding wizard** | `/student/onboarding` or `/client/onboarding` | Not implemented |
| **Email verification** | `/verify-email?token=` | Not implemented |
| **Reviews** | `/u/:id/reviews` or inline on profile | Not implemented |
| **Payments / billing** | `/client/billing`, `/student/earnings` | Not implemented |
| **Admin dashboard** | `/admin/*` | Not implemented |
| **Terms / Privacy** | `/terms`, `/privacy` | Not implemented (footer links may be missing) |
| **Help / FAQ** | `/help` | Not implemented |

### Pages Needing Backend Wiring (exist but incomplete)

| Page | Gap |
|------|-----|
| `Settings.jsx` | No password change, email change, notification prefs, or account deletion |
| `Landing.jsx` | Stale "Soon" badge on AI feature; unimplemented LinkedIn/GitHub import claims |

---

## 12. Missing Features

### From PRD Backlog (still outstanding)

| Feature | Priority | Notes |
|---------|----------|-------|
| Real-time notifications | P1 | Status change alerts for students |
| Client-student messaging | P1 | `/client/messages` is a placeholder |
| Email delivery (password reset, notifications) | P1 | Currently logs token / returns `dev_token` |
| Job editing | P1 | Clients can only create or delete |
| Job close/archive | P1 | Jobs only have `open` status; no close flow |
| Email verification on signup | P2 | |
| Ratings & reviews after hiring | P2 | |
| Stripe payments / escrow | P2 | |
| Advanced filters (budget slider, multi-skill) | P2 | Backend has `skill` param but UI doesn't expose it |
| Dark mode toggle | P2 | Tokens exist, not wired |
| Onboarding wizard | P2 | Profile completion checklist exists but no guided flow |
| Client analytics (funnel, view/apply ratios) | P2 | |
| LinkedIn / GitHub profile import | P3 | Mentioned on landing only |
| Admin moderation | P3 | Seeded admin user has no special privileges |

### Infrastructure Features

| Feature | Notes |
|---------|-------|
| CI/CD pipeline | No GitHub Actions visible |
| Staging environment | Preview URL referenced in tests |
| Error monitoring (Sentry) | Not configured |
| Structured logging | Basic Python logging only |
| Database migrations | Index creation on startup only |
| Backup strategy | Not documented |
| CDN for static assets | Vercel handles frontend |
| Redis for AI cache / sessions | In-memory cache only |

---

## 13. Technical Debt

### Backend

| Issue | Severity | Detail |
|-------|----------|--------|
| Monolithic `server.py` | Medium | ~1,240 lines; auth, jobs, AI, storage, seed combined |
| Deprecated lifecycle | Medium | `@app.on_event("startup"/"shutdown")` — migrate to `lifespan` |
| Seed on every startup | Medium | Runs `seed_data()` always; writes `test_credentials.md` |
| In-memory AI cache | Medium | `_ai_cache` dict — lost on restart, not shared on Vercel |
| No pagination | Low | Hard limits (50–500) on list endpoints |
| Budget as free text | Low | Cannot filter/sort by numeric budget |
| No job update endpoint | Medium | Forces delete-and-recreate workflow |
| Synchronous `requests` in async handlers | Low | Storage calls block event loop |
| Unused imports/deps | Low | `python-jose`, `pandas`, `numpy`, `jq`, `typer` in requirements |
| File soft-delete unused | Low | `is_deleted` field but no delete endpoint |

### Frontend

| Issue | Severity | Detail |
|-------|----------|--------|
| Unused dependencies | Low | `@tanstack/react-query`, `swr`, `recharts`, `next-themes` installed but unused |
| No global error boundary | Medium | Uncaught render errors crash app |
| Duplicate fetch patterns | Low | Each page fetches independently; no shared cache |
| Hardcoded demo credentials | Low | In `Login.jsx` source |
| Landing stale copy | Low | "AI Soon" badge contradicts implemented feature |
| CRA vs Vite | Low | CRA is maintenance mode; consider migration |
| No frontend unit tests | Medium | Only Playwright E2E referenced in test reports |
| Mobile nav shows only 5 items | Low | Settings/profile hidden on mobile bottom bar |

### DevOps & Documentation

| Issue | Severity | Detail |
|-------|----------|--------|
| Empty root `README.md` | Medium | Only placeholder text |
| `.env` files in repo | High | Local dev secrets committed (JWT, demo passwords) |
| No docker-compose | Low | Manual MongoDB setup required |
| Vercel dual-build complexity | Medium | Python cold starts + static frontend |

---

## 14. Security Issues

### Critical / High

| Issue | Location | Risk | Recommendation |
|-------|----------|------|----------------|
| **CORS wildcard with credentials** | `server.py` L1230–1237 | `allow_origins=["*"]` + `allow_credentials=True` — browsers may reject or behave unpredictably; weak origin policy | Restrict to known frontend origins in production |
| **JWT in localStorage** | `api.js`, `AuthContext` | XSS can steal tokens | Consider httpOnly-only auth; add CSP; sanitize outputs |
| **Optional file download auth** | `GET /api/files/{id}` | Any valid JWT (any user) can access any file if they know UUID | Add ACL: owner, or client with application to that student |
| **`dev_token` in API response** | `forgot-password` | Password reset token exposed in JSON — email enumeration mitigation undermined in prod if left enabled | Remove `dev_token` from response; send via email only |
| **Weak default JWT secret** | `backend/.env` | Predictable local secret | Enforce strong secrets via env validation; never commit |
| **Demo credentials in source** | `Login.jsx` | Known accounts in client bundle | Gate behind `NODE_ENV === development` or remove |
| **No rate limiting** | All auth endpoints | Brute force login, reset spam | Add slowapi or middleware limits on `/auth/*` |
| **No refresh token rotation/revocation** | `auth/refresh` | Stolen refresh token valid for 30 days | Rotate + blacklist old refresh tokens |
| **Seed admin with known password** | `seed_data()` | Privileged account in every deployment | Disable seed in production or use secure random passwords |

### Medium

| Issue | Risk | Recommendation |
|-------|------|----------------|
| No CSRF tokens | Cookie-based auth vulnerable to CSRF | SameSite=strict for same-origin deploys; CSRF token for cookie auth |
| No input sanitization for XSS in profiles | Stored XSS in bio/headline rendered in UI | Sanitize HTML; React escapes by default but verify `dangerouslySetInnerHTML` absent |
| No email verification | Fake account creation | Verify email before full access |
| Password min length 6 | Weak passwords | Enforce complexity rules |
| Stats endpoint public | Information disclosure | Rate limit or auth-gate if sensitive |
| LLM prompt injection | User profile text sent to Claude | Sanitize/limit profile fields in AI prompts |
| File upload MIME trust | Extension-based validation only | Magic-byte validation |
| MongoDB injection | Low (Motor + structured queries) | Continue parameterized queries; audit `$regex` inputs |

### Low

| Issue | Notes |
|-------|-------|
| No security headers (HSTS, CSP, X-Frame-Options) | Add via middleware or Vercel config |
| No audit logging | Auth events, status changes not logged |
| HTTPS assumed for cookies | `secure=True` on cookies — correct for prod |

---

## 15. Development Roadmap: MVP → Production

### Phase 0 — Current State (MVP ✅)

**Status: Complete**

- [x] Auth: register, login, logout, refresh, password reset (demo mode)
- [x] Student: browse, apply, save, profile, dashboard, resume upload
- [x] Client: post job, view applicants, update status, dashboard
- [x] Public: landing, job listing/detail, public profiles, about
- [x] AI: job matching (student), applicant ranking (client)
- [x] Tests: 34 backend pytest, Playwright E2E for core + P1
- [x] Deploy: Vercel config for frontend + API

---

### Phase 1 — MVP Stabilization (2–3 weeks)

**Goal:** Fix security basics, close obvious gaps, prepare for first real users.

| Task | Area | Priority |
|------|------|----------|
| Remove `dev_token` from forgot-password in production | Backend | P0 |
| Restrict CORS to production + dev origins | Backend | P0 |
| Validate `JWT_SECRET` strength at startup | Backend | P0 |
| Add rate limiting on `/auth/*` | Backend | P0 |
| Gate demo credentials behind env flag | Frontend | P1 |
| Add file download ACL (owner + authorized clients) | Backend | P1 |
| Implement `PUT /api/jobs/{id}` + job close status | Backend + Frontend | P1 |
| Add `POST /api/auth/change-password` | Backend + Settings UI | P1 |
| Split `server.py` into modules (`auth`, `jobs`, `apps`, `files`, `ai`, `seed`) | Backend | P1 |
| Migrate to FastAPI `lifespan` handlers | Backend | P2 |
| Gate `seed_data()` behind `SEED_ON_STARTUP=true` | Backend | P1 |
| Write proper `README.md` with setup instructions | Docs | P1 |
| Remove committed secrets; add `.env.example` | DevOps | P0 |

**Exit criteria:** No secrets in repo, CORS locked down, jobs editable, password changeable, seed opt-in.

---

### Phase 2 — Core Product Completion (3–4 weeks)

**Goal:** Deliver features users expect from a marketplace; replace placeholders.

| Task | Area | Priority |
|------|------|----------|
| Email service integration (SendGrid/Resend/SES) | Backend | P0 |
| Send password reset links via email | Backend | P0 |
| Notifications collection + CRUD API | Backend | P0 |
| Emit notifications on application status change | Backend | P0 |
| Wire `/student/notifications` to real data | Frontend | P0 |
| Messaging: conversations + messages API | Backend | P1 |
| Build messaging UI (replace placeholder) | Frontend | P1 |
| Email verification on signup | Backend + Frontend | P1 |
| Pagination on list endpoints | Backend | P2 |
| Move AI cache to MongoDB or Redis | Backend | P1 |
| Refresh token rotation + blacklist | Backend | P1 |
| Add health check endpoint with dependency status | Backend | P2 |
| Frontend error boundary + loading skeletons | Frontend | P2 |
| Adopt React Query for data fetching | Frontend | P2 |

**Exit criteria:** Users receive emails, see notifications on status changes, can message each other.

---

### Phase 3 — Growth Features (4–6 weeks)

**Goal:** Differentiate and improve conversion/retention.

| Task | Area | Priority |
|------|------|----------|
| Onboarding wizard (student + client) | Frontend | P1 |
| Advanced job filters (budget range, multi-skill) | Backend + Frontend | P1 |
| Client analytics dashboard (views, applies, funnel) | Backend + Frontend | P2 |
| Ratings & reviews post-hire | Backend + Frontend | P2 |
| Portfolio upload (`kind=portfolio`) | Backend + Frontend | P2 |
| Avatar upload | Backend + Frontend | P3 |
| Dark mode (wire `next-themes`) | Frontend | P3 |
| SEO: meta tags, Open Graph, sitemap | Frontend | P2 |
| LinkedIn/GitHub OAuth import (optional) | Backend + Frontend | P3 |
| Admin moderation panel | Backend + Frontend | P2 |

**Exit criteria:** Guided onboarding, richer search, reviews visible on profiles.

---

### Phase 4 — Monetization & Trust (4–6 weeks)

**Goal:** Revenue and trust infrastructure for production scale.

| Task | Area | Priority |
|------|------|----------|
| Stripe Connect integration | Backend | P0 |
| Escrow / milestone payments | Backend + Frontend | P0 |
| Payment webhooks + idempotency | Backend | P0 |
| Client billing page | Frontend | P1 |
| Student earnings page | Frontend | P1 |
| Terms of Service + Privacy Policy pages | Frontend + Legal | P0 |
| GDPR: account deletion API + data export | Backend | P1 |
| Verified client badge workflow | Backend + Admin | P2 |
| Dispute resolution flow (basic) | Backend + Frontend | P3 |

**Exit criteria:** Clients can pay through platform; legal pages live; account deletion works.

---

### Phase 5 — Production Hardening (ongoing, 2–4 weeks)

**Goal:** Operate reliably at scale.

| Task | Area | Priority |
|------|------|----------|
| CI/CD: lint, test, deploy on PR merge | DevOps | P0 |
| Staging environment mirroring production | DevOps | P0 |
| Error monitoring (Sentry) | DevOps | P0 |
| Structured logging + request tracing | Backend | P1 |
| Database backup automation | DevOps | P0 |
| Load testing (jobs list, auth, AI endpoints) | QA | P1 |
| Security audit / penetration test | Security | P1 |
| CSP, HSTS, security headers | DevOps | P1 |
| MongoDB Atlas with IP allowlist | DevOps | P0 |
| Consider dedicated backend (Railway/Fly) vs Vercel serverless for AI/storage | DevOps | P1 |
| Frontend migration CRA → Vite (optional) | Frontend | P3 |
| E2E test suite in CI | QA | P1 |

**Exit criteria:** 99.9% uptime target, monitored errors, automated backups, security headers, CI green on every PR.

---

### Phase 6 — Scale & Optimize (post-launch)

| Task | Notes |
|------|-------|
| Elasticsearch/Atlas Search for job search | Replace regex `$or` queries |
| Embedding-based AI matching | Reduce LLM cost vs full Claude calls |
| WebSocket notification push | Replace polling |
| Multi-region deployment | If user base grows internationally |
| Mobile app (React Native) | Reuse API |
| A/B testing framework | Landing conversion optimization |
| Referral program | Growth loop |

---

## Appendix A — Environment Variables

### Backend (required)

```env
MONGO_URL=mongodb://...
DB_NAME=skilleraa_db
JWT_SECRET=<strong-random-secret>
EMERGENT_LLM_KEY=<key>          # Optional: disables storage/AI if missing
APP_NAME=skilleraa
DEMO_STUDENT_EMAIL=...
DEMO_STUDENT_PASSWORD=...
DEMO_CLIENT_EMAIL=...
DEMO_CLIENT_PASSWORD=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
SEED_ON_STARTUP=false            # Recommended for production (proposed)
```

### Frontend

```env
REACT_APP_BACKEND_URL=https://api.skilleraa.com
```

---

## Appendix B — Demo Test Credentials

Auto-generated in `memory/test_credentials.md` on backend startup. Default local values:

| Role | Email | Password |
|------|-------|----------|
| Student | `student@skilleraa.com` | `Student@1234` |
| Client | `client@skilleraa.com` | `Client@1234` |
| Admin (client role) | `admin@skilleraa.com` | `Admin@1234` |

---

## Appendix C — Suggested Module Split (Backend Refactor)

```
backend/
├── main.py              # FastAPI app, lifespan, CORS, router mount
├── config.py            # Settings from env (pydantic-settings)
├── database.py          # Motor client, get_db dependency
├── models/
│   ├── auth.py
│   ├── user.py
│   ├── job.py
│   └── application.py
├── routers/
│   ├── auth.py
│   ├── profile.py
│   ├── jobs.py
│   ├── applications.py
│   ├── files.py
│   ├── ai.py
│   └── stats.py
├── services/
│   ├── auth_service.py
│   ├── storage_service.py
│   ├── ai_service.py
│   └── email_service.py
├── utils/
│   ├── security.py
│   └── serializers.py
└── seed.py              # Gated by SEED_ON_STARTUP
```

---

## Appendix D — Priority Matrix Summary

| Priority | Focus | Timeline |
|----------|-------|----------|
| **P0** | Security fixes, email delivery, secrets management | Phase 1 |
| **P1** | Notifications, messaging, job edit, backend split | Phase 1–2 |
| **P2** | Reviews, payments, analytics, onboarding | Phase 3–4 |
| **P3** | Dark mode, admin panel, CRA→Vite, OAuth import | Phase 3+ |

---

*This document reflects the codebase as analyzed in July 2026. Update it as phases complete.*
