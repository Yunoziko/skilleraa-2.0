# Skilleraa Deployment Guide

Beta launch runbook for frontend, backend, Supabase, Razorpay, and custom domains.

---

## 1. Frontend deployment (Vercel)

This app is **Create React App (CRA) + Craco**, not Next.js. API runs on **Railway**.

### Required Vercel project settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `frontend` |
| **Framework Preset** | Create React App |
| **Install Command** | `npm install` |
| **Build Command** | `npm run build` |
| **Output Directory** | `build` |

Config file: `frontend/vercel.json` (SPA rewrites to `index.html`). There is **no** root `vercel.json` — do not deploy from repo root.

### Environment variables (Production + Preview)

| Name | Value |
|------|--------|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Anon / publishable key |
| `REACT_APP_BACKEND_URL` | `https://skilleraa-20-production.up.railway.app` (no trailing slash) |

Optional alias: `NEXT_PUBLIC_API_URL` (same Railway origin). Never put `SERVICE_ROLE` or Razorpay secrets in Vercel frontend env.

After deploy: set Railway `CORS_ORIGINS` to this exact value (no `*`):

```text
http://localhost:3000,http://127.0.0.1:3000,https://www.skilleraa.com,https://www.skilleraa.com/,https://skilleraa.com,https://skilleraa.com/,https://skilleraa-2-0.vercel.app
```

The FastAPI app always merges these hosts (with and without trailing slash) even if Railway env is stale or localhost-only. Never set `CORS_ORIGINS=*`.

### Supabase Auth URLs (Dashboard — required for Google / email links)

In [Supabase Dashboard](https://supabase.com/dashboard) → project **skilleraa** → **Authentication** → **URL Configuration**:

| Setting | Exact value |
|---------|-------------|
| **Site URL** | `https://www.skilleraa.com` |
| **Redirect URLs** (add each) | `https://www.skilleraa.com/**` |
| | `https://www.skilleraa.com/auth/callback` |
| | `https://www.skilleraa.com/reset-password` |
| | `https://skilleraa.com/**` |
| | `https://skilleraa.com/auth/callback` |
| | `https://skilleraa.com/reset-password` |
| | `https://skilleraa-2-0.vercel.app/**` |
| | `http://localhost:3000/**` |
| **Additional Allowed Origins** (CORS, if shown) | `https://www.skilleraa.com` |
| | `https://www.skilleraa.com/` |
| | `https://skilleraa.com` |
| | `https://skilleraa.com/` |
| | `http://localhost:3000` |

### Railway backend env (required for `/api/auth/sync` and protected APIs)

If `POST /api/auth/sync` returns **503** `Supabase auth is not configured on the server`, set these on the Railway service and redeploy:

| Variable | Where to get the value |
|----------|------------------------|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL (`https://ntplmmiqdmbricrcksvg.supabase.co`) |
| `SUPABASE_ANON_KEY` | Settings → API → `anon` `public` (or publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` (**secret** — server only) |
| `SUPABASE_JWT_SECRET` | Settings → API → JWT Secret (**secret** — server only) |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,https://www.skilleraa.com,https://www.skilleraa.com/,https://skilleraa.com,https://skilleraa.com/,https://skilleraa-2-0.vercel.app` |

Frontend login still works without sync (Supabase Auth is browser-side), but job APIs that verify JWTs on Railway need the JWT secret.

### Demo accounts (Supabase Auth)

| Email | Password | Role |
|-------|----------|------|
| `student@skilleraa.com` | `Student@1234` | student |
| `client@skilleraa.com` | `Client@1234` | client |

Recreate after a project restore with `scripts/seed_demo_auth_users.sql` in the Supabase SQL editor.

### Google login (Dashboard — required; cannot be enabled from this repo)

Google OAuth Client ID/Secret are **never** stored in frontend code. They belong only in Supabase.

#### A. Google Cloud Console

Create (or open) an OAuth 2.0 Client ID of type **Web application**.

**Authorized JavaScript origins** — add exactly:

```text
https://www.skilleraa.com
https://skilleraa.com
http://localhost:3000
```

**Authorized redirect URIs** — add exactly (this is the **Supabase** callback, not your app URL):

```text
https://ntplmmiqdmbricrcksvg.supabase.co/auth/v1/callback
```

Copy the **Client ID** and **Client Secret**.

#### B. Supabase Dashboard → project `skilleraa` (`ntplmmiqdmbricrcksvg`)

1. **Authentication → Providers → Google**
   - Enable Google
   - Paste **Client ID**
   - Paste **Client Secret**
   - Save

2. **Authentication → URL Configuration**
   - **Site URL:** `https://www.skilleraa.com`
   - **Redirect URLs** (add each):
     - `https://www.skilleraa.com/**`
     - `https://www.skilleraa.com/auth/callback`
     - `https://www.skilleraa.com/reset-password`
     - `https://skilleraa.com/**`
     - `https://skilleraa.com/auth/callback`
     - `https://skilleraa.com/reset-password`
     - `https://skilleraa-2-0.vercel.app/**`
     - `http://localhost:3000/**`
     - `http://localhost:3000/auth/callback`
   - **Additional Allowed Origins** (CORS — add if this field exists; do **not** use `*`):
     - `https://www.skilleraa.com`
     - `https://www.skilleraa.com/`
     - `https://skilleraa.com`
     - `https://skilleraa.com/`
     - `http://localhost:3000`

App callback path (already implemented): `https://www.skilleraa.com/auth/callback` via `signInWithOAuth({ provider: "google", options: { redirectTo } })`.

Until Google is enabled in Supabase, authorize returns: `Unsupported provider: provider is not enabled`.

### Custom domain (Hostinger DNS → Vercel)

1. Vercel → Project → **Settings → Domains** → add `skilleraa.com` and `www.skilleraa.com`.
2. At Hostinger DNS, replace parked/Hostinger A/CNAME defaults with the records Vercel shows (typically):
   - **Apex `skilleraa.com`:** A record → `76.76.21.21` (or Vercel’s current A value)
   - **`www`:** CNAME → `cname.vercel-dns.com` (or the exact CNAME Vercel displays)
3. Remove Hostinger parking / temporary page records that conflict.
4. Wait for DNS propagation; SSL is issued by Vercel automatically.

### Why `{"detail":"Not Found"}` appears

That JSON is **FastAPI**, not React. It means the Vercel project served the API (or an old Python deploy) instead of `frontend/build`. Fix: Root Directory = `frontend`, redeploy, confirm `/` returns HTML.

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
