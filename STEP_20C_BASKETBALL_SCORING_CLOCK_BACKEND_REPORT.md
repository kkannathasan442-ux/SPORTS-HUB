# SPORTSHUB STEP 20C — Atomic Basketball Scoring & Server-Authoritative Game Clock Backend Report

**Date:** 2026-10-07  
**Branch:** `main`  
**Migration File:** `supabase/migrations/20261001000034_basketball_scoring_clock_rpc.sql`  
**Status:** **PASS**  
**Environment:** Dedicated Local SportsHub Environment (`http://127.0.0.1:54321`, PostgreSQL `127.0.0.1:54322`, Container `supabase_db_SPORTS_HUB`)  
**Auditor:** Antigravity Pair Programmer  

---

## 1. Executive Summary

This report documents the implementation and complete verification of the server-authoritative **Basketball Gameplay Engine Backend** for SportsHub in accordance with the frozen specifications established in STEP 20A and the database schema foundation established in STEP 20B.

All authoritative basketball gameplay mutations—atomic scoring, game-clock ticking, foul accumulation, bonus calculation, foul-out disqualification, player substitutions, timeouts, period progression, overtime branching, single-action soft undo, and match completion—are executed exclusively inside PostgreSQL stored functions (RPCs). The client is purely an action dispatcher; no client timer or client score is ever authoritative.

### Key Verification Metrics
| Verification Dimension | Target | Result | Status |
| :--- | :--- | :--- | :--- |
| **New Migration** | `20261001000034` | Applied and synced locally (`npx supabase migration list --local`) | **PASS** |
| **RPCs Implemented** | 8 required + 2 helpers | 10 functions in PostgreSQL catalog | **PASS** |
| **Row-Level Locking** | `FOR UPDATE OF m` | Match-serialized concurrency protection verified | **PASS** |
| **Idempotency** | `(match_id, client_event_id)` | Zero duplicate events / scores on concurrent or retried submissions | **PASS** |
| **Clock Formula** | Server-authoritative anchor | Real-time elapsed time calculated and recovered accurately | **PASS** |
| **5-Player Invariant** | Exactly 5 on-court | Dead-ball substitutions enforce 5 active players per side | **PASS** |
| **Foul-Out & Bonus** | Limit 5 (or configured) | Disqualifies player, removes from court, sets team BONUS $\ge 5$ | **PASS** |
| **Soft Undo** | Latest active event | Sets `voided_at`, restores projections without hard deletes | **PASS** |
| **Period & OT** | Q1..Q4 + OT1..OTN | Resets team fouls, cumulative score, OT on tie, DRAW support | **PASS** |
| **Cross-Sport Defense** | Reject non-Basketball | Cricket / Badminton rejected with `INVALID_SPORT` | **PASS** |
| **Integration Test Suite** | Dedicated 20C suite | **25 / 25 tests passed** (`basketball-scoring-clock-rpc.test.ts`) | **PASS** |
| **20B Foundation Suite** | Dedicated 20B suite | **7 / 7 tests passed** (`basketball-database-foundation.test.ts`) | **PASS** |
| **Cricket Regression** | 36 / 36 tests | **36 / 36 tests passed** (0 Cricket files touched) | **PASS** |
| **Badminton Regression** | 57 / 57 tests | **57 / 57 tests passed** (0 Badminton files touched) | **PASS** |
| **Full Monorepo Suite** | 56 test files | **579 / 579 tests passed** | **PASS** |
| **TypeScript Typecheck** | 0 errors | **0 errors** across all workspaces and tests | **PASS** |
| **ESLint** | 0 errors | **0 errors** across all workspaces | **PASS** |
| **Overall STEP 20C Status** | Backend Complete | **PASS** | **PASS** |

---

## 2. STEP 20A/20B Specification Verification

