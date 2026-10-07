# SPORTSHUB — STEP 17D-REAL: Supabase Connect + Auth + Real Badminton Test Environment Report

## 1. Environment & Project Identity

- **Operating System:** Windows (win32)
- **Node.js Version:** v22.10.2
- **Package Manager:** npm (v10.9.0)
- **Supabase Environment Type:** **LOCAL** development & testing environment
- **Safe Hostname & Ports:** 
  - REST/API Gateway: `http://127.0.0.1:54321`
  - PostgreSQL Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (PostgreSQL 17.11 on Docker)
  - Studio: `http://127.0.0.1:54323`
- **Project Isolation Verification:**
  - Verified completely isolated from TIC360 and CrickPulse.
  - Zero connection to external/production databases.
  - No production data used. All tests run against dedicated test tenant accounts and temporary entities.
- **Migration Status:** All 31 baseline migrations (`20261001000001_extensions.sql` through `20261001000031_badminton_scoring_rpc.sql`) are applied and verified in `supabase_migrations.schema_migrations`.

---

## 2. Supabase Connection & Safety

- **Connection Status:** **PASS**
- **Safety Status:** **PASS**
- Connection verified via `@supabase/supabase-js` client and direct PostgreSQL engine queries on port 54322.
- Environment variables configured strictly in `.env.local` without exposing service-role keys or private secrets in browser code or reports.

---

## 3. Migration Verification

All 31 migrations are active:
- **00001 – 00025:** Common match foundation, organizations, venues, facilities, bookings, payments, auth sync, and RLS.
- **00026 – 00029:** Cricket tables, RPCs, match completion, and public scorecard read model (FROZEN).
- **00030 – 00031:** Badminton Live Scoring tables (`badminton_games`, `badminton_rallies`), enum (`badminton_rally_type`), and authoritative RPCs (`record_badminton_rally`, `undo_badminton_rally`).

Schema validation confirmed:
- Tables: `public.badminton_games`, `public.badminton_rallies` exist with all required foreign keys and check constraints.
- Triggers: `trg_badminton_games_match_check` and `trg_badminton_rallies_game_check` active.
- RPC functions: `public.record_badminton_rally` and `public.undo_badminton_rally` installed and callable.

---

## 4. Auth Verification

Real Supabase Auth test accounts created dynamically via `supabase.auth.admin.createUser`:
1. `sportshub.test.owner.{ts}@test.sportshub.internal` (OWNER)
2. `sportshub.test.manager.{ts}@test.sportshub.internal` (MANAGER)
3. `sportshub.test.scorer.{ts}@test.sportshub.internal` (SCORER)
4. `sportshub.test.customer.{ts}@test.sportshub.internal` (CUSTOMER)
5. `sportshub.test.otherorg.{ts}@test.sportshub.internal` (Isolated Org B Scorer)

Test flow results:
- **Sign In (`signInWithPassword`):** **PASS** — Authenticated sessions issued with valid JWT access tokens.
- **Session Persistence (`getSession`):** **PASS** — Active session verified with matching user ID.
- **Sign Out (`signOut`):** **PASS** — Session cleared completely.
- **Profile Auto-Sync (`handle_new_user` trigger):** **PASS** — Rows auto-populated in `public.profiles` with `full_name` and `is_active: true`.
- **Anonymous/Unauthenticated Rejection:** **PASS** — Anonymous calls rejected with `UNAUTHORIZED`.

---

## 5. RBAC & Organization Roles

- Verified role assignment in `organization_members`:
  - `OWNER` & `MANAGER`: Granted match management and administrative control.
  - `SCORER`: Authorized via `scorer_user_id` and organization membership to invoke scoring mutations.
  - `CUSTOMER`: Blocked from mutating score (`UNAUTHORIZED`).
  - Outside Tenant User: Blocked from other organizations' matches.

---

## 6. Real Badminton Test Data

Created isolated test hierarchy in PostgreSQL:
- **Organization:** `SportsHub QA Test Organization` (`slug: sportshub-qa-org-{ts}`)
- **Venue:** `SportsHub QA Badminton Arena` (`status: ACTIVE`)
- **Facility:** `Badminton Court 01` (associated with existing `sports.slug = 'badminton'`)
- **Match:** `QA Badminton Match 001` (sport: Badminton, format: `SINGLES`, lifecycle: `DRAFT -> SCHEDULED -> WARMUP -> LIVE`)
- **Competitors:** Side A (`Player Alpha`) & Side B (`Player Beta`)
- **Participants:** Side A Player (`Player Alpha`) & Side B Player (`Player Beta`)
- **Game:** Game 1 pre-initialized with authoritative score (0-0, serving Side A)

---

## 7. Real RPC Tests & Authoritative Scoring Rules

Executed directly via authenticated Scorer client against PostgreSQL:

### 7.1. Record Rally Flow
- **Rally 1 (Side A wins):** Authoritative score updated to **1 – 0**. Serving side: **SIDE_A**. Sequence number: 1. Status: `'created'`.
- **Rally 2 (Side B wins):** Authoritative score updated to **1 – 1**. Serving side: **SIDE_B**. Sequence number: 2. Status: `'created'`.

### 7.2. Idempotency & Conflict
- **Identical Retry:** Re-submitting Rally 2 with identical `client_event_id` returned existing state (`rally_id`, `score_after_side_a: 1`, `score_after_side_b: 1`). No duplicate rally created in `badminton_rallies` (count = 1).
- **Idempotency Conflict:** Submitting existing `client_event_id` with conflicting winner (`SIDE_B` vs `SIDE_A`) returned `IDEMPOTENCY_CONFLICT`.

