# Skilleraa Deployment Guide

Beta launch runbook for frontend, backend, Supabase, Razorpay, and custom domains.

---

## 1. Frontend deployment (Vercel)

### Recommended: Vercel project on `frontend/`

1. Import the Git repo in [Vercel](https://vercel.com).
2. **Root Directory:** `frontend`
3. **Framework Preset:** Create React App
4. **Build Command:** `npm run build` (or `CI=true npm run build`)
5. **Output Directory:** `build`
6. Environment variables (Production + Preview):

| Name | Value |
|------|--------|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Anon / publishable key |
| `REACT_APP_BACKEND_URL` | Public API origin, e.g. `https://api.yourdomain.com` (no trailing slash) |

7. Deploy. Confirm SPA routing: refresh on `/login`, `/student`, `/admin` should not 404 (CRA `public/index.html` fallback / Vercel rewrite).

### Monorepo `vercel.json` (optional)

Root `vercel.json` builds both `frontend` and `api/index.py`. Prefer a **dedicated API host** for beta (longer timeouts, simpler secrets) and point `REACT_APP_BACKEND_URL` at that host. If you use the root config, set all backend secrets in the same Vercel project and expect serverless cold starts / body size limits on uploads.

### SPA rewrites (if needed)

If deep links 404, add to the Vercel project:

```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

---

## 2. Backend deployment

### Option A — Railway (recommended for beta)

Repo-root config deploys the FastAPI app only (`railway.json`, `nixpacks.toml`, `Procfile`). Leave Railway **Root Directory** empty (repository root). Do not set it to `frontend`.

1. Create a new web service from this repo.
2. Build / start (from config):

```bash
pip install -r backend/requirements.txt
cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT
```

3. Set every variable from `backend/.env.example` (real values).
4. Set `CORS_ORIGINS` to your Vercel URL(s), e.g.  
   `https://skilleraa.vercel.app,https://www.yourdomain.com`
5. Attach MongoDB (Atlas recommended). Whitelist the host’s egress IPs if required.
6. Health check: `GET /health` should return 200.
7. Confirm uploads: `POST /api/storage/upload` with a small PDF and Bearer token.

### Option B — Vercel Python (`api/index.py`)

- Entry imports `backend.server:app`.
- Suitable for light traffic; watch **payload limits** for resume/portfolio uploads and **execution time** for Razorpay + Storage calls.
- Put the same secrets in Vercel Project Settings.

### Hard requirements

- `SEED_DEMO_DATA=false`
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` present
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