The backend implementation faithfully conforms to every frozen decision from `STEP_20A_BASKETBALL_PRODUCT_DECISIONS_SPEC.md` and schema definitions from `20261001000033_basketball_database_foundation.sql`:
- **Format:** 5v5 TEAM format enforced. Rosters must have 5–15 participants per team, and exactly 5 starting active players per team are placed on court.
- **Periods:** Regulation quarters Q1 through Q4 with configurable quarter duration (default 600s). Overtime duration default 300s.
- **Scoring Breakdown:** Server determines point values (`FREE_THROW_1PT` = 1, `FIELD_GOAL_2PT` = 2, `FIELD_GOAL_3PT` = 3). Rejects arbitrary point values.
- **Clock Authority:** Database maintains `time_remaining_seconds`, `clock_status`, and `clock_last_started_at`.
- **Fouls:** Personal fouls increment player projection and persist across the match. Period team fouls reset at each period transition. Bonus activated when team fouls $\ge 5$. Disqualification at 5 (or configured limit) personal fouls.
- **Substitutions:** Dead-ball interval required (`clock_status = 'STOPPED'`). Outgoing active player swapped with incoming bench player. Exactly 5 active players remain on court. Fouled-out players cannot enter.
- **Timeouts:** 4 timeouts allocated per team in regulation, 1 per overtime period. Calling timeout pauses the clock automatically.
- **Undo Policy:** Option A implemented. Undoes the latest active event only, voids the event (`voided_at = NOW()`), and atomically reverses points, fouls, foul-out status, substitutions, or timeouts.
- **Phase 2 Scope Boundaries Maintained:** Shot clocks (24s/14s), 3x3 half-court branching, missed shots, rebounds, assists, steals, blocks, turnovers, and minutes played remain strictly out of scope. No UI code was introduced.

---

## 3. Migration

- **Filename:** `supabase/migrations/20261001000034_basketball_scoring_clock_rpc.sql`
- **Timestamp / Sequence:** `20261001000034` (Sequential follow-up to `20261001000033_basketball_database_foundation.sql`)
- **Local Application Evidence:**
  - Applied directly to local Docker container `supabase_db_SPORTS_HUB`.
  - Recorded in `supabase_migrations.schema_migrations`.
  - Verified via `npx supabase migration list --local`:
    ```json
    {"local":"20261001000034","remote":"20261001000034","time":"2026-10-01 00:00:34"}
    ```

---

## 4. RPC Inventory

### 1. `init_basketball_match`
- **Purpose:** Prepares a Basketball match for live scoring. Validates TEAM format, 5–15 rosters, registers 5 on-court starters per side in `basketball_lineups`, creates Q1 period with configured duration, initializes game clock in `STOPPED` state, and transitions match lifecycle `DRAFT -> SCHEDULED -> LIVE`.
- **Authorization:** `SECURITY DEFINER SET search_path = public, pg_temp`. Permitted for Super Admin, Organization Owner/Manager, Match Creator, or Assigned Scorer. Anonymous callers rejected with `UNAUTHENTICATED`.
- **Locking:** `SELECT m.* FROM public.matches m ... FOR UPDATE OF m`.
- **Idempotency:** Re-running against an already initialized match returns the existing initial state.
- **Transaction:** Single atomic transaction.
- **Return Result:** JSONB containing `match_id`, `period_id`, `period_number: 1`, `duration_seconds`, `time_remaining_seconds`, `clock_status: 'STOPPED'`, and starter IDs.

### 2. `record_basketball_score`
- **Purpose:** Records 1pt (`FREE_THROW_1PT`), 2pt (`FIELD_GOAL_2PT`), or 3pt (`FIELD_GOAL_3PT`) scoring events.
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row (`FOR UPDATE OF m`), period row (`FOR UPDATE`), and player lineup row (`FOR UPDATE`).
- **Idempotency:** Checks `(match_id, client_event_id)` unique key. Replays return existing event and score snapshot without duplicating points.
- **Validation:** Verifies match is `LIVE`, player belongs to scoring team, player is `is_on_court = true`, and player is `is_fouled_out = false`.
- **Transaction:** Atomically appends event to `basketball_events`, increments `side_a_score` or `side_b_score` in `basketball_periods`, and increments `points_projection` in `basketball_lineups`.
- **Return Result:** JSONB with `event_id`, `sequence_number`, `points`, `period_score_side_a`, `period_score_side_b`, `total_score_side_a`, `total_score_side_b`, `game_clock_seconds`.

