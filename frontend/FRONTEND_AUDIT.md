# Skilleraa Frontend Audit Report

**Date:** 2026-07-30  
**Scope:** Frontend polish only (no Auth / Supabase / Backend / Payments / `.env` changes)  
**Status:** Feature development frozen — audit + polish pass complete

---

## Summary

| Area | Result |
|------|--------|
| Broken routes | **0** found |
| Nav link targets | All resolve to declared routes |
| Critical bugs fixed | Client/Student dashboard loading races; Jobs clear-filters no-op; offline shell role inference |
| Dead code removed | Unused shadcn `ui/` tree, `ResumeUpload`, `testIds`, `use-toast`, `lib/utils.js` |
| Shared UI | `uiClasses.js`, `StatCard`, `ErrorState`, `DemoBanner`; `EmptyState` extended |

---

## 1. Broken routes

| Issue | Status |
|-------|--------|
| Link/NavLink/`navigate` targets with no matching `App.js` Route | **None found** — Fixed N/A |
| Shell nav items vs routes (student / client / admin) | **All match** — Fixed N/A |

---

## 2. Duplicate components

| Issue | Status |
|-------|--------|
| Local `StatCard` duplicated in Student + Client dashboards | **Fixed** — shared `components/StatCard.jsx` |
| Near-duplicate `DashboardShell` vs `AdminShell` | **Noted / deferred** — same layout pattern; merge postponed to avoid risky refactor mid-freeze |
| Near-duplicate StudentProjects / ClientOrders list UIs | **Noted / deferred** — behavior differs by role actions |
| Unused shadcn `components/ui/*` (~46 files) vs real Tailwind UI | **Fixed** — removed unused tree |
| Duplicate skeleton (`ui/skeleton` vs `Skeleton.jsx`) | **Fixed** — unused `ui` skeleton removed |

---

## 3. Dead code

| Item | Status |
|------|--------|
| `src/components/ui/**` | **Removed** |
| `src/components/ResumeUpload.jsx` (never imported) | **Removed** |
| `src/constants/testIds/**` (never imported) | **Removed** |
| `src/hooks/use-toast.js` | **Removed** |
| `src/lib/utils.js` (`cn` only used by deleted ui) | **Removed** |
| Unused mock lib exports (`listMockApplications`, etc.) | **Noted / deferred** — low risk; left for future API wiring |

---

## 4. Responsive issues

| Issue | Status |
|-------|--------|
| Dashboard content padding inconsistent (`px-5` vs `px-6`) | **Fixed** — shells use `px-5 sm:px-6 lg:px-10`; Jobs uses shared `pageContainer` |
| Mobile bottom nav cramped labels | **Fixed** — overflow-x + slightly wider label max-width |
| Job filter dividers overflow on small screens | **Fixed** — dividers hidden on xs; Level label wraps |
| Admin mobile nav omits Settings (slice 0–5) | **Noted** — Settings still in desktop sidebar; same pattern as student/client |

---

## 5. Loading states

| Issue | Status |
|-------|--------|
| `ClientDashboard` set `loading=false` before fetches finished | **Fixed** — `Promise.allSettled` |
| `StudentDashboard` loading ended after jobs only | **Fixed** — waits for dash + apps + saved + recommended |
| `AdminSettings` used ad-hoc pulse block | **Fixed** — `ListRowSkeleton` |
| Most list pages already used skeletons | **Verified OK** |

---

## 6. Empty states

| Issue | Status |
|-------|--------|
| Student dashboard “Recent Applications” plain text empty | **Fixed** — `EmptyState` compact |
| Jobs “Clear filters” linked to `/jobs` (no-op when already there) | **Fixed** — `onCtaClick` resets filters + refetch |
| `EmptyState` only supported `ctaTo` | **Fixed** — supports `onCtaClick` + `compact` |
| NotificationBell empty was ad-hoc text | **Noted** — acceptable in dropdown; full page uses `EmptyState` |

---

## 7. Error states

| Issue | Status |
|-------|--------|
| Jobs API failure silently swapped to mock with no UI signal | **Fixed** — `DemoBanner` when using demo jobs |
| No shared error panel component | **Fixed** — added `ErrorState.jsx` (ready for pages that need retry UI) |
| API failures elsewhere toast / silent mock by design | **Noted** — intentional while backend paused |

---

## 8. Accessibility

| Issue | Status |
|-------|--------|
| Buttons missing `type="button"` (submit risk) | **Fixed** — Navbar, JobCard, JobDetail, Applicants, MyJobs, AiMatches, DashboardMockup, shells |
| Jobs search input unlabeled | **Fixed** — `sr-only` label + `htmlFor` |
| Messages search unlabeled | **Fixed** — `aria-label` |
| Applicants AI job `<select>` unlabeled | **Fixed** — `aria-label` |
| Filter chips lack pressed state | **Fixed** on Jobs — `aria-pressed` |
| NotificationBell expanded/unread announcement | **Fixed** — `aria-expanded`, dynamic `aria-label` |
| Footer social links all `aria-label="social"` | **Fixed** — GitHub / Twitter / LinkedIn labels |
| Many form fields still lack `htmlFor`/`id` pairs (Login, PostJob, profile editors) | **Partial / noted** — high-traffic search fixed; full form pass deferred (no auth rewrite) |

