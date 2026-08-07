# Skilleraa Deployment Guide

Beta launch runbook for frontend, backend, Supabase, Razorpay, and custom domains.

---

## 1. Frontend deployment (Vercel)

This app is **Create React App (CRA) + Craco**, not Next.js. There is no `NEXT_PUBLIC_*` usage. The API runs on **Railway**; Vercel only hosts the static frontend.

### Recommended settings (Root Directory = `frontend`)

1. Import GitHub repo `Yunoziko/skilleraa-2.0` in [Vercel](https://vercel.com).
2. **Root Directory:** `frontend` (required — monorepo; app lives under `frontend/`)
3. **Framework Preset:** Create React App
4. **Install Command:** `npm ci` (or leave default `npm install`)
5. **Build Command:** `CI=true npm run build`
6. **Output Directory:** `build`
7. SPA rewrites: `frontend/vercel.json` (already in repo)
8. Environment variables (Production + Preview):

| Name | Value |
|------|--------|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Anon / publishable key |
| `REACT_APP_BACKEND_URL` | `https://skilleraa-20-production.up.railway.app` (no trailing slash) |

Do **not** set `NEXT_PUBLIC_API_URL` — the frontend reads `REACT_APP_BACKEND_URL` only.

9. Deploy. Confirm: refresh on `/login`, `/student`, `/admin` does not 404.

### Reconnect if Vercel still points at an old repo/project

Vercel does not auto-switch when you rename or replace a GitHub repo. Local `.vercel` (gitignored) may still reference an old project name like `skilleraa-2.0-main`.

1. Vercel Dashboard → open the **old** project (or create a **new** project — preferred if the old one is messy).
2. **Settings → Git → Disconnect** the old repository (if connected).
3. **Add / Connect** GitHub repo: `Yunoziko/skilleraa-2.0` (authorize the Vercel GitHub App for that org/user if the repo is missing from the list).
4. **Settings → General → Root Directory** → `frontend` → Save.
5. **Settings → General**: Framework = Create React App; Install / Build / Output as above.
6. **Settings → Environment Variables**: set the three `REACT_APP_*` values for Production (and Preview if needed).
7. **Deployments → Redeploy** (or push a commit to `main`).
8. On Railway, set `CORS_ORIGINS` to include the new Vercel URL(s), e.g. `https://your-app.vercel.app`.
9. In Supabase Auth, add the Vercel origin to Site URL / Redirect URLs.

### Why detection fails

- Wrong GitHub App permissions (repo not installed for Vercel).
- Project still linked to a deleted/renamed/forked repo.
- Root Directory left empty → Vercel looks for a root `package.json` (there is none; only `frontend/package.json`).
- Old root `api/` + Python Vercel entry served FastAPI (`{"detail":"Not Found"}` on `/`). That entry is moved to `legacy/vercel-python-api/`; root `vercel.json` deploys only the CRA frontend.

---

## 2. Backend deployment

### Option A — Railway Docker (recommended for beta)

Uses `backend/Dockerfile` (not Nixpacks). Repo-root `railway.json` sets `builder: DOCKERFILE` and `dockerfilePath: backend/Dockerfile`. Leave Railway **Root Directory** empty. Do not set it to `frontend`.

1. Create a new web service from this GitHub repo.
2. Confirm settings:
   - Builder: Dockerfile
   - Dockerfile path: `backend/Dockerfile`
   - No custom build/start command required (image `CMD` runs uvicorn)
3. Set every variable from `backend/.env.example` (real values).
4. Set `CORS_ORIGINS` to your Vercel URL(s), e.g.  
   `https://skilleraa.vercel.app,https://www.yourdomain.com`
5. Health check: `GET /health` should return 200.
6. Confirm uploads: `POST /api/storage/upload` with a small PDF and Bearer token.

Local image check:

```bash
docker build -f backend/Dockerfile -t skilleraa-api .
docker run --rm -e PORT=8000 \
  -e SUPABASE_URL=... -e SUPABASE_JWT_SECRET=... -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e CORS_ORIGINS=https://your-frontend.vercel.app \
  -p 8000:8000 skilleraa-api
```

### Option B — Vercel Python (not used for beta)

Previously `api/index.py` exposed FastAPI on Vercel. That path is disabled
(`legacy/vercel-python-api/`) because Vercel’s `/api` convention served the
backend instead of the React app. Use Railway for the API.

### Hard requirements

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET` present
- Do **not** set `MONGO_URL` (MongoDB removed)
- `LOG_LEVEL=INFO` (use `DEBUG` only temporarily)

---

## 3. Supabase configuration

1. Create/select project (e.g. `skilleraa`).
2. Apply migrations in `supabase/migrations/` **in lexicographic order** (SQL editor or CLI).
3. Storage buckets: `resumes`, `portfolios` (private) — created/maintained by migrations.
4. Auth providers: Email + Google (optional).
5. Auth URL config:
   - **Site URL:** production frontend origin
   - **Redirect URLs:**  
     `https://yourdomain.com/**`  
     `https://yourdomain.com/auth/callback`  
     plus Vercel preview URLs if needed
6. Enable **leaked password protection** (Auth → Providers / Security).
7. Promote first admin:

```sql
update public.profiles
set role = 'admin'
where id = '<uuid from auth.users>';
```

8. Copy URL, anon key, service role, JWT secret into backend; anon URL/key into frontend.

---

## 4. Razorpay configuration

1. Create a Razorpay account → **Test mode** for beta.
2. API Keys → generate Test Key ID + Secret.
3. Set on backend:

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_CURRENCY=INR
```

4. Frontend loads Checkout via `https://checkout.razorpay.com/v1/checkout.js` (no secret in browser).
5. Flow: client pays accepted application → backend creates order → Checkout → `/api/payments/verify` checks signature and credits wallet.
6. Before public launch: switch to **Live** keys, retest one small payment, consider webhooks for reconciliation.

---

## 5. Custom domain setup

### Frontend (Vercel)

1. Project → Settings → Domains → add `www.yourdomain.com` / apex.
2. Add DNS records Vercel shows (A / CNAME).
3. Wait for TLS issuance.
4. Update Supabase Auth Site URL + Redirect URLs to the custom domain.
5. Update `CORS_ORIGINS` on the API to include the custom domain.
6. Redeploy frontend if `REACT_APP_*` values change.

### API

1. Attach `api.yourdomain.com` to Railway/Render/Fly (or your host).
2. TLS via the platform or Cloudflare proxy.
3. Set `REACT_APP_BACKEND_URL=https://api.yourdomain.com` and redeploy frontend.

### Checklist after DNS

- [ ] `https://www.yourdomain.com` loads landing
- [ ] Login / Google OAuth returns to `/auth/callback`
- [ ] Authenticated API calls succeed (no CORS)
- [ ] File upload + Razorpay test payment succeed

---

## 6. Post-deploy smoke test

1. Sign up student + client  
2. Client posts job → student applies → client accepts  
3. Chat message both ways  
4. Client pays (Razorpay test) → student wallet updates  
5. Mark complete → both leave reviews  
6. Admin login → overview stats + suspend a test user  

If any step fails, see [README.md](./README.md#troubleshooting) and [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).
