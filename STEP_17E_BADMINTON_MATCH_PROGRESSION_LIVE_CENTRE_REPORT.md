# SPORTSHUB — STEP 17E
## Badminton Match Progression + Match Completion + Public Live Match Centre Report

**Status:** `PASS`  
**Date:** 2026-10-06  
**Environment:** SportsHub Local Supabase (`127.0.0.1:54321` / PostgreSQL `127.0.0.1:54322`)  
**Cricket Baseline:** FROZEN (`36/36 PASS`)  
**Monorepo Test Suite:** `547/547 PASS` across 54 test files  

---

## 1. Pre-Change Audit

Before making changes, an audit of the current baseline established:
- **STEP 17B (Database Foundation):** Created `badminton_games` and `badminton_rallies` with constraints, sequences, and RLS (`20261001000030_badminton_scoring.sql`).
- **STEP 17C (Atomic Scoring RPC):** Implemented `record_badminton_rally` and `undo_badminton_rally` in `20261001000031_badminton_scoring_rpc.sql` with BWF scoring rules, deuce, 30-point cap, and server rotation.
- **STEP 17D / 17D-REAL:** Established the mobile-first court-friendly `BadmintonScorer.tsx` and validated real authentication, RLS, and scoring against local Supabase.
- **Existing Limitations Identified:**
  - `BadmintonScorer.tsx` only scored the current game and had no mechanism to transition from Game 1 to Game 2 or Game 3.
  - No atomic RPC existed to count completed games, enforce Best-of-3 victory rules, or complete the match.
  - The live match centre route `/matches/[id]/live/page.tsx` was hardcoded to redirect if `sport !== 'cricket'`.
  - No public read model existed for spectators to load game-by-game scores and recent rallies in a single round trip.

---

## 2. Implemented Features

1. **Best-of-3 Match Progression Backend:**
   - First side to win 2 games wins the match.
   - Prevents Game 3 from being created if a side wins the first two games (Scenario A: 2–0, Scenario C: 0–2).
   - Automatically initializes Game 3 if each side has won 1 game (Scenario B: 1–1 → 2–1).
   - Invariant: Only one active game per match at any time.

2. **Authoritative Match Winner & Terminal Lifecycle:**
   - Evaluates game winners strictly on the PostgreSQL backend (`FOR UPDATE` row lock on `matches`).
   - Updates `matches.status = 'COMPLETED'`, `matches.winner_side`, `matches.result_summary`, and `matches.actual_end`.
   - Authoritatively updates `match_competitors.is_winner` and `match_competitors.score_summary`.

3. **BWF Next-Game Serving Initialization:**
   - Under BWF rules, the winner of the previous game serves first in the subsequent game.
   - The new game starts with 0–0 score, `is_completed = false`, and server set to previous game's winner.

4. **Scorer UI Enhancements (`BadmintonScorer.tsx`):**
   - Displays real-time games won breakdown in a top status card (`Side A: X | Side B: Y`).
   - If multiple games exist, provides pill tabs for viewing scores of previous games.
   - Game completed banner displays winner and an explicit, guarded **`START GAME [N+1]`** button.
   - Match completed celebratory card displays final winner, result summary, game-by-game scores, and a link to the Public Live Centre.
   - Double-tap and concurrency prevention (`progressing` guard state).

5. **Public Read-Only Badminton Live Match Centre (`BadmintonLiveMatchCentre.tsx`):**
   - Spectator live centre at `/matches/[id]/live`.
   - Publicly accessible for non-draft matches without requiring login.
   - Zero mutation controls: no scoring buttons, no undo buttons, no game creation controls.
   - Displays match status, format, competitor names, current game score, serving indicator, game-by-game scorecard table, and recent rallies history.
   - Handles empty, loading, deuce, and completed match states.

6. **Supabase Realtime Synchronization:**
   - Realtime channel subscribed to `matches`, `badminton_games`, and `badminton_rallies`.
   - Automatically refreshes authoritative scorecard upon rally entry or game progression.
   - Full cleanup of channel subscriptions on component unmount.

---

## 3. Match Progression Architecture

