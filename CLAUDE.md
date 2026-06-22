# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TAURUS is a group travel-planner web app (React + Supabase, deploys to Vercel). The repo folder is `TRIP` but the product/brand is **TAURUS**.

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # tsc -b (typecheck, emits build cache) then vite build
npm run lint       # tsc -b --noEmit  (type-check only — this IS the lint step)
npm run preview    # serve the production build
```

- **No test framework is configured** — there are no unit tests; verification is type-check + build + manual.
- Always run `npm run build` (or `npm run lint`) before committing; CI relies on a clean tsc.
- Path alias: `@/` → `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).
- Env: copy `.env.example` → `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If missing, the app renders a "not configured" notice instead of crashing (`isSupabaseConfigured` in `src/lib/supabase.ts`).

## Database & migrations (important)

Supabase is the entire backend (auth + Postgres + storage + realtime). There is **no server code** — the browser talks to Supabase directly and Row-Level Security enforces access.

- The base schema (tables + RLS + storage bucket + realtime publication) is the `planaway_schema.sql` the user ran once in Supabase. Schema changes are **not auto-applied** — they live as plain SQL in `supabase/*.sql` and must be pasted into the Supabase SQL Editor by the user:
  - `supabase/extra_columns.sql` — optional columns (avatar colors, flight class/seats, hotel/place photos, trip flag/cities/currency, stop `link_mode`) + the invite-acceptance function.
  - `supabase/sharing.sql` — the `permission` columns + `can_edit_trip()`/`can_view_full()` helpers + per-table read/write RLS policies.
  - `supabase/concurrency.sql` — optional `version` columns + a `bump_version()` trigger on stops/days/places/expenses for optimistic-locking (conflict detection on concurrent edits; see `src/lib/concurrency.ts`).
- **Graceful-degradation pattern:** because migrations are applied manually, mutation helpers send the new columns and, on a "column does not exist" error, retry without them (see `OPTIONAL_COLS` in `src/lib/tripMutations.ts`, `stripUnknown` in `placeMutations.ts`, the `link_mode` retry in `mutations.ts`). New optional columns must follow this pattern, and be typed as optional (`?`) in `src/lib/database.types.ts` (hand-written types — keep in sync with the SQL).
- Files (passports, QR, slips, hotel/place photos) live in the **private** `trip-files` bucket, served via short-lived signed URLs (`src/lib/files.ts`, `SignedImage`). Storage paths starting with `sample/` are placeholders with no real object behind them.

## Architecture

**Data flow is centralized in two contexts** (`src/contexts/`), wrapping the app in `main.tsx` → `App.tsx`:

- `AuthContext` — Supabase auth (Google OAuth + email magic link), exposes `session`/`user`.
- `TripContext` — the heart of the app. For the *current* trip it loads **everything** (trip, travelers, files, flights, hotels, itinerary days/stops, places, interests, expenses, member profiles) in one pass and exposes it plus `reload()`. It also:
  - manages multi-trip: `trips`, `currentTripId` (persisted in localStorage), `switchTrip()`.
  - resolves the current user's `myPermission` (`owner` | `edit` | `places` | `view`) and derived `canEdit`.
  - calls `accept_my_invites` RPC on load (owner-controlled sharing) and ensures a `profiles` row exists.
  - subscribes to Supabase realtime for the trip's tables and debounce-reloads on remote changes.

**Mutation pattern:** components never embed Supabase write calls directly for domain data — they call helpers in `src/lib/*Mutations.ts` (`tripMutations`, `placeMutations`, `budgetMutations`, `mutations` for itinerary), then call `reload()` from `TripContext`. There is no client cache; reads always come from `TripContext`.

**Permissions drive both UI and DB.** `canEdit`/`myPermission` from `TripContext` gate add/edit/delete affordances across pages; RLS independently blocks writes. `visibleNav(permission)` in `layout/nav.ts` hides pages for `places`-only members (they see only Places/Food/All plans and get a ⭐ "pin to my trip" copy action instead of editing).

**Routing** (`App.tsx`, react-router v7):
- `/` → `TripsDashboard` (rendered *outside* `AppShell`): grid of trip cards (open / duplicate / download itinerary PDF / edit / delete / create). New users with no trips land on the create flow (`NoTrip`).
- Trip workspace pages render inside `AppShell` (sidebar + mobile bottom nav + top bar): `/info` (Personal Information), `/itinerary`, `/places`, `/food`, `/plans`, `/budget`.

**Pages & shared building blocks** (`src/pages/`, `src/components/`):
- `Places`/`Food` both render the shared `PlaceGrid` (filter by category/city + search + card modes). `Itinerary` uses `@dnd-kit` to reorder days and stops; `MetroRoute`/`TransitEditor` render & edit the structured `transit` JSON stored on each stop.
- Editing happens in `Drawer`-based editors (Drawers **portal to `document.body`** to escape the blurred top bar's stacking context). `PopMenu` is the shared `…` menu.

**Other libs of note** (`src/lib/`): `fx.ts` (daily currency rates from open.er-api.com, cached per day, per-trip currency), `maps.ts` (deep-links to native map apps on mobile), `itineraryPdf.ts` (print-to-PDF window, Thai-font friendly), `format.ts`, `placeMeta.ts` (category icon/color metadata). `seed.ts` is legacy (the Beijing sample) and no longer imported.

**Styling:** Tailwind CSS v4 with design tokens declared via `@theme` in `src/index.css` (brand blue `#0270FB`, hairline 0.5px borders, 12px cards). Brand assets are `public/taurus-*.svg` (`TaurusMark` = icon, `TaurusLogo` = wordmark, both with SVG fallbacks). Icons: `@tabler/icons-react`.