### 3. `record_basketball_foul`
- **Purpose:** Records personal, technical, flagrant, or offensive fouls. Stops game clock on whistle.
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row, period row, and player lineup row.
- **Idempotency:** Replays return existing foul and projection state.
- **Validation:** Player must belong to team, cannot be already fouled out, and must be on-court for personal/offensive fouls.
- **Transaction:** Atomically appends event, increments player personal fouls, increments period team fouls, stops clock, evaluates team BONUS ($\ge 5$), and evaluates FOUL-OUT. On foul-out, marks `is_fouled_out = true` and `is_on_court = false`.
- **Return Result:** JSONB with `event_id`, `sequence_number`, `foul_type`, `personal_fouls`, `team_fouls`, `is_fouled_out`, `is_bonus`, `game_clock_seconds`.

### 4. `update_basketball_clock`
- **Purpose:** Controls `START`, `PAUSE`, and `SET_TIME` clock operations.
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row and period row.
- **Idempotency:** Supported via client event tracking for clock events.
- **Transaction:** Updates `clock_status`, `time_remaining_seconds`, and `clock_last_started_at`.
- **Return Result:** JSONB with `period_id`, `action`, `clock_status`, `time_remaining_seconds`, `clock_last_started_at`.

### 5. `substitute_basketball_player`
- **Purpose:** Swaps an on-court active player with an eligible bench player during dead balls.
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row, period row, and both outgoing and incoming lineup rows.
- **Idempotency:** Deduplicates retries via `client_event_id`.
- **Validation:** Clock must be `STOPPED`. Incoming player must belong to same team, cannot be fouled out, and cannot already be on court. Outgoing player must be on court (or just fouled out). Verifies that exactly 5 on-court players remain.
- **Transaction:** Atomically swaps `is_on_court`, checks 5-player invariant, and logs `SUBSTITUTION` event.
- **Return Result:** JSONB with `event_id`, `outgoing_participant_id`, `incoming_participant_id`.

### 6. `record_basketball_timeout`
- **Purpose:** Calls timeout for Side A or Side B, deducting from allocation (4 regulation, 1 OT).
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row and period row.
- **Idempotency:** Deduplicates retries via `client_event_id`.
- **Validation:** Verifies timeout balance $> 0$. Rejects with `TIMEOUT_EXHAUSTED` when depleted.
- **Transaction:** Automatically pauses clock to `STOPPED` and logs `TIMEOUT` event.
- **Return Result:** JSONB with `remaining_timeouts`, `game_clock_seconds`.

### 7. `undo_basketball_event`
- **Purpose:** Reverses the latest active event in the match.
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row, event row, and period row.
- **Idempotency:** Voided events cannot be re-undone. Only the most recent unvoided event can be undone.
- **Transaction:** Sets `voided_at = NOW()`. Reverses points, fouls, foul-out disqualification, substitutions, or timeouts atomically.
- **Return Result:** JSONB with `status: 'undone'`, `undone_event_id`, `event_type`.

### 8. `progress_basketball_period`
- **Purpose:** Advances match through Q1 $\to$ Q2 $\to$ Q3 $\to$ Q4 $\to$ OT1 $\to$ OT2...
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row and active period row.
- **Validation:** Cannot progress while game clock is actively running.
- **Transaction:** Marks current period completed (`clock_status = 'EXPIRED'`). If before Q4, creates next quarter with 0 team fouls. At end of Q4/OT, if scores differ, finalizes match (`COMPLETED`). If tied and overtime enabled, creates next OT period (300s). If tied and overtime disabled, finalizes as `DRAW`.
- **Return Result:** JSONB with `status` (`'period_progressed'`, `'overtime_created'`, or `'match_completed'`), `period_number`, `winner_side`.

