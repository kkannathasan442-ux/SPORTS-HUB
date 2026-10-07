# SportsHub — STEP 17C: Badminton Atomic Scoring RPC & Game Rules Report

**Date:** 2026-10-06  
**Project:** SportsHub (Strictly Isolated — No TIC360 / No CrickPulse)  
**Status:** **STEP 17C STATUS: PASS**  

---

## 1. Objective

Implement the authoritative, database-level **Badminton Live Scoring RPC layer** on top of the STEP 17B database foundation. The database serves as the single source of truth for rally recording, score progression, BWF deuce and sudden-death game completion rules, service rotation, sequence monotonicity, idempotency protection, concurrency locking, and soft undo.

---

## 2. Pre-Change Verification

Before making any changes:
- Confirmed migration state: `000001` through `000030` fully applied to the local PostgreSQL database.
- Confirmed next migration file is `20261001000031_badminton_scoring_rpc.sql`.
- Verified that common match foundation (`matches`, `match_competitors`, `match_participants`) and Cricket modules (`cricket_innings`, `cricket_deliveries`, Cricket RPCs) remain 100% frozen and untouched.
- Verified local Supabase database is active and reachable on port 54322/54321.

---

## 3. Migration Created

File: `supabase/migrations/20261001000031_badminton_scoring_rpc.sql`  
Applied via: `npx supabase migration up --local` (clean execution, exit code 0).

---

## 4. RPCs Created

### 4.1 `public.record_badminton_rally(...)`
```sql
CREATE OR REPLACE FUNCTION public.record_badminton_rally(
  p_match_id UUID,
  p_game_id UUID,
  p_client_event_id UUID,
  p_winner_side TEXT,
  p_winning_participant_id UUID DEFAULT NULL,
  p_rally_type public.badminton_rally_type DEFAULT 'NORMAL',
  p_server_participant_id UUID DEFAULT NULL,
  p_receiver_participant_id UUID DEFAULT NULL,
  p_sequence_number INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
```
**Responsibilities**:
1. Verifies match existence and validates sport is Badminton (`sports.slug = 'badminton'`).
2. Enforces caller authorization (scorer assignment, organization owner/manager, or super-admin).
3. Validates match lifecycle (rejects `DRAFT`, `SCHEDULED`, `COMPLETED`, `ABANDONED`, `CANCELLED`; auto-transitions `WARMUP` → `LIVE`).
4. Enforces idempotency via `client_event_id` (returns existing state on identical retry; raises `IDEMPOTENCY_CONFLICT` on payload conflict).
5. Locks target game row using `SELECT ... FROM public.badminton_games WHERE id = p_game_id FOR UPDATE`.
6. Validates participant integrity (winning participant matches winning side; server and receiver are not on the same team).
7. Derives strictly sequential sequence numbers (`MAX(sequence_number) + 1`).
8. Atomically increments winning side score, checks bounds against `max_points`, and evaluates BWF game completion.
9. Inserts event row into `badminton_rallies` and updates `badminton_games` snapshot in a single ACID transaction.

### 4.2 `public.undo_badminton_rally(...)`
```sql
CREATE OR REPLACE FUNCTION public.undo_badminton_rally(
  p_match_id UUID,
  p_game_id UUID,
  p_rally_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
```
**Responsibilities**:
1. Verifies caller authorization and match status.
2. Acquires row lock on `badminton_games`.
3. Identifies the most recent active rally (`voided_at IS NULL ORDER BY sequence_number DESC LIMIT 1`).
4. Rejects historical out-of-order undos (only the latest active rally can be undone).
5. Soft-voids rally by setting `voided_at = NOW()` (never issues SQL `DELETE`).
6. Restores previous score snapshot and service state from the preceding active rally (or resets to 0–0 if all rallies are voided).
7. Reverts game completion (`is_completed = false`, `winner_side = NULL`) and match completion if applicable.

---

## 5. Scoring Rules Implemented

The RPC implements standard BWF rally-point rules using configured thresholds on `badminton_games`:
- **Default Game Target**: 21 points, win by 2, capped at 30 points.
- **Deuce Logic**: At 20–20, game continues until a 2-point margin is achieved (e.g. 21–20 continues, 22–20 completes).
- **Sudden Death Hard Cap**: At 29–29, next point wins immediately (30–29 completes; 30–30 is prevented).
- **Score Integrity**: Scores can never exceed `max_points` (30).
- **Terminal State Protection**: Scoring into an already completed game is strictly rejected with `GAME_COMPLETED`.

---

## 6. Service & Rotation Logic

- **Serving Side**: The side that wins the rally authoritatively becomes the next `serving_side`.
- **Singles Service Court**: Derived from score parity (even score = right court, odd score = left court).
- **Doubles Service Logic**: Winning participant is assigned as active server; cross-side receiver validation prevents teammate-to-teammate serves.

---

## 7. Idempotency Protection

- Evaluated before row locking to avoid deadlock on retries.
- Identical `client_event_id` submissions return the cached transaction response with `'status': 'existing'`.
- Reusing `client_event_id` with conflicting winner side or participant raises `IDEMPOTENCY_CONFLICT`.

