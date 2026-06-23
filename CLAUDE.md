# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TAURUS is a group travel-planner web app (React + Supabase, deploys to Vercel). The repo folder is `TRIP` but the product/brand is **TAURUS**.

## วิธีทำงานกับฉัน

### พื้นฐานที่ต้องรู้เกี่ยวกับฉัน
- ฉันไม่มีความรู้เรื่องโค้ดเลย อธิบายทุกอย่างเป็นภาษาคนธรรมดา (ภาษาไทย)
- ถ้าจำเป็นต้องใช้ศัพท์เทคนิค ให้อธิบายความหมายสั้น ๆ ในวงเล็บทุกครั้ง
- อย่าคิดเอาเองว่าฉันรู้อะไรอยู่แล้ว ถ้าสงสัยว่าฉันจะเข้าใจไหม ให้ถือว่าฉันไม่เข้าใจ

### ทำให้ตรงกับที่ฉันต้องการ (สำคัญที่สุด)
- ทำเฉพาะสิ่งที่ฉันขอ ห้ามเพิ่มอะไรที่ฉันไม่ได้สั่งโดยคิดไปเองว่าฉันน่าจะอยากได้
- ก่อนลงมือทำ ให้ทวนกับฉันก่อนสั้น ๆ ว่า "ที่เข้าใจคือคุณอยากได้แบบนี้ใช่ไหม" รอฉันยืนยันแล้วค่อยทำ
- ถ้าโจทย์ที่ฉันให้ไม่ชัดหรือตีความได้หลายแบบ ให้ถามก่อน อย่าเดาแล้วทำไปเลย
- ถ้าทำมาแล้วฉันบอกว่าไม่ใช่ ให้แก้เฉพาะจุดที่ฉันบอก อย่าไปรื้อส่วนอื่นที่ฉันไม่ได้พูดถึง

### ให้ข้อมูลครบ อย่าให้ฉันต้องไปเดาต่อ
- ถ้าจะให้ฉันรันคำสั่งหรือโค้ด ต้องส่งคำสั่งหรือโค้ดฉบับเต็มมาให้ฉันด้วยทุกครั้ง ห้ามบอกแค่ว่า "ให้รัน..." โดยไม่ส่งของมาให้ โดยเฉพาะงานที่ฉันต้องทำเอง (SQL migration, คำสั่ง `supabase` CLI / deploy, env var, คำสั่ง `npm`, ตั้ง cron) ให้แปะ snippet พร้อมก๊อปวางในคำตอบเดียวกัน ครบและเรียงตามลำดับ
- บอกให้ชัดว่าต้องเอาไปวาง/พิมพ์ตรงไหน และหลังทำเสร็จควรจะเห็นอะไรเกิดขึ้น
- อย่าทิ้งช่องว่างให้ฉันต้องไปหาคำตอบเองว่า "แล้วต้องทำอะไรต่อ" ให้บอกเป็นขั้นตอนจนจบ

### จังหวะการทำงาน
- ทำทีละขั้นตอน อย่าทำรวดเดียวหลายอย่างจนฉันตามไม่ทัน
- ระหว่างทำ บอกด้วยว่ากำลังทำอะไรอยู่ และทำไปทำไม
- ถ้าเป็นงานใหญ่หรือต้องแก้หลายส่วน ให้สรุปแผนเป็นข้อ ๆ ให้ฉันดูก่อน รอฉันโอเคแล้วค่อยเริ่ม

### ความปลอดภัยและการตัดสินใจ
- ก่อนจะลบ เขียนทับ หรือแก้อะไรที่ย้อนคืนยาก ให้เตือนฉันก่อนและรอฉันยืนยัน
- ถ้าฉันสั่งอะไรที่ดูเสี่ยง ผิดพลาด หรือไม่เข้าท่า ให้ทักท้วงและอธิบายเหตุผล อย่าทำตามเฉย ๆ
- ทุกครั้งที่ให้ฉันทำอะไรที่อาจมีผลกระทบ ให้บอกด้วยว่าถ้าผิดพลาดขึ้นมาจะแก้ยังไง หรือย้อนกลับได้ไหม