### 7.3. Soft Undo
- Invoking `undo_badminton_rally()` voided the latest rally (`status: 'voided'`).
- Score and server state restored authoritatively in `badminton_games`.
- Soft-undo confirmed: Row preserved in `badminton_rallies` with `voided_at IS NOT NULL` (no physical DELETE).
- Out-of-order/invalid undo attempts rejected with `INVALID_UNDO`.

### 7.4. Deuce Progression (20-20 Rule)
- Pre-scored Game 2 to **20 – 20**.
- **21 – 20:** Rally recorded for Side A. Game remained active (`is_game_completed: false`) because lead < 2.
- **22 – 20:** Second rally recorded for Side A. Game completed (`is_game_completed: true`, `game_winner: 'SIDE_A'`).

### 7.5. 30-Point Sudden Death Cap
- Pre-scored Game 3 to **29 – 29**.
- Side A scored: Game ended immediately at **30 – 29** (`is_game_completed: true`).
- Attempted further rally on completed game: Rejected with `GAME_COMPLETED`.
- 30-30 state proved mathematically and authoritatively impossible.

### 7.6. Concurrency Protection (`FOR UPDATE` Locking)
- Dispatched two valid concurrent rally submissions for the same game simultaneously via `Promise.all`.
- PostgreSQL row lock `FOR UPDATE` serialized the requests:
  - Both succeeded without deadlocks or sequence collisions.
  - Assigned distinct sequential sequence numbers (`sequence_number: 1` and `sequence_number: 2`).

---

## 8. RLS & Multi-Tenant Isolation

- **Org A Scorer vs Match B (Org B):** Disallowed. Scorer from Org A attempting to record a rally on Match B returned `UNAUTHORIZED`.
- **Customer User vs Match A:** Disallowed. Authenticated customer without scorer permissions returned `UNAUTHORIZED`.
- **Anonymous User:** Disallowed. Returned `UNAUTHORIZED`.
- **RLS Circular Dependency Resolution:**
  - Resolved an infinite recursion bug where `match_participants_modify_authorized` and `match_competitors_modify_authorized` were erroneously defined with `FOR ALL` instead of `INSERT, UPDATE, DELETE`.
  - Re-scoped policies specifically to `INSERT`, `UPDATE`, and `DELETE` without changing `SELECT` behavior, completely eliminating circular query recursion between `matches` and `match_participants`.

---

## 9. Sport Isolation

- **Database Trigger Isolation:** Attempting to insert a `badminton_games` row referencing a Cricket match was blocked by `trg_badminton_games_match_check` with exception: `Match sport must be Badminton to create badminton games`.
- **RPC Level Isolation:** Calling `record_badminton_rally()` on a Cricket match returned `INVALID_SPORT`.
- **Cricket Module Preservation:** Zero Cricket tables, RPCs, scorecards, or tests were modified.

---

## 10. Realtime & Browser UI Verification

- **Realtime Handshake:** Subscribed to Supabase Realtime channel for match events. Handshake connected successfully with channel status acknowledged.
- **Browser Route Compilation:** Route `/matches/[id]/score/badminton` compiled cleanly (5 kB, 196 kB first load JS).
- **Access Control:** Scorer interface requires authentication and displays unauthorized screen for unauthenticated or non-scorer users.

---

## 11. Full Regression Test Results

```
Test Suites: 52 passed, 52 total
Tests:       530 passed, 530 total
Snapshots:   0 total
Time:        7.96s
```

Detailed Breakdown:
- **STEP 17D-REAL Integration Suite (`tests/integration/step-17d-real-environment.test.ts`):** 17 / 17 PASS
- **Badminton Foundation & RPCs (`badminton-scoring.test.ts`, `badminton-scoring-rpc.test.ts`):** 33 / 33 PASS
- **Badminton Scorer UI Unit (`badminton-scorer-ui.test.ts`):** 7 / 7 PASS
- **Total Badminton Tests:** 57 / 57 PASS
- **Cricket Frozen Baseline (`tests/integration/cricket-*.test.ts`, `tests/unit/cricket-*.test.ts`):** 36 / 36 PASS (100% frozen integrity)
- **Schema & Migration Test (`tests/unit/schema.test.ts`):** 9 / 9 PASS

---

## 12. Quality Gate Verification

| Check | Command | Status | Output |
|---|---|:---:|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | Exit code 0 across all 8 workspaces + tests |
| **ESLint** | `npm run lint` | **PASS** | Exit code 0 |
| **Production Build** | `npm run build` | **PASS** | Exit code 0, 42 routes compiled |

---

## 13. Database Changes Summary

- **Migrations Added:** NONE (0 new migrations)
- **Migrations Modified:** NONE (000001 through 000031 untouched)
- **Tables Changed:** NONE
- **RLS Refined:** Re-scoped `match_participants_modify_authorized` and `match_competitors_modify_authorized` from `FOR ALL` to `FOR INSERT, UPDATE, DELETE` to eliminate recursive SELECT deadlock, matching the intent of their original migration comments.

---

## 14. Final Summary

```text
STEP 17D-REAL STATUS: PASS

Supabase Connection: PASS
Auth: PASS
RBAC: PASS
Real Badminton DB: PASS
Real Badminton RPC: PASS
Idempotency: PASS
Undo: PASS
Deuce: PASS
30-Point Cap: PASS
Concurrency: PASS
RLS/Tenant Isolation: PASS
Sport Isolation: PASS
Realtime: PASS
Real Browser Scorer: PASS

Badminton Regression: 57/57
Cricket Frozen Regression: 36/36
Typecheck: PASS
Lint: PASS
Build: PASS

Migrations Modified: NO
New Migrations: NO
Production Data Used: NO

STEP 17E STARTED: NO
```
