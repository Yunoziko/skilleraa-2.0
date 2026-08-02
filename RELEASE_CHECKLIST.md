# Skilleraa Beta Release Checklist

Use this before inviting beta users. Check every box.

---

## A. Configuration

- [ ] `frontend` production env: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_BACKEND_URL`
- [ ] Backend production env: Mongo, Supabase (URL, anon, **service role**, **JWT secret**), Razorpay, `CORS_ORIGINS`
- [ ] `SEED_DEMO_DATA=false`
- [ ] No service role / JWT secret / Razorpay secret in frontend or client bundles
- [ ] `LOG_LEVEL=INFO`

## B. Supabase

- [ ] All `supabase/migrations/*.sql` applied in order
- [ ] Auth Site URL + redirect URLs match production frontend
- [ ] Email (and Google if used) providers configured
- [ ] Leaked password protection enabled
- [ ] Storage buckets `resumes` / `portfolios` private + policies present
- [ ] At least one admin promoted via SQL

## C. Deployments

- [ ] Frontend deployed (Vercel) and HTTPS works
- [ ] Backend deployed and reachable from the frontend origin
- [ ] Custom domain (if any) DNS + TLS verified
- [ ] CORS allows only intended origins

## D. Functional smoke

- [ ] Student signup / login / logout
- [ ] Client signup / login
- [ ] Post job → apply → accept / reject
- [ ] Chat on accepted application
- [ ] Razorpay **test** payment → wallet credit
- [ ] Mark complete → reviews both sides
- [ ] Resume / portfolio upload + client can open applicant file
- [ ] Admin overview loads; suspend user blocks mutations
- [ ] Suspended user cannot use the product after refresh

## E. Quality gates

- [ ] `cd frontend && npm run lint` passes
- [ ] `cd frontend && CI=true npm run build` passes
- [ ] No secrets in git history for this release tag
- [ ] [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) remaining risks acknowledged

## F. Ops readiness

- [ ] Who gets paged / messaged if auth or payments break
- [ ] Backup / export plan for Postgres (Supabase) and Mongo
- [ ] Beta invite list + feedback channel
- [ ] Rollback plan (previous Vercel deployment + previous API image)

---

**Sign-off**

| Role | Name | Date |
|------|------|------|
| Tech Lead | | |
| Security | | |
| Product | | |