### เมื่อมีปัญหาหรือฉันไม่เข้าใจ
- ถ้าฉันถามซ้ำหรืองง แปลว่าคำอธิบายยังยากไป ให้อธิบายใหม่ให้ง่ายลงอีก อย่าหงุดหงิดหรือข้าม
- ถ้ามีหลายวิธีทำได้ ให้เสนอทางเลือกพร้อมบอกข้อดีข้อเสียสั้น ๆ แล้วให้ฉันเลือก อย่าตัดสินใจแทนในเรื่องสำคัญ

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
  - `supabase/notifications.sql` — `push_subscriptions` + `sent_reminders` tables + `trips.timezone`, for Web Push reminders. Reminders are sent by the `supabase/functions/send-due-reminders` Edge Function on a cron schedule; client subscription lives in `src/lib/push.ts` / `NotificationSettings`, the SW push handler in `public/push-sw.js`. Full setup in `supabase/PUSH_SETUP.md`.
  - `supabase/explore.sql` + `explore_popular.sql` — the `explore_places` community pool (public to every logged-in user; insert/update/delete gated to the creator) plus click/save popularity tracking for the "POPULAR" flag. See the Explore feature below.
  - `supabase/revoke_access.sql` — fixes incomplete access removal (deleting a `trip_invite` now also removes the accepted `trip_member`).
  - Per-feature optional columns, each independently pasteable and following the graceful-degradation pattern: `branches.sql` (multi-branch places — `branches` jsonb + `multi_branch` flag), `photos.sql` (up to 4 photos per place — `photos` array), `menu.sql` (restaurant menu files — `menu_paths`), `place_routes.sql` (multiple transit routes to a place — `routes`, mirrors the explore column).
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
- `/explore` (+ `/explore/mine`) → the Explore feature, also outside `AppShell` (it's cross-trip, not scoped to the current trip).
- Trip workspace pages render inside `AppShell` (sidebar + mobile bottom nav + top bar): `/info` (Personal Information), `/itinerary`, `/places`, `/food`, `/plans`, `/budget`.

**Explore — the one cross-trip feature.** Everything else hangs off the current trip via `TripContext`; Explore is a separate **community pool** (`explore_places`) every logged-in user can browse and contribute to (creator-only edit/delete). It has its own data layer — `exploreMutations.ts` (note its own `stripUnknown` graceful-degradation list), `exploreFilter.ts`, components `Explore*` / `pages/Explore` / `pages/ExploreManage` — and is **not** loaded by `TripContext`. Items are copied into a real trip via `SaveToTripDialog`; popularity ("POPULAR" badge) combines clicks/saves (`explore_popular.sql`) with likes/comments.

**Pages & shared building blocks** (`src/pages/`, `src/components/`):
- `Places`/`Food` both render the shared `PlaceGrid` (filter by category/city + search + card modes). `Itinerary` uses `@dnd-kit` to reorder days and stops; `MetroRoute`/`TransitEditor` render & edit the structured `transit` JSON stored on each stop.
- **Metro engine** (`src/lib/metro/`): per-city network definitions (`osaka.ts`, `hkNetwork.ts`, `shanghaiNetwork.ts`, `shenzhen*.ts`, …) are compiled by `build.ts` into a graph; `router.ts`/`computeRoute` does station-to-station pathfinding and `suggest.ts` proposes routes. `getNetworkForTrip(trip)` (in `metro/index.ts`) picks a network by matching the trip's country/cities/name keywords. The interactive SVG maps (`OsakaMetroMap`, `HKMetroMap`, `ShanghaiMetroMap`, `ShenzhenMetroMap` + matching `*MapViewer`/`MetroMapPicker`) let users pick line/station for a stop's transit.
- Editing happens in `Drawer`-based editors (Drawers **portal to `document.body`** to escape the blurred top bar's stacking context). `PopMenu` is the shared `…` menu.

**Image hosting is dual-path.** Private trip files default to the `trip-files` bucket (signed URLs). When `VITE_CLOUDINARY_CLOUD_NAME` + `VITE_CLOUDINARY_UPLOAD_PRESET` are set, photo uploads instead go straight to Cloudinary via an *unsigned* preset (`src/lib/cloudinary.ts`, `isCloudinaryConfigured`); `optimizeImageUrl()` injects `f_auto,q_auto,w_*` transforms into delivery URLs. Components store either a storage path or a full Cloudinary URL and render via `SignedImage` (which passes through absolute URLs untouched).

**Other libs of note** (`src/lib/`): `fx.ts` (daily currency rates from open.er-api.com, cached per day, per-trip currency), `maps.ts` (deep-links to native map apps on mobile), `itineraryPdf.ts` (print-to-PDF window, Thai-font friendly), `format.ts`, `placeMeta.ts` (category icon/color metadata), `confirm.ts`/`ConfirmHost` (promise-based confirm/prompt dialogs replacing `window.confirm`/`prompt`), `undo.ts` (`offerUndo` — action-toast that restores deleted rows), `concurrency.ts` (optimistic-lock update guard), `offlineQueue.ts` (IndexedDB queue: inserts/deletes are queued when offline and replayed on reconnect via `initOfflineSync`, wired in `TripContext`). `seed.ts` is legacy (the Beijing sample) and no longer imported.

**Styling:** Tailwind CSS v4 with design tokens declared via `@theme` in `src/index.css` (brand blue `#0270FB`, hairline 0.5px borders, 12px cards). Brand assets are `public/taurus-*.svg` (`TaurusMark` = icon, `TaurusLogo` = wordmark, both with SVG fallbacks). Icons: `@tabler/icons-react`.