```text
Scorer submits rally
        │
        ▼
record_badminton_rally()
        │
        ▼
Game reaches 21+ points (win by 2, max 30)
        │
        ▼
Game marked is_completed = true
        │
        ▼
progress_badminton_match(match_id)  [FOR UPDATE lock]
        │
        ├── Count completed games by side
        │
        ├── IF one side has >= 2 games won:
        │       ├── Match status -> COMPLETED
        │       ├── Persist winner_side & result_summary
        │       ├── Update match_competitors (is_winner, score_summary)
        │       └── Return status: 'match_completed' (no new game)
        │
        └── ELSE (neither side has 2 game wins):
                ├── Next game number = latest_game.game_number + 1
                ├── Next serving side = winner of previous game (BWF Rule)
                ├── Insert badminton_games (points: 0-0, is_completed: false)
                └── Return status: 'game_created' (Game 2 or Game 3)
```

---

## 4. Database Migrations Added

**File:** `supabase/migrations/20261001000032_badminton_match_progression.sql`  
*Sequential next migration number after `20261001000031_badminton_scoring_rpc.sql`.*

### Objects Added:
1. **Realtime Publication Extension:**
   - `ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;`
2. **Function:** `public.progress_badminton_match(p_match_id UUID)`
   - Language: PL/pgSQL, Security: `SECURITY INVOKER`.
   - Enforces RBAC / Tenant Isolation / Scorer Authorization.
   - Row-level locking via `SELECT ... FOR UPDATE` on `matches`.
   - Validates sport (`slug = 'badminton'`).
   - Prevents progression while current game is in progress.
   - Idempotent on terminal matches (`status = 'COMPLETED'`).
3. **Function:** `public.get_badminton_match_scorecard(p_match_id UUID)`
   - Language: PL/pgSQL, Security: `SECURITY INVOKER`.
   - Single round-trip read model returning match, competitors, game breakdown, active game, recent rallies, and match summary.
   - Fully accessible to public anon spectators for visible (`WARMUP`, `LIVE`, `PAUSED`, `COMPLETED`) matches.

---

## 5. RPCs Added or Modified

| RPC Name | Status | Purpose | Permissions |
|:---|:---|:---|:---|
| `progress_badminton_match(p_match_id UUID)` | **NEW** (Migration 32) | Best-of-3 progression, winner calculation, match completion | Super Admin, Org Owner/Manager, Match Creator, Match Scorer |
| `get_badminton_match_scorecard(p_match_id UUID)` | **NEW** (Migration 32) | Spectator read model for Live Match Centre | Public (Authenticated & Anonymous) subject to match RLS |
| `record_badminton_rally(...)` | **FROZEN** (Migration 31) | Atomic rally recording | Unchanged |
| `undo_badminton_rally(...)` | **FROZEN** (Migration 31) | Atomic rally soft-undo | Unchanged |

---

## 6. Progression Test Evidence

Automated tests in `tests/integration/badminton-progression-live.test.ts` verified real database progression:

- **Scenario A (2–0 Side A):**
  - Game 1: 21–15 (Side A) → progressed to Game 2 (serving: Side A).
  - Game 2: 21–18 (Side A) → progressed to Match Completion.
  - Total games created: 2. Game 3 was **never** created. Match status: `COMPLETED`. Result summary: `Player Alpha won 2-0 (21-15, 21-18)`.
- **Scenario B (2–1 Side B):**
  - Game 1: 21–19 (Side A) → progressed to Game 2.
  - Game 2: 18–21 (Side B) → progressed to Game 3 (serving: Side B).
  - Game 3: 19–21 (Side B) → progressed to Match Completion.
  - Total games created: 3. Match status: `COMPLETED`. Result summary: `Player Beta won 2-1 (21-19, 18-21, 19-21)`.
- **Scenario C (0–2 Side B):**
  - Game 1: 14–21 (Side B) → progressed to Game 2.
  - Game 2: 16–21 (Side B) → progressed to Match Completion.
  - Total games created: 2. Game 3 was **never** created. Winner: `SIDE_B`.

---

## 7. Concurrency & Idempotency Verification

- **Simultaneous Requests:** 4 concurrent calls to `progress_badminton_match` for the same completed game were dispatched simultaneously (`Promise.all`).
  - Result: All 4 calls completed cleanly without error.
  - Authoritative check: Exactly one Game 2 was created. Unique game numbers `[1, 2]` preserved.
- **In-Progress Guard:** Calling `progress_badminton_match` while Game 1 is active (15–12) returns `status: 'game_in_progress'` without creating Game 2.
- **Terminal Match Guard:** Calling `progress_badminton_match` after match completion returns `status: 'match_completed'` and does not create additional games.

