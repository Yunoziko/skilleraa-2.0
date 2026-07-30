# Auth activation checklist (after real Supabase keys)

Fill in the `PLACEHOLDER_*` values in `frontend/.env` and `backend/.env`, then restart both apps. **No code changes are required.**

## Env vars to replace

### Frontend (`frontend/.env`)
- [ ] `REACT_APP_SUPABASE_URL` → Project URL (`https://xxxx.supabase.co`)
- [ ] `REACT_APP_SUPABASE_ANON_KEY` → anon / publishable key

### Backend (`backend/.env`)
- [ ] `SUPABASE_URL` → same Project URL
- [ ] `SUPABASE_ANON_KEY` → same anon / publishable key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → service role key (sets `app_metadata.role`)
- [ ] `SUPABASE_JWT_SECRET` → JWT secret (Settings → API → JWT Secret)

### Supabase dashboard (one-time project config — not code)
- [ ] Enable Email provider
- [ ] Enable Google provider (if using “Continue with Google”)
- [ ] Redirect URLs include: `http://localhost:3000/auth/callback`, `http://localhost:3000/reset-password`, plus production equivalents
- [ ] Confirm email template links use Site URL / redirect allow list

---

## Features that work automatically once keys are set

### Login
- [ ] Email + password sign-in
- [ ] Blocks unverified emails and offers resend verification
- [ ] Syncs Mongo profile via `POST /api/auth/sync`
- [ ] Redirects to student or client dashboard by role
- [ ] Redirects away from `/login` if already signed in
- [ ] Continue with Google (after Google provider enabled)

### Signup
- [ ] Email + password registration with chosen role (student / client)
- [ ] Sends verification email when confirm-email is enabled
- [ ] Detects existing email and returns a clear error
- [ ] Continues straight to dashboard if confirm-email is disabled
- [ ] Continue with Google with pending role preserved across redirect
- [ ] Redirects away from `/signup` if already signed in

### Logout
- [ ] Clears Supabase session (local)
- [ ] Clears `skl_token` / `skl_refresh` and ephemeral role/verify state
- [ ] Navbar / sidebar logout returns to home
- [ ] Protected routes require login again

### Forgot password
- [ ] Sends reset email via Supabase
- [ ] Redirect lands on `/reset-password`

### Reset password
- [ ] Establishes recovery session from PKCE `code` or hash tokens
- [ ] Updates password via Supabase
- [ ] Signs out and requires a fresh login with the new password

### Email verification
- [ ] Signup stores pending email and shows verify messaging
- [ ] Confirmation link hits `/auth/callback` and creates session + Mongo profile
- [ ] Login surfaces verify error + **Resend verification email**
- [ ] Resend uses Supabase `auth.resend` → `/auth/callback`

### Protected routes
- [ ] Student routes require authenticated student role
- [ ] Client routes require authenticated client role
- [ ] Unauthenticated users redirect to `/login` with return path
- [ ] Wrong-role users redirect to their own dashboard
- [ ] Loading spinner while session/profile resolves

### Session management
- [ ] Session persisted in localStorage (Supabase client)
- [ ] Auto token refresh (`autoRefreshToken`)
- [ ] `TOKEN_REFRESHED` updates stored Bearer tokens
- [ ] API attaches Bearer token; refreshes once on 401 then retries
- [ ] Failed refresh signs out and clears local auth state
- [ ] Page reload restores session and re-syncs Mongo profile
- [ ] Backend verifies JWT with `SUPABASE_JWT_SECRET` (`/api/auth/me`, `/api/auth/sync`, protected APIs)

### OAuth / callback
- [ ] `/auth/callback` exchanges `code` for session
- [ ] Handles hash-based sessions
- [ ] Surfaces OAuth error query params
- [ ] Routes to the correct dashboard after sync

---

## Smoke test (after keys)

1. Sign up → verify email → land in dashboard  
2. Log out → log in  
3. Forgot password → reset → log in with new password  
4. Open a protected URL while logged out → redirect to login → return after login  
5. Reload while logged in → still authenticated  
6. (Optional) Google sign-in with student and client roles  

Until real keys are present, auth actions return a clear “not configured” message and the app still boots.