### 9. `complete_basketball_match`
- **Purpose:** Administrative / final match completion from authoritative score.
- **Authorization:** Authorized scorer / manager.
- **Locking:** Locks match row and active period row.
- **Validation:** Clock cannot be actively running. If tied and OT enabled, rejects with `TIED_SCORE`.
- **Transaction:** Marks open period completed, updates `matches.status = 'COMPLETED'`, sets `winner_side` (`SIDE_A`, `SIDE_B`, or `DRAW`), and writes `result_summary`.
- **Return Result:** JSONB with `match_id`, `winner_side`, `result_summary`.

### 10. `get_basketball_match_state` (Helper)
- **Purpose:** Comprehensive read-only snapshot for scorers, tests, and future UI recovery. Returns match status, active period, running clock, all periods breakdown, lineups with point/foul projections, and timeouts remaining.

---

## 5. Server-Authoritative Clock

### Clock Operations
1. **`START`:**
   - Validates clock is currently `STOPPED` and `time_remaining_seconds > 0`.
   - Sets `clock_status = 'RUNNING'` and anchors `clock_last_started_at = NOW()`.
   - Does not touch stored seconds on every tick.
2. **`PAUSE`:**
   - Calculates elapsed seconds: $\Delta t = \lfloor(T_{\text{server}} - \text{clock\_last\_started\_at})\rfloor$.
   - Computes: $\text{Remaining} = \max(0, \text{time\_remaining\_seconds} - \Delta t)$.
   - Updates `time_remaining_seconds = Remaining`, `clock_last_started_at = NULL`.
   - Sets `clock_status = 'EXPIRED'` if remaining is 0, otherwise `'STOPPED'`.
3. **`SET_TIME`:**
   - Validates $0 \le \text{seconds} \le \text{duration\_seconds}$.
   - Re-anchors `clock_last_started_at = NOW()` if running; resets to `STOPPED` if paused.
4. **`EXPIRY`:**
   - Clock expires when remaining seconds reach 0.
   - Prevents restarting an expired clock.
5. **Recovery Formula (`calc_basketball_current_clock`):**
   ```sql
   CASE 
     WHEN clock_status = 'RUNNING' AND clock_last_started_at IS NOT NULL THEN
       GREATEST(0, time_remaining_seconds - FLOOR(EXTRACT(EPOCH FROM (NOW() - clock_last_started_at)))::INTEGER)
     ELSE
       time_remaining_seconds
   END
   ```
   Ensures instantaneous client reconnection recovery without polling drift.

---

## 6. Scoring

- Only 3 scoring types are accepted: `FREE_THROW_1PT`, `FIELD_GOAL_2PT`, `FIELD_GOAL_3PT`.
- Points are derived server-side (1, 2, 3). Caller-supplied point numbers are ignored and rejected.
- Player eligibility:
  - Participant must belong to scoring competitor.
  - Participant must be currently active on court (`is_on_court = true`).
  - Participant must not be fouled out (`is_fouled_out = false`).
- Projections updated atomically:
  - `basketball_periods.side_a_score` / `side_b_score`
  - `basketball_lineups.points_projection`
- Full check constraint consistency guaranteed by `chk_basketball_events_scoring_integrity`.

---

## 7. Fouls