---

## 8. Public Live Match Centre Routing

File: `apps/web/src/app/matches/[id]/live/page.tsx`
- Determines sport dynamically:
  - `cricket` → Renders existing `LiveMatchCentre` (Cricket).
  - `badminton` → Renders new `BadmintonLiveMatchCentre` (Badminton).
  - Other sports → Safely redirects to `/matches/[id]`.

---

## 9. Realtime Verification

- The Supabase publication `supabase_realtime` was updated to include `public.matches` (alongside `badminton_games` and `badminton_rallies`).
- `BadmintonLiveMatchCentre.tsx` subscribes to changes across all three tables with `filter: match_id=eq.${match.id}`.
- Handlers trigger authoritative data reload via `get_badminton_match_scorecard` rather than mutating state from partial websocket payloads.
- Channel unmount cleanup verified in unit tests.

---

## 10. RLS & Tenant Isolation Verification

- **Anonymous Public Reads:** `supabaseAnon` can successfully invoke `get_badminton_match_scorecard` to view live scores and completed results.
- **Anonymous Mutation Rejection:** Spectator anon client cannot execute `progress_badminton_match` (rejected with `UNAUTHORIZED` / `NOT_FOUND` due to row lock requirements) and direct table inserts into `badminton_games` are rejected by RLS.
- **Cross-Sport Isolation:** Attempting to progress a Cricket match using `progress_badminton_match` is strictly rejected with `INVALID_SPORT: Match is not a Badminton match`.

---

## 11. Cricket Regression Results

All Cricket suites continue to pass with zero regressions:

```text
 ✓ tests/unit/cricket-scorecard.test.ts (19 tests)
 ✓ tests/unit/cricket-match-simulation.test.ts (11 tests)
 ✓ tests/integration/cricket-scorecard.test.ts (2 tests)
 ✓ tests/integration/cricket-scoring.test.ts (2 tests)
 ✓ tests/integration/cricket-scoring-rpc.test.ts (2 tests)

Test Files: 5 passed (5)
Tests: 36 passed (36)
Result: 36/36 PASS (Cricket baseline preserved)
```

---

## 12. Full Regression Results

```text
Test Files: 54 passed (54)
Tests:      547 passed (547)
Duration:   8.04s
```

Breakdown of Badminton Suites:
- `tests/unit/badminton-live-centre.test.ts`: 7/7 PASS
- `tests/unit/badminton-scorer-ui.test.ts`: 7/7 PASS
- `tests/integration/badminton-scoring.test.ts`: 15/15 PASS
- `tests/integration/badminton-scoring-rpc.test.ts`: 18/18 PASS
- `tests/integration/step-17d-real-environment.test.ts`: 17/17 PASS
- `tests/integration/badminton-progression-live.test.ts`: 10/10 PASS
- `tests/unit/schema.test.ts` (32 migrations verified): 9/9 PASS

---

## 13. Quality Gates

| Check | Command | Result |
|:---|:---|:---|
| TypeScript Typecheck | `npm run typecheck` | **PASS** (Zero errors across all workspaces) |
| ESLint Quality Check | `npm run lint` | **PASS** (Zero errors, warnings acceptable) |
| Production Build | `npm run build` | **PASS** (Next.js 14 optimized production build) |

---

## 14. Files Changed

### Added:
1. `supabase/migrations/20261001000032_badminton_match_progression.sql`
2. `apps/web/src/components/matches/BadmintonLiveMatchCentre.tsx`
3. `tests/integration/badminton-progression-live.test.ts`
4. `tests/unit/badminton-live-centre.test.ts`
5. `STEP_17E_BADMINTON_MATCH_PROGRESSION_LIVE_CENTRE_REPORT.md`

### Modified:
1. `apps/web/src/app/matches/[id]/live/page.tsx` (Route branching for Badminton vs Cricket)
2. `apps/web/src/components/matches/BadmintonScorer.tsx` (Progression buttons, game breakdown, match complete screen)
3. `tests/unit/schema.test.ts` (Updated to verify 32 migrations)

---

## 15. Known Limitations

- Doubles rotation in live centre uses current server/receiver designations; partner-specific court position indicators are scheduled for subsequent specialized doubles enhancements.
- Badminton live video streaming / radar speed sensors are out of scope for STEP 17E.

---

## 16. Final Status

**Overall Status:** `PASS`
