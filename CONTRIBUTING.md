# Contributing to Skilleraa

Thanks for helping. During **beta freeze**, do not add new product features unless the Tech Lead explicitly approves. Prefer bug fixes, docs, security, and reliability.

---

## Workflow

1. Create a branch from `main`: `git checkout -b fix/short-description`
2. Keep PRs small and focused.
3. Run checks before opening a PR:

```bash
cd frontend && npm run lint && CI=true npm run build
```

4. Describe **why** the change is needed and how you tested it.
5. Do not commit `.env`, keys, dumps, or real user data.

---

## Code guidelines

- Match existing style (React function components, Tailwind utility classes, FastAPI routers).
- Prefer Supabase + RLS for product data; do not bypass RLS from the client with a service role.
- Never log access tokens, passwords, or Razorpay secrets.
- Use `ErrorState` / toasts for recoverable UI errors; rely on `ErrorBoundary` for render crashes.
- Use `frontend/src/lib/logger.js` instead of raw `console.log` in app code.
- Admin role is assigned only in the database (`profiles.role = 'admin'`), never via signup metadata.

---

## Database changes

- Add a new file under `supabase/migrations/` with a timestamp prefix.
- Migrations must be additive and safe for existing beta data when possible.
- Document any manual steps (storage buckets, Auth URL config) in the PR.

---

## Security

- Follow [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).
- If you discover a vulnerability, do not open a public issue with exploit details — contact the maintainers privately.

---

## Reviews

PRs that touch auth, payments, RLS, or storage require an extra careful review. When in doubt, ask before merging.