- Supported foul types: `PERSONAL`, `TECHNICAL`, `FLAGRANT`, `OFFENSIVE`.
- Whistle stops the game clock automatically upon foul recording.
- Personal fouls accumulate across all periods on `basketball_lineups.fouls_projection`.
- Team fouls accumulate during the active period on `basketball_periods.side_a_fouls` / `side_b_fouls`.
- **Bonus Trigger:** When period team fouls reach $\ge 5$, `is_bonus = true` is returned.
- **Foul-Out Disqualification:** When personal fouls reach $\ge 5$ (or configured limit):
  - Sets `is_fouled_out = true`.
  - Sets `is_on_court = false` (player leaves court).
  - Subsequent foul or scoring attempts by this player are rejected.
  - Player cannot re-enter via substitution.

---

## 8. Substitutions

- Enforces dead-ball requirement: rejected if `clock_status = 'RUNNING'`.
- Swaps `is_on_court = false` for outgoing player and `is_on_court = true` for incoming player.
- **5-Player Invariant:** Verified immediately after swap via:
  ```sql
  SELECT COUNT(*) FROM basketball_lineups WHERE competitor_id = v_comp.id AND is_on_court = true;
  ```
  If count $\ne 5$, transaction rolls back with `INVALID_SUBSTITUTION`.
- Disqualified fouled-out players are rejected from entering the court.
- Cross-team substitutions and duplicate players are rejected.

---

## 9. Timeouts

- Configurable allocations supported:
  - Regulation: default 4 per team per match.
  - Overtime: default 1 per team per overtime period.
- Calling timeout:
  - Automatically pauses game clock to `STOPPED`.
  - Appends `TIMEOUT` event to ledger.
  - Decrements timeout counter.
  - Rejects with `TIMEOUT_EXHAUSTED` when allocation is depleted.
- Retries with duplicate client event IDs do not consume extra timeouts.

---

## 10. Period Progression

- Sequences:
  - Regulation: Q1 $\to$ Q2 $\to$ Q3 $\to$ Q4.
  - Overtime: Q4 tied $\to$ OT1 $\to$ OT2...
- Resets:
  - Period team fouls reset to 0 in every new period.
  - Game clock resets to configured duration (600s regulation, 300s overtime).
  - Clock starts in `STOPPED` state.
- Preserves:
  - Total cumulative match scores.
  - Player personal fouls and foul-out status.
  - Active 5-player on-court lineups.
- Tie handling:
  - If Q4 ends tied and `overtime_enabled = true`: advances to OT1.
  - If Q4 ends tied and `overtime_enabled = false`: completes match as `DRAW`.
  - If OT period ends with winner: completes match.

---

## 11. Undo

- Implemented under Option A: **Undo latest active event only**.
- Operates via soft undo: sets `voided_at = NOW()`. Historical events are never hard-deleted.
- Atomically reverses ledger effects:
  - `SCORE`: decrements period score and player points projection.
  - `FOUL`: decrements period team fouls and player personal fouls; restores eligibility (`is_fouled_out = false`) if personal fouls drop below limit.
  - `SUBSTITUTION`: restores outgoing player to court and returns incoming player to bench.
  - `TIMEOUT`: voiding event restores timeout availability.
- Attempts to undo completed periods, already voided events, or non-latest events are rejected.

---

## 12. Security

- **Security Mode:** `SECURITY DEFINER` with explicit safe `SET search_path = public, pg_temp`.
- **Caller RBAC Verification:** Authenticated callers must be Super Admin, Organization Owner/Manager, Match Creator, or Assigned Scorer.
- **Anonymous Protection:** `REVOKE EXECUTE ... FROM anon, public` applied. In-function assertion also raises `UNAUTHENTICATED`.
- **Cross-Sport Defense:** Every RPC inspects `sports.slug`. Calls on Cricket or Badminton matches immediately abort with `INVALID_SPORT`.
- **Tenant Isolation:** Enforces competitor and participant ownership matching match tenant.

---

## 13. Concurrency

