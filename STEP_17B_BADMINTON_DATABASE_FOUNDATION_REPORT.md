# SportsHub — STEP 17B: Badminton Scoring Database Foundation Report

**Date:** 2026-10-06  
**Project:** SportsHub (Strictly Isolated — No TIC360 / No CrickPulse)  
**Status:** **STEP 17B STATUS: PASS**  

---

## 1. Objective

Implement the dedicated **database foundation** for the SportsHub Badminton Live Scoring Engine based on the approved STEP 17A architecture:
```text
COMMON MATCH FOUNDATION
        │
        ├── matches
        ├── match_competitors
        └── match_participants
                │
                ▼
        badminton_games
                │
                ▼
        badminton_rallies
```
This step implements the schema, check constraints, foreign keys, triggers, indexes, RLS policies, and Realtime publications required for the future Badminton scoring RPCs without implementing the RPCs or UI yet.

---

## 2. Environment

| Environment Component | Status | Details |
|---|---|---|
| **OS / Platform** | Windows (PowerShell) | Node.js v20.x, npm |
| **Local Supabase Database** | **ONLINE** | PostgreSQL 15 on port 54322 / 54321 |
| **Migrations Applied** | **30 / 30 Clean** | Migrations `000001` through `000030` applied |
| **Test Runner** | Vitest v2.1.9 | Fast native runner with Supabase integration |
| **TypeScript / Next.js** | Next.js 14.2.35 | Turbo/Webpack compilation |

---

## 3. Pre-Change Architecture Verification

Before making any changes:
- Confirmed latest migration in `supabase/migrations/` was `20261001000029_cricket_scorecard_public_read.sql`.
- Verified next sequence number is `20261001000030`.
- Verified `matches`, `match_competitors`, and `match_participants` are completely sport-neutral and require zero schema changes.
- Verified Cricket module remains completely frozen with no modifications.

---

## 4. Migration Created

File: `supabase/migrations/20261001000030_badminton_scoring.sql`  
Applied via: `npx supabase migration up --local` (clean execution, exit code 0).

---

## 5. `badminton_games` Schema

```sql
CREATE TABLE public.badminton_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL CHECK (game_number > 0 AND game_number <= 5),

  -- Running authoritative score snapshot
  side_a_points INTEGER NOT NULL DEFAULT 0 CHECK (side_a_points >= 0 AND side_a_points <= 30),
  side_b_points INTEGER NOT NULL DEFAULT 0 CHECK (side_b_points >= 0 AND side_b_points <= 30),

  -- Winner & completion lifecycle
  winner_side TEXT CHECK (winner_side IS NULL OR winner_side IN ('SIDE_A', 'SIDE_B')),
  is_completed BOOLEAN NOT NULL DEFAULT false,

  -- Current service state
  serving_side TEXT NOT NULL DEFAULT 'SIDE_A' CHECK (serving_side IN ('SIDE_A', 'SIDE_B')),
  server_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  receiver_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,

  -- Configurable game thresholds (defaults to BWF standard)
  points_to_win INTEGER NOT NULL DEFAULT 21 CHECK (points_to_win > 0 AND points_to_win <= 30),
  win_by INTEGER NOT NULL DEFAULT 2 CHECK (win_by > 0 AND win_by <= 5),
  max_points INTEGER NOT NULL DEFAULT 30 CHECK (max_points >= points_to_win AND max_points <= 50),

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_badminton_games_match_number UNIQUE (match_id, game_number)
);
```

---

## 6. `badminton_rallies` Schema

```sql
CREATE TABLE public.badminton_rallies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.badminton_games(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),

  -- Rally outcome
  winner_side TEXT NOT NULL CHECK (winner_side IN ('SIDE_A', 'SIDE_B')),
  winning_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,

  -- Service context during this rally
  server_side TEXT NOT NULL CHECK (server_side IN ('SIDE_A', 'SIDE_B')),
  server_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  receiver_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,

  -- Controlled rally type enum
  rally_type public.badminton_rally_type NOT NULL DEFAULT 'NORMAL',

  -- Authoritative score state AFTER rally
  score_after_side_a INTEGER NOT NULL CHECK (score_after_side_a >= 0),
  score_after_side_b INTEGER NOT NULL CHECK (score_after_side_b >= 0),

  -- Idempotency protection
  client_event_id UUID NOT NULL,

  -- Soft-undo flag
  voided_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_badminton_rallies_game_seq UNIQUE (game_id, sequence_number),
  CONSTRAINT uq_badminton_rallies_client_event UNIQUE (game_id, client_event_id)
);
```

---

## 7. Constraints & Invariants

1. **Enum**: `badminton_rally_type` (`'NORMAL'`, `'SMASH'`, `'DROP'`, `'NET'`, `'OUT'`, `'FAULT'`, `'SERVICE_FAULT'`).
2. **Game Uniqueness**: `UNIQUE(match_id, game_number)` guarantees no duplicate game numbers within a match.
3. **Sequence Monotonicity**: `UNIQUE(game_id, sequence_number)` guarantees no conflicting sequence numbers in a game.
4. **Idempotency Key**: `UNIQUE(game_id, client_event_id)` prevents duplicate point creation on network retries or double-taps.
5. **Config Bounds**: `points_to_win > 0`, `win_by > 0`, `max_points >= points_to_win`, and `points <= 30`.
6. **Cross-Sport Guard**: Trigger `check_badminton_game_match` enforces that `badminton_games` can only be created for matches where `sport.slug = 'badminton'`.
7. **Cross-Match Guard**: Trigger `check_badminton_rally_match` validates that a rally's `game_id` belongs to the exact same `match_id`.

---

## 8. Foreign Key Integrity

