# Skilleraa

Student freelance marketplace MVP — students apply to client jobs, chat after acceptance, get paid via Razorpay, and leave reviews. Admins moderate users, jobs, and reviews.

**Status:** Feature-complete MVP · preparing for closed beta  
**Security notes:** See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)  
**Deploy guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md)  
**Release checklist:** See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 (CRA + CRACO), Tailwind CSS, React Router 7, TanStack Query, Supabase JS |
| Backend | FastAPI, Motor (MongoDB), PyJWT |
| Auth / DB | Supabase Auth + Postgres (RLS), profiles, jobs, applications, messages, payments, reviews |
| Payments | Razorpay (order + signature verify) |
| Storage | Supabase Storage (`resumes`, `portfolios`) |
| Legacy | MongoDB collections for some FastAPI/demo paths (Supabase is source of truth for product authz) |

---

## Folder structure

```
skilleraa-2.0-main/
├── frontend/                 # React app (Vercel static build)
│   ├── src/
│   │   ├── components/       # UI, layout, chat, ErrorBoundary
│   │   ├── context/          # AuthContext
│   │   ├── lib/              # API + Supabase services
│   │   ├── pages/            # Public, student, client, admin routes
│   │   └── index.js
│   └── package.json
├── backend/                  # FastAPI app
│   ├── server.py             # Routes, auth sync, CORS, logging
│   ├── payments_razorpay.py  # Create order / verify
│   ├── storage_uploads.py    # Resume & portfolio uploads
│   └── requirements.txt
├── api/                      # Vercel Python entry → backend.server:app
├── supabase/migrations/      # Postgres schema + RLS
├── .env.example              # All env vars (copy into frontend/ + backend/)
├── DEPLOYMENT.md
├── CONTRIBUTING.md
├── RELEASE_CHECKLIST.md
└── SECURITY_AUDIT.md
```

---

## Local setup

### Prerequisites

- Node.js 18+ and npm (or yarn)
- Python 3.11+
- MongoDB running locally (or Atlas URI)
- A Supabase project with migrations applied
- Razorpay test keys (optional for non-payment flows)

### 1. Clone and install

```bash
git clone <your-repo-url> skilleraa
cd skilleraa

# Frontend
cd frontend
cp ../.env.example .env   # then edit — keep only REACT_APP_* keys in this file
npm install

# Backend
cd ../backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env     # then edit — use backend secrets (never put service role in frontend)
```

Split env files carefully:

- `frontend/.env` → only `REACT_APP_*`
- `backend/.env` → Mongo, Supabase secrets, Razorpay, CORS, etc.

### 2. Apply Supabase migrations

In the Supabase SQL editor (or CLI), apply files in `supabase/migrations/` in filename order.  
Promote an admin only via SQL:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```

### 3. Configure Auth redirect URLs

Supabase Dashboard → Authentication → URL configuration:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`, `http://localhost:3000/auth/callback`

### 4. Run

```bash
# Terminal A — API
cd backend && source .venv/bin/activate
uvicorn server:app --reload --port 8000

# Terminal B — UI
cd frontend && npm start
```

App: [http://localhost:3000](http://localhost:3000) · API: [http://localhost:8000/api](http://localhost:8000/api)

### 5. Quality checks

```bash
cd frontend && npm run lint && CI=true npm run build
```

---

## Environment variables

See root [`.env.example`](./.env.example) for the full list.

**Frontend (public):**

| Variable | Purpose |
|----------|---------|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Publishable / anon key |
| `REACT_APP_BACKEND_URL` | FastAPI origin (e.g. `http://localhost:8000`) |

**Backend (secret):**

| Variable | Purpose |
|----------|---------|
| `MONGO_URL`, `DB_NAME` | Mongo connection |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; bypasses RLS |
| `SUPABASE_JWT_SECRET` | Verify access tokens |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_CURRENCY` | Payments |
| `SEED_DEMO_DATA` | `false` in beta/prod |
| `LOG_LEVEL` | `INFO` (default), `DEBUG`, `WARNING` |
| `EMERGENT_LLM_KEY` | Optional AI matching / legacy object storage |

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, or `RAZORPAY_KEY_SECRET` to the browser.

---

## Deployment

Step-by-step instructions for Vercel (frontend), backend hosting, Supabase, Razorpay, and custom domains are in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| “Supabase is not configured” | Missing/placeholder frontend env | Set real `REACT_APP_SUPABASE_*` and restart CRA |
| 401 on API after login | JWT secret mismatch or no sync | Match `SUPABASE_JWT_SECRET`; call auth sync path |
| CORS errors | Origin not allowlisted | Add UI origin to `CORS_ORIGINS` |
| Payments 503 | Missing Razorpay keys | Set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` |
| Upload 503 | Missing service role | Set `SUPABASE_SERVICE_ROLE_KEY` on backend |
| RLS / permission denied | Migrations not applied | Re-run `supabase/migrations` in order |
| Admin route redirects away | Profile role not `admin` | SQL promote + re-login |
| Blank page after crash | — | Error boundary shows recovery UI; check browser console in dev |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Do not add new product features during beta freeze unless agreed by the Tech Lead.

---

## License

Proprietary — All rights reserved unless otherwise stated by the Skilleraa owners.