---

## 9. Performance

| Issue | Status |
|-------|--------|
| Dashboard loading races causing empty flash | **Fixed** (see §5) |
| Nested Framer Motion wrappers on dashboards | **Noted** — low impact at demo scale |
| `MyJobs` double review lookup per row | **Noted / deferred** |
| List keys generally correct | **Verified OK** |

---

## 10. Spacing / typography / cards / buttons

| Issue | Status |
|-------|--------|
| No shared button/chip/card tokens | **Fixed** — `lib/uiClasses.js` (`btnPrimary`, `btnGhost`, `chipClass`, `card`, `pageContainer`) |
| Jobs chips now use shared `chipClass` | **Fixed** |
| Admin report status chips used `bg-neutral-900` vs `bg-black` | **Fixed** — standardized to black |
| Client dashboard CTAs use shared button classes | **Fixed** |
| Stat cards unified | **Fixed** |

---

## 11. Navigation links

| Issue | Status |
|-------|--------|
| All primary nav / CTA targets valid | **Verified** |
| Offline `/client/*` showed **student** sidebar (role from auth only) | **Fixed** — `DashboardShell` infers role from pathname when auth paused |
| Mock notifications mixed student + client hrefs | **Fixed** — `audience` field + role-filtered lists (v2 seed) |
| Admin had no entry from marketing chrome | **Fixed** — Footer “Admin (demo)” → `/admin` |
| Footer Privacy/Terms pointed at `/about` (misleading) | **Fixed** — shown as “Coming soon” placeholders; Contact → `/about` |
| Student dashboard “Edit” → profile view not edit | **Fixed** → `/student/profile/edit` |

---

## 12. Page render verification

Routes checked against `App.js` and shell entry points (offline-safe):

| Area | Routes | Renders |
|------|--------|---------|
| Public | `/`, `/jobs`, `/jobs/:id`, `/about`, `/login`, `/signup`, `/u/:id` | OK |
| Student | `/student`, applied, saved, projects, reviews, messages, notifications, profile, settings | OK |
| Client | `/client`, post, jobs, orders, applicants, reviews, messages, notifications, profile, settings | OK |
| Shared | `/projects/:id` | OK |
| Admin | `/admin`, users, jobs, reports, analytics, settings | OK |
| Catch-all | `*` → NotFound | OK |

Auth pages left structurally untouched (paused).

---

## Files touched (polish)

### Added
- `frontend/src/lib/uiClasses.js`
- `frontend/src/components/StatCard.jsx`
- `frontend/src/components/ErrorState.jsx`
- `frontend/src/components/DemoBanner.jsx`
- `frontend/FRONTEND_AUDIT.md` (this report)

### Updated (selected)
- `EmptyState.jsx`, `DashboardShell.jsx`, `AdminShell` consumers via pages, `Navbar.jsx`, `Footer.jsx`, `NotificationBell.jsx`, `JobCard.jsx`
- `mockNotifications.js` (audience + versioned reseeding)
- `Jobs.jsx`, `StudentDashboard.jsx`, `ClientDashboard.jsx`, `Notifications.jsx`, `Messages.jsx`
- `Applicants.jsx`, `AdminReports.jsx`, `AdminSettings.jsx`, plus `type="button"` fixes on several action pages

### Removed
- `frontend/src/components/ui/**`
- `frontend/src/components/ResumeUpload.jsx`
- `frontend/src/constants/testIds/**`
- `frontend/src/hooks/use-toast.js`
- `frontend/src/lib/utils.js`

### Explicitly not touched
- Auth context / login-signup flows beyond incidental `type="button"` where scripts hit shared chrome
- Supabase client / `.env`
- Backend
- Payments

---

## Remaining backlog (not fixed this pass)

1. Merge `AdminShell` into a parameterized `DashboardShell`.
2. Shared project/order list-row component.
3. Full `htmlFor`/`id` pass on auth + profile forms (when auth unpauses).
4. Wire `ErrorState` retry UI on more API-backed pages.
5. Trim unused mock export names.
6. Mobile admin bottom nav: include Settings or overflow menu.

---

## How to spot-check

1. `/jobs` — filter, empty clear CTA, demo banner if API down  
2. `/student` and `/client` — skeletons hold until data settles; correct sidebars offline  
3. Notifications — student vs client see role-appropriate items  
4. Footer → Admin (demo) → `/admin`  
5. Confirm build: `cd frontend && npm run build`
