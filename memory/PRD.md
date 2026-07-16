# Skilleraa — PRD

## Original Problem Statement
Design and build a modern, premium, minimal black-and-white freelancing marketplace called **Skilleraa** that connects students, freshers and beginner professionals with startups, agencies and businesses. Aesthetic inspired by Linear, Vercel and Notion. Full pages required: landing, auth, student & client dashboards, job listing + filters, job details, profile pages.

## Architecture
- **Frontend**: React 19 (CRA) + Tailwind + shadcn/ui + Framer Motion + Lucide + Sonner + React Router 7
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt
- **DB**: MongoDB (`skilleraa_db`)
- **Auth**: JWT via httpOnly cookies + `Authorization: Bearer` fallback stored in `localStorage` (`skl_token`) for browsers that block 3rd-party cookies
- **Design**: Strict pure black & white, Cabinet Grotesk (headings via `.font-display`) + Inter (body), 12–16px rounded corners, `#E5E5E5` thin borders, no gradients

## User Personas
1. **Student / Fresher / Beginner Professional** — signs up, completes profile, browses jobs, applies, saves.
2. **Client (Founder / Agency / SMB)** — creates company profile, posts jobs, reviews applicants, updates status.

## Core Requirements (Static)
- Pure B&W minimal aesthetic
- Landing with hero + dashboard mockup + trusted-by + features + how-it-works + featured jobs + stats + testimonials + footer
- Login/Signup with role selector
- Student dashboard (welcome, stats, applications, recommended jobs, profile completion)
- Client dashboard (post job, my jobs, applicants, stats)
- Job listing (search + category/experience/remote filters)
- Job details (apply flow with cover letter)
- Public profile page for students & clients
- Fully responsive, accessible, `data-testid` on all interactive elements

## Implemented (Feb 2026)
- ✅ Full-stack auth: register / login / me / logout — JWT cookies + Bearer fallback
- ✅ Roles: student & client with route protection
- ✅ Jobs CRUD, saved jobs (toggle), applications (with cover letter), application status flow
- ✅ Search & filters: category, experience, remote
- ✅ Student dashboard: stats (applied/saved/shortlisted/hired), profile completion progress
- ✅ Client dashboard: total/open jobs, applications, hired
- ✅ Post-a-Job form + My Jobs (delete)
- ✅ Applicants view with status transitions (pending → shortlisted → hired / rejected)
- ✅ Public profile page `/u/:id`
- ✅ Landing page (hero, mockup, trusted-by marquee, features grid, flow columns, featured jobs, stats, testimonials, dark CTA, footer)
- ✅ Login + Signup with demo-account one-tap
- ✅ Notifications + Settings placeholder pages
- ✅ 404 NotFound page
- ✅ Seed data: 8 jobs, 3 clients + 1 student demo user
- ✅ Testing agent: 19/19 backend pytest cases pass, all frontend Playwright flows pass

## Test Credentials
See `/app/memory/test_credentials.md`.

## Prioritized Backlog

### P1 (next iteration)
- Refresh-token endpoint & silent token renewal (currently 1-day access, then re-login)
- Password reset flow
- Real-time notifications for status changes
- Messaging between client and student
- File upload for resume / portfolio (integrate object storage)
- AI Job Matching (currently marked "Coming Soon" — use Emergent LLM key + embeddings)

### P2 (nice-to-have)
- Ratings & reviews after hiring
- Dark mode toggle (design tokens already support it)
- Payments / escrow via Stripe
- Advanced filters (budget range slider, skills multi-select)
- Email verification on signup
- Onboarding wizard for new students (drives profile completion)
- Analytics for clients (funnel by job, view/apply ratios)

### P3 (polish)
- Split backend `server.py` into modular files (auth.py, jobs.py, apps.py, seed.py)
- Migrate FastAPI lifecycle to `lifespan` handlers
- Restrict CORS `allow_origins` to production frontend origin only
- Add rate limiting on auth endpoints
- SEO metadata + sitemap

## Notes
- Auth uses httpOnly cookies AND returns access_token in JSON body → frontend stores in localStorage as Bearer fallback (samesite=none + cross-origin friendly).
- Trusted-by section uses a horizontal marquee (`.marquee` CSS animation).
- Toaster is `sonner` at top-center, styled pure black-on-white.
