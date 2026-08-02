# Skilleraa Repository Cleanup Report

**Role:** Release engineer  
**Date:** 2026-08-02  
**Rules:** Do not break the build · Do not remove required source · Confirmation required before any delete  

---

## SECTION A — SAFE TO DELETE

Regenerable local artifacts and orphan lockfiles. Safe for disk cleanup; none are required source.

| Path | Kind | Why safe |
|------|------|----------|
| `frontend/build/` | Generated | CRA output (~7.8 MB). Recreated by `npm run build`. |
| `frontend/node_modules/` | Dependencies cache | Recreated by `npm install` (~829 MB). |
| `frontend/node_modules/.cache/` | Build cache | Webpack/CRA cache. |
| `node_modules/` (repo root) | Orphan deps | No root `package.json`; ~4 KB leftover. |
| `backend/__pycache__/` | Python cache | Bytecode. |
| `api/__pycache__/` | Python cache | Bytecode. |
| `backend/tests/__pycache__/` | Python cache | Bytecode. |
| `backend/.pytest_cache/` | Test cache | Pytest. |
| `.vercel/` | Local deploy state | Already ignored; machine-local. |
| `package-lock.json` (repo root) | Orphan lockfile | Empty `packages: {}`, no root `package.json`. |

**Assets:** No unused image/SVG assets under `frontend/public` (only `index.html`). Nothing to delete there.

---

## SECTION B — REVIEW BEFORE DELETE

Do not auto-delete. Needs an explicit product/ops decision.

| Path | Why maybe removable | Risk |
|------|---------------------|------|
| `.emergent/` (tracked) | Emergent agent/cron scaffolding; not used by Skilleraa runtime. | Breaks Emergent-platform automation if still used. |
| `.gitconfig` (tracked) | Nested agent git identity; should not live in app repos. | Low for app; untrack + ignore preferred. |
| `test_reports/**` (`iteration_*.json`, `pytest/*.xml`) | Historical QA dumps; not imported by app. | Lose audit evidence. |
| `test_result.md` | One-off test notes. | Lose notes. |
| `AUTH_CHECKLIST.md`, `DEVELOPMENT_PLAN.md`, `TASKS.md`, `frontend/FRONTEND_AUDIT.md`, `memory/PRD.md` | Planning/audit docs superseded by launch docs (`README`, `DEPLOYMENT`, `RELEASE_CHECKLIST`, `SECURITY_AUDIT`). | Lose historical product context. |
| `design_guidelines.json` | Design prompt artifact; not loaded at runtime. | Lose design reference. |
| `tests/__init__.py` (repo root) | Empty stub; real tests are in `backend/tests/`. | Negligible. |
| `memory/test_credentials.md` | Demo passwords on disk (already gitignored). | Delete from disk after rotating if exposed. |
| `frontend/yarn.lock` **vs** `frontend/package-lock.json` | Duplicate lockfiles. `packageManager` says yarn; day-to-day uses npm. **Pick one.** | Wrong choice changes install resolution. |
| `api/emergentintegrations/` | Vendored LLM helper for AI matching. | Breaks AI job matching if `EMERGENT_LLM_KEY` is used. |
| `components.json` | shadcn config with no `src/components/ui` tree. Harmless; keep if you plan to add shadcn later. | None if deleted, but then shadcn CLI needs re-init. |
| Working-tree dead admin mocks (`AdminReports`, `AdminSettings`, `mockAdmin`) | Already deleted locally earlier; not routed in `App.js`. Confirm before commit. | None if unused (current routes). |
| `@emergentbase/visual-edits` (devDependency) | Optional CRACO visual-edit overlay for Emergent IDE. | Disables visual editing in that environment only. |

---

## SECTION C — NEVER DELETE