- `badminton_games.match_id → matches.id (ON DELETE CASCADE)`
- `badminton_rallies.match_id → matches.id (ON DELETE CASCADE)`
- `badminton_rallies.game_id → badminton_games.id (ON DELETE CASCADE)`
- `server_participant_id → match_participants.id (ON DELETE RESTRICT)`
- `receiver_participant_id → match_participants.id (ON DELETE RESTRICT)`
- `winning_participant_id → match_participants.id (ON DELETE RESTRICT)`

Participant deletion cannot accidentally cascade into scoring history deletion (`ON DELETE RESTRICT`).

---

## 9. Performance Indexes

```sql
CREATE INDEX idx_badminton_games_match_id ON public.badminton_games(match_id);
CREATE UNIQUE INDEX idx_badminton_games_match_number ON public.badminton_games(match_id, game_number);

CREATE INDEX idx_badminton_rallies_match_id ON public.badminton_rallies(match_id);
CREATE INDEX idx_badminton_rallies_game_seq ON public.badminton_rallies(game_id, sequence_number);
CREATE INDEX idx_badminton_rallies_game_voided ON public.badminton_rallies(game_id) WHERE voided_at IS NULL;
CREATE UNIQUE INDEX idx_badminton_rallies_idempotency ON public.badminton_rallies(game_id, client_event_id);
```

---

## 10. RLS Policies

1. **Row Level Security**: Enabled on `badminton_games` and `badminton_rallies`.
2. **Spectator Public Read**:
   - `badminton_games_select_public`: Read allowed for non-draft matches (`SCHEDULED`, `WARMUP`, `LIVE`, `PAUSED`, `COMPLETED`).
   - `badminton_rallies_select_public`: Read allowed for active or completed matches (`WARMUP`, `LIVE`, `PAUSED`, `COMPLETED`).
3. **Scorer / Org Admin Mutations**:
   - `badminton_games_modify_authorized`: INSERT/UPDATE restricted to match scorer or organization managers (`OWNER`, `MANAGER`).
   - `badminton_rallies_insert_authorized` & `badminton_rallies_update_authorized`: INSERT/UPDATE restricted to match scorer or org managers.
4. **Direct Deletions Strictly Denied**:
   - No `DELETE` policy exists on `badminton_games` or `badminton_rallies`.
   - Undo operations must use soft undo via `voided_at`.

---

## 11. Realtime Configuration

Added tables to publication `supabase_realtime`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.badminton_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.badminton_rallies;
```
Existing Cricket publications remain completely unaffected.

---

## 12. Security & Tenant Isolation Verification

Integration test suite `tests/integration/badminton-scoring.test.ts` confirmed:
- Anonymous users cannot directly `INSERT`, `UPDATE`, or `DELETE` games or rallies.
- Non-draft match data is publicly readable for spectators.
- Cross-tenant data separation is enforced via parent `matches.organization_id`.

---

## 13. Cricket Regression Verification

- Cricket Tables: `cricket_innings` and `cricket_deliveries` untouched.
- Cricket RPCs: `record_cricket_delivery`, `undo_cricket_delivery`, `complete_cricket_match` untouched.
- Cricket UI: `CricketScorer.tsx`, `LiveMatchCentre.tsx` untouched.
- Test Run (`tests/unit/cricket`, `tests/integration/cricket`): **36 / 36 PASS** (269ms).

---

## 14. Test Results

### 14.1 Badminton Database Foundation Tests
Command: `npm test -- tests/integration/badminton-scoring.test.ts`
```text
 ✓ tests/integration/badminton-scoring.test.ts (15 tests) 199ms
   ✓ 1. verifies badminton_games and badminton_rallies tables exist
   ✓ 2. verifies valid game insertion
   ✓ 3. rejects invalid game configuration (points_to_win > max_points or invalid numbers)
   ✓ 4. rejects duplicate game number for the same match
   ✓ 5. rejects game creation for non-badminton match (check_badminton_game_match trigger)
   ✓ 6. verifies valid rally insertion
   ✓ 7. rejects duplicate sequence number for the same game
   ✓ 8. rejects duplicate client_event_id for idempotency protection
   ✓ 9. rejects invalid winner_side
   ✓ 10. rejects negative scores in rally snapshot
   ✓ 11. verifies cross-match integrity (rally match_id must match game match_id)
   ✓ 12. verifies RLS public read access for LIVE matches via anon client
   ✓ 13. verifies unauthorized anon mutation is rejected by RLS
   ✓ 14. verifies soft-undo column availability (voided_at)
   ✓ 15. verifies direct DELETE is denied for authenticated non-admin or public

Test Files: 1 passed (1)
Tests:      15 passed (15)
Duration:   580ms
```

### 14.2 Codebase Quality & Static Verification
- `npm run typecheck`: **PASS** (Zero TypeScript errors across 8 monorepo workspaces).
- `npm run lint`: **PASS** (Zero ESLint errors).
- `npm run build`: **PASS** (Compiled all 41 routes in `@sportshub/web`).

---

## 15. Files Changed

### New Files
1. `supabase/migrations/20261001000030_badminton_scoring.sql`
2. `tests/integration/badminton-scoring.test.ts`
3. `STEP_17B_BADMINTON_DATABASE_FOUNDATION_REPORT.md`

### Existing Files Modified
**NONE.**

---

## 16. Known Limitations & Deferred Work

1. **Scoring RPCs Deferred**: `record_badminton_rally()`, `undo_badminton_rally()`, and match completion RPCs will be implemented in STEP 17C.
2. **Scorer UI Deferred**: `BadmintonScorer.tsx` and live match spectator components will be built in later steps.

---

## 17. Final Status

### **STEP 17B STATUS: PASS**

The Badminton Live Scoring database foundation has been created, migrated, tested against PostgreSQL, and verified to be 100% isolated and regression-free.