---

## 8. Concurrency Protection

- Pessimistic row-level locking via `SELECT ... FROM public.badminton_games WHERE id = p_game_id FOR UPDATE`.
- Real multi-threaded tests confirmed that two concurrent submissions against PostgreSQL are cleanly serialized: one receives sequence $N$, the other receives sequence $N+1$, with zero lost updates.

---

## 9. Soft Undo Behavior

- Absolutely **zero `DELETE` statements** executed.
- Rallies are marked with `voided_at = NOW()`.
- Score snapshots and service context revert atomically to the preceding active rally.
- Game completion is automatically reopened if the winning point is undone.

---

## 10. Authorization & Security

- RPCs execute with `SECURITY INVOKER`, honoring PostgreSQL RLS.
- Explicit procedural checks reject unauthenticated (`anon`) callers with `UNAUTHORIZED`.
- Scorer role and organization membership verified against `matches.organization_id`.
- Tenant isolation prevents cross-organization scoring mutations.

---

## 11. Sport Isolation Verification

- Calling `record_badminton_rally` or `undo_badminton_rally` on a Cricket match raises `INVALID_SPORT`.
- Cricket tables (`cricket_innings`, `cricket_deliveries`) and Cricket RPCs remain completely segregated and untouched.

---

## 12. Tenant Isolation Verification

- Members of Organization B cannot score matches belonging to Organization A (`UNAUTHORIZED`).

---

## 13. Test Results

### 13.1 Badminton Scoring RPC Integration Tests
Command: `npm test -- tests/integration/badminton-scoring-rpc.test.ts`
```text
 ✓ tests/integration/badminton-scoring-rpc.test.ts (18 tests) 291ms
   ✓ 1. records first rally and increments Side A score to 1-0
   ✓ 2. records second rally won by Side B, updating score to 1-1 and server to Side B
   ✓ 3. rejects invalid/out-of-order sequence number if provided
   ✓ 4. returns existing result when duplicate identical client_event_id is re-sent
   ✓ 5. rejects IDEMPOTENCY_CONFLICT when client_event_id is reused with conflicting winner side
   ✓ 6. safely serializes concurrent scoring requests without sequence collision or lost updates
   ✓ 7. handles 20-20 deuce: 21-20 does NOT end the game
   ✓ 8. handles 21-20: 22-20 achieves 2-point lead and completes the game
   ✓ 9. rejects recording rally into already completed game
   ✓ 10. handles sudden death hard cap at 30: 29-29 -> 30-29 wins game immediately
   ✓ 11. rejects participant from a different match
   ✓ 12. rejects winning participant assigned to wrong competitor side
   ✓ 13. rejects server and receiver from the same side
   ✓ 14. safely voids latest rally and restores authoritative score without hard deleting
   ✓ 15. rejects undoing an older rally when a more recent active rally exists
   ✓ 16. rejects Badminton scoring RPC when called on a Cricket match
   ✓ 17. rejects anonymous unauthenticated users from recording rallies
   ✓ 18. rejects anonymous unauthenticated users from undoing rallies

Test Files: 1 passed (1)
Tests:      18 passed (18)
Duration:   711ms
```

### 13.2 Full Scoring Test Suite (Badminton + Cricket)
Command: `npm test -- tests/integration/badminton tests/unit/cricket tests/integration/cricket`
```text
 ✓ tests/unit/cricket-scorecard.test.ts (19 tests)
 ✓ tests/unit/cricket-match-simulation.test.ts (11 tests)
 ✓ tests/integration/cricket-scoring-rpc.test.ts (2 tests)
 ✓ tests/integration/cricket-scorecard.test.ts (2 tests)
 ✓ tests/integration/cricket-scoring.test.ts (2 tests)
 ✓ tests/integration/badminton-scoring.test.ts (15 tests)
 ✓ tests/integration/badminton-scoring-rpc.test.ts (18 tests)

Test Files: 7 passed (7)
Tests:      69 passed (69)
Duration:   1.17s
```

### 13.3 Monorepo Static Analysis & Production Build
- `npm run typecheck`: **PASS** (Zero errors across 8 workspaces).
- `npm run lint`: **PASS** (Zero errors).
- `npm run build`: **PASS** (Compiled all 41 routes in `@sportshub/web`).

---

## 14. Files Changed

### New Files
1. `supabase/migrations/20261001000031_badminton_scoring_rpc.sql`
2. `tests/integration/badminton-scoring-rpc.test.ts`
3. `STEP_17C_BADMINTON_SCORING_RPC_REPORT.md`

### Existing Files Modified
**NONE.**

---

## 15. Limitations & Deferred Work

1. **Scorer UI**: `BadmintonScorer.tsx` and frontend RPC integration will be built in STEP 17D.
2. **Match Multi-Game Automation**: Automated Best-of-3 game progression and match completion will be implemented in STEP 17E.

---

## 16. Final Status

### **STEP 17C STATUS: PASS**

The Badminton Live Scoring atomic RPC layer has been fully implemented, applied to PostgreSQL, verified through 18 rigorous integration tests, and proven 100% isolated from Cricket and foundational match components.