| Path | Why |
|------|-----|
| `frontend/src/**` (active pages, components, lib, context) | Application source |
| `frontend/package.json`, `craco.config.js`, `public/index.html`, Tailwind/PostCSS/ESLint configs | Tooling & entry |
| `backend/server.py`, `payments_razorpay.py`, `storage_uploads.py`, `requirements.txt`, `backend/tests/**` | API + tests |
| `api/index.py`, `api/requirements.txt` | Vercel Python entry |
| `supabase/migrations/**` | Schema + RLS |
| `vercel.json` | Deploy routing |
| `.env.example`, `frontend/.env.example`, `backend/.env.example` | Env templates |
| `README.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, `RELEASE_CHECKLIST.md`, `SECURITY_AUDIT.md` | Launch docs |
| `.gitignore` | Ignore rules |
| Active services: `adminService`, `jobsService`, `paymentsService`, `messagesService`, `reviewsService`, `storageService`, `profilesService`, `supabase.js` | Product integrations |

---

## SECTION D — Unused npm packages

Static import scan of `frontend/src` + config files (`craco`, `tailwind`, `eslint`). **No `src/components/ui` shadcn tree exists**, so the full Radix/shadcn starter set is unused at runtime.

### Confirmed unused (safe to uninstall after confirmation)

**Dependencies — entire Radix set (26 packages):**
- `@radix-ui/react-accordion`
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-avatar`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-label`
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-popover`
- `@radix-ui/react-progress`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-select`
- `@radix-ui/react-separator`
- `@radix-ui/react-slider`
- `@radix-ui/react-slot`
- `@radix-ui/react-switch`
- `@radix-ui/react-tabs`
- `@radix-ui/react-toast`
- `@radix-ui/react-toggle`
- `@radix-ui/react-toggle-group`
- `@radix-ui/react-tooltip`

**Dependencies — other unused libraries:**
- `@hookform/resolvers`
- `class-variance-authority`
- `clsx`
- `cmdk`
- `cra-template`
- `date-fns`
- `dayjs`
- `embla-carousel-react`
- `input-otp`
- `lodash`
- `next-themes`
- `react-day-picker`
- `react-hook-form`
- `react-resizable-panels`
- `swr` (TanStack Query is used instead)
- `tailwind-merge`
- `vaul`
- `zod`

**DevDependencies — unused:**
- `@types/lodash` (lodash unused)

### Keep (used)

| Package | Used by |
|---------|---------|
| `react`, `react-dom`, `react-scripts`, `@craco/craco` | App shell |
| `react-router-dom` | Routing |
| `@supabase/supabase-js` | Auth/data |
| `@tanstack/react-query` | `QueryClientProvider` in `index.js` |
| `axios` | `lib/api.js` |
| `framer-motion` | Motion UI |
| `lucide-react` | Icons |
| `sonner` | Toasts |
| `recharts` | Admin analytics |
| `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate` | Styling |
| `eslint` + plugins, `@eslint/js`, `globals` | Lint |
| `@babel/plugin-proposal-private-property-in-object` | CRA/CRACO |
| `dotenv` | `craco.config.js` (`require("dotenv").config()`) |
| `@emergentbase/visual-edits` | Optional — keep unless you drop Emergent visual edits (**Section B**) |

### Proposed uninstall command (after confirmation)

```bash
cd frontend
npm uninstall \
  @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio \
  @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible \
  @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu @radix-ui/react-popover @radix-ui/react-progress \
  @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot \
  @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast \
  @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip \
  @hookform/resolvers class-variance-authority clsx cmdk cra-template \
  date-fns dayjs embla-carousel-react input-otp lodash next-themes \
  react-day-picker react-hook-form react-resizable-panels swr tailwind-merge vaul zod \
  @types/lodash
```

---

## SECTION E — Improve `.gitignore`

**Already updated** in the prior cleanup pass. Current coverage includes:

- `node_modules/`, `**/build/`, `frontend/build/`
- `__pycache__/`, `*.py[cod]`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`
- `.cache/`, `**/.cache/`
- `.env` / `!.env.example`
- `.vercel`, `.emergent/`
- `/package-lock.json` (root orphan)
- `.gitconfig`
- `memory/test_credentials.md`

**Optional follow-up (needs confirmation to untrack):**

```bash
git rm -r --cached .emergent .gitconfig package-lock.json
git rm --cached test_reports/iteration_1.json test_reports/iteration_2.json \
  test_reports/pytest/*.xml
```

---

## Planned actions after confirmation

If you reply **`Approve cleanup`** (Section A + Section D):

1. Delete ONLY Section A items from disk.  
2. Run the unused-package uninstall in `frontend/`.  
3. `npm install` if lockfile requires it.  
4. `npm run lint` + `CI=true npm run build`.  
5. Verify success.  
6. Commit with:

```bash
git add .
git commit -m "chore: repository cleanup"
```

**Not included unless you also say so:** Section B items, untracking `.emergent` / test reports, removing `yarn.lock` or `visual-edits`.

---

## Confirmation

Reply with one of:

1. **`Approve cleanup`** — Section A disk wipe + Section D unused npm uninstall + build + commit as above  
2. **`Approve cleanup + untrack junk`** — also `git rm --cached` for `.emergent`, `.gitconfig`, root lockfile, test report artifacts  
3. **`Approve cleanup + also delete: …`** — name Section B items  
4. **`Do not delete`** — report only; no changes  

**Status (2026-08-02):** Cleanup executed per approval — Section A (except protected paths), unused npm uninstall, `yarn.lock` removed, `package-lock.json` kept, build verified, commit `chore: repository cleanup`.