Verified via multi-threaded asynchronous requests in `basketball-scoring-clock-rpc.test.ts`:
- **Simultaneous +2 scores:** Two scorers tap simultaneously $\to$ score increases by exactly +4, two sequential events logged with sequence numbers 1 and 2, zero lost updates.
- **Concurrent duplicate request:** Same `client_event_id` dispatched in parallel $\to$ exactly one event created, score increases once, duplicate receives idempotent replay.
- **Concurrent clock pause:** Two pause calls dispatched simultaneously $\to$ both succeed safely without corrupting remaining time.
- **Concurrent timeouts:** Two simultaneous timeout requests with identical idempotency key $\to$ exactly one timeout consumed.

---

## 14. Idempotency

Verified across scoring, fouls, substitutions, timeouts, and clock adjustments:
- If a client retries after a network blip with the same `(match_id, client_event_id)`, the RPC intercepts the request before mutation, fetches the existing event, and returns the authoritative state.
- Score, fouls, timeouts, and lineups are never double-counted.

---

## 15. Test Results

### Basketball Integration Suites
- `tests/integration/basketball-scoring-clock-rpc.test.ts`: **25 / 25 passed**
- `tests/integration/basketball-database-foundation.test.ts`: **7 / 7 passed**
- **Total Basketball Tests:** **32 / 32 passed**

---

## 16. Cricket Regression

- Ran all Cricket unit and integration test suites:
  - `tests/unit/cricket-scorecard.test.ts`: 19 passed
  - `tests/unit/cricket-match-simulation.test.ts`: 11 passed
  - `tests/integration/cricket-scoring.test.ts`: 2 passed
  - `tests/integration/cricket-scorecard.test.ts`: 2 passed
  - `tests/integration/cricket-scoring-rpc.test.ts`: 2 passed
- **Result:** **36 / 36 passed** (Baseline matched, 0 Cricket files modified)

---

## 17. Badminton Regression

- Ran all Badminton unit and integration test suites:
  - `tests/unit/badminton-live-centre.test.ts`: 7 passed
  - `tests/unit/badminton-scorer-ui.test.ts`: 7 passed
  - `tests/integration/badminton-scoring.test.ts`: 15 passed
  - `tests/integration/badminton-scoring-rpc.test.ts`: 18 passed
  - `tests/integration/badminton-progression-live.test.ts`: 10 passed
- **Result:** **57 / 57 passed** (Baseline matched, 0 Badminton files modified)

---

## 18. Full Test Suite

- Command: `npx vitest run`
- Test Files: **56 passed / 56 files**
- Total Tests: **579 passed / 579 tests** (100% pass rate)

---

## 19. Typecheck

- Command: `npm run typecheck`
- Result: **0 TypeScript errors** across all workspaces (`apps/web`, `apps/mobile`, `packages/*`, and `tests/`).

---

## 20. ESLint

- Command: `npm run lint`
- Result: **0 ESLint errors** across all workspaces.

---

## 21. Files Changed

```text
M tests/unit/schema.test.ts
?? supabase/migrations/20261001000034_basketball_scoring_clock_rpc.sql
?? tests/integration/basketball-scoring-clock-rpc.test.ts
?? STEP_20C_BASKETBALL_SCORING_CLOCK_BACKEND_REPORT.md
```

*(Note: `tests/unit/schema.test.ts` was updated strictly to add migration 034 to the expected migration inventory list, maintaining schema test integrity).*

---

## 22. Known Limitations

1. **Phase 2 Features Excluded by Design:** Shot clocks (24s/14s), rebounds, assists, steals, blocks, turnovers, and box-score minutes played are omitted in accordance with the frozen MVP scope.
2. **Single-Action Undo Boundary:** As specified in STEP 20A, undo is restricted to the latest active event in the current match; arbitrary historical event editing is not supported to protect causal timeline integrity.

---

## 23. STEP 20D Readiness

**YES, READY FOR STEP 20D.**

The PostgreSQL backend foundation and atomic gameplay engine are complete, concurrency-safe, server-authoritative, and 100% verified. The platform is ready for:

**STEP 20D — Basketball Court-Side Scorer UI**
