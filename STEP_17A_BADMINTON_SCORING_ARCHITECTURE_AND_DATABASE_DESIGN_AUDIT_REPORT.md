# SportsHub — STEP 17A: Badminton Live Scoring Architecture & Database Design Audit Report

**Date:** 2026-10-06  
**Project:** SportsHub (Strictly Isolated — No TIC360 / No CrickPulse)  
**Status:** **PASS** (Architecture & Database Design Audit Complete)  

---

## 1. Executive Summary

This report delivers a comprehensive, non-destructive architectural blueprint and database design for a dedicated, high-performance **Badminton Live Scoring Engine** within SportsHub. 

Key audit findings:
1. **Common Match Foundation Reusable (100%)**: The common match infrastructure (`matches`, `match_competitors`, `match_participants`, match status lifecycle, and scorer authorization) accommodates Badminton without adding a single sport-specific column.
2. **Cricket Module Completely Untouched (100% Isolation)**: The frozen Cricket implementation (`cricket_innings`, `cricket_deliveries`, Cricket RPCs, and UI) requires zero modifications.
3. **No Generic Scoring Engine Contamination**: Badminton will operate via its own dedicated domain model (`badminton_games` and `badminton_rallies`) rather than an over-abstracted generic scoring framework.
4. **Server-Authoritative Precision**: All scoring operations, game completions, match completions, and service rotations are enforced in PostgreSQL RPCs with atomic concurrency locks and idempotent replay protection.
5. **Zero Schema or Code Changes in STEP 17A**: As mandated, this step produces zero database changes, zero migrations, and zero source code edits.

---

## 2. Existing Common Match Engine Audit

An audit of the common match engine (`supabase/migrations/20261001000025_matches.sql`) confirms full compatibility:

| Component | Attributes & Role | Badminton Compatibility | Modification Needed? |
|---|---|---|---|
| `public.matches` | `id`, `match_reference`, `sport_id`, `organization_id`, `venue_id`, `facility_id`, `status`, `match_format`, `winner_side`, `result_summary`, `metadata` | Links directly to `sports.slug = 'badminton'`. `match_format` supports `'SINGLES'` and `'DOUBLES'`. | **NONE** |
| `public.match_competitors` | `id`, `match_id`, `side` (`SIDE_A`, `SIDE_B`), `team_id`, `competitor_name`, `score_summary`, `is_winner` | Accommodates singles player names or doubles team pairs. `score_summary` stores games won summary (e.g. `"2 - 1"`). | **NONE** |
| `public.match_participants` | `id`, `match_id`, `competitor_id`, `user_id`, `display_name`, `role`, `status` | Maps 1 player per competitor for Singles, or 2 players per competitor for Doubles. | **NONE** |
| `match_status` Lifecycle | `'SCHEDULED'` → `'WARMUP'` → `'LIVE'` → `'PAUSED'` → `'COMPLETED'` | Matches real-world badminton match progression identically. | **NONE** |
| Scorer Authorization | Evaluated via `matches.scorer_user_id = auth.uid()` or organization management RBAC. | Reusable directly by Badminton scoring RPCs. | **NONE** |
| Facilities & Courts | `facilities` linked to `sports.slug = 'badminton'` with wooden/synthetic badminton courts. | Native support for booking and venue association. | **NONE** |

---

## 3. Badminton Domain Rules & Scoring Dynamics

SportsHub Badminton will model standard **BWF (Badminton World Federation) Rally Point Scoring**:

### 3.1 Match Structure
- **Format**: Standard **Best of 3 games** (first side to win 2 games wins the match).
- **Extensible Configuration**: Optional match settings support Best of 1, Best of 3, or Best of 5.

### 3.2 Game Scoring Rules
1. **Target**: First side to score **21 points** wins the game, provided there is a margin of at least 2 points.
2. **Deuce (20–20)**: If the score reaches 20–20, play continues until one side achieves a 2-point lead (e.g., 22–20, 23–21, ..., 29–27).
3. **Hard Cap / Sudden Death (30-point ceiling)**: If the score reaches 29–29, the side scoring the 30th point wins the game (**30–29 max score**).
4. **Game Ending Boundary Matrix**:
   - `21–19`: Game completed (Winner reached 21 with a 2-point lead).
   - `20–20`: Game continues (Deuce).
   - `21–20`: Game continues (Lead is only 1 point).
   - `22–20`: Game completed (2-point lead).
   - `29–29`: Game continues (Sudden death).
   - `30–29`: Game completed (Hard cap at 30 reached).

---

## 4. Proposed Database Architecture

### Audit: Is a `badminton_matches` table necessary?
**Decision: NO.**
Similar to the Cricket architecture where match metadata is stored in `matches.metadata` and innings reside in `cricket_innings`, creating a 1:1 `badminton_matches` table would introduce unnecessary join overhead, locking complexity, and schema fragmentation.

The optimal, clean architecture:
```text
COMMON FOUNDATION
      matches (sport_id = 'badminton')
         ├── match_competitors (SIDE_A, SIDE_B)
         └── match_participants (Players)
                  │
                  ▼
         badminton_games (Game 1, Game 2, Game 3)
                  │
                  ▼
         badminton_rallies (Point-by-point immutable log)
```

---

## 5. Badminton Game Model (`badminton_games`)

Proposed schema for `badminton_games`:
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
  points_to_win INTEGER NOT NULL DEFAULT 21 CHECK (points_to_win >= 11 AND points_to_win <= 30),
  win_by INTEGER NOT NULL DEFAULT 2 CHECK (win_by >= 1 AND win_by <= 5),
  max_points INTEGER NOT NULL DEFAULT 30 CHECK (max_points >= points_to_win AND max_points <= 50),
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_badminton_games_match_number UNIQUE (match_id, game_number)
);
```

---

## 6. Rally Event Model (`badminton_rallies`)

Each row represents exactly one completed rally/point:
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
  
  -- Rally metadata (enrichment for live commentary)
  rally_type TEXT NOT NULL DEFAULT 'NORMAL' CHECK (
    rally_type IN ('NORMAL', 'SMASH', 'DROP', 'NET', 'OUT', 'FAULT', 'SERVICE_FAULT')
  ),
  
  -- Authoritative score state AFTER rally
  score_after_side_a INTEGER NOT NULL CHECK (score_after_side_a >= 0),
  score_after_side_b INTEGER NOT NULL CHECK (score_after_side_b >= 0),
  
  -- Idempotency protection
  client_event_id UUID NOT NULL,
  
  -- Soft-undo flag
  voided_at TIMESTAMPTZ NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_badminton_rallies_game_seq UNIQUE (game_id, sequence_number),
  CONSTRAINT uq_badminton_rallies_client_event UNIQUE (game_id, client_event_id)
);
```

---

## 7. Server Authority & RPC Design

Scoring must be 100% database-authoritative. The client sends a point event intent, and the database calculates all consequences atomically.

### Contract: `record_badminton_rally(...)`
```sql
FUNCTION public.record_badminton_rally(
  p_game_id UUID,
  p_winner_side TEXT,
  p_winning_participant_id UUID DEFAULT NULL,
  p_server_participant_id UUID DEFAULT NULL,
  p_receiver_participant_id UUID DEFAULT NULL,
  p_rally_type TEXT DEFAULT 'NORMAL',
  p_client_event_id UUID DEFAULT NULL
) RETURNS JSONB
```

**RPC Execution Flow**:
1. **Authorization**: Verify caller is `matches.scorer_user_id` or org staff.
2. **Locking**: Row lock `badminton_games` (`SELECT ... FOR UPDATE`).
3. **Idempotency Guard**: If `p_client_event_id` exists in `badminton_rallies` for this game and is not voided, return existing state immediately.
4. **Sequence Generation**: `sequence_number = COALESCE(MAX(sequence_number), 0) + 1`.
5. **Score Increment**:
   - If `p_winner_side = 'SIDE_A'`: `new_a = game.side_a_points + 1`, `new_b = game.side_b_points`.
   - If `p_winner_side = 'SIDE_B'`: `new_b = game.side_b_points + 1`, `new_a = game.side_a_points`.
6. **Game Completion Check**:
   - If `new_a >= points_to_win AND (new_a - new_b >= win_by OR new_a = max_points)`: `game_completed = true`, `game_winner = 'SIDE_A'`.
   - If `new_b >= points_to_win AND (new_b - new_a >= win_by OR new_b = max_points)`: `game_completed = true`, `game_winner = 'SIDE_B'`.
7. **Service Rotation**: Set `serving_side = p_winner_side`.
8. **Event Insertion**: Insert into `badminton_rallies`.
9. **Game State Update**: Update `badminton_games` points and completion status.
10. **Match Completion Evaluation**: If game completed, evaluate total games won. If either side reaches target games (e.g. 2 in best-of-3), automatically mark match as `COMPLETED`.

---

## 8. Idempotency Strategy

- Every scorer point button press generates a unique UUID `client_event_id`.
- The database enforces uniqueness on `(game_id, client_event_id)`.
- If a network retry occurs or an erratic double-tap is registered, the second RPC call detects the existing record and returns the cached authoritative response without awarding an extra point.
- Score inflation is mathematically impossible.

---

## 9. Concurrency Strategy

- **Pessimistic Row-Level Lock**: The RPC issues `SELECT ... FROM badminton_games WHERE id = p_game_id FOR UPDATE`.
- If two scorers or two tabs attempt to submit points simultaneously:
  1. Transaction 1 acquires the lock, reads the current score (e.g. 10–9), logs sequence 20, updates score to 11–9, and commits.
  2. Transaction 2 acquires the lock, reads the updated score (11–9), logs sequence 21, updates score to 11–10, and commits.
- Neither transaction loses points, and sequence numbering remains strictly monotonic.

---

## 10. Soft Undo Strategy (`undo_badminton_rally`)

- Badminton rallies will **NEVER be hard-deleted**.
- Contract: `undo_badminton_rally(p_game_id UUID) RETURNS JSONB`.
- **Workflow**:
  1. Identifies the latest non-voided rally:
     `SELECT * FROM badminton_rallies WHERE game_id = p_game_id AND voided_at IS NULL ORDER BY sequence_number DESC LIMIT 1 FOR UPDATE`.
  2. Sets `voided_at = NOW()`.
  3. Recalculates authoritative game score directly from active rallies:
     `side_a_points = COUNT(*) FILTER (WHERE winner_side = 'SIDE_A')`.
     `side_b_points = COUNT(*) FILTER (WHERE winner_side = 'SIDE_B')`.
  4. If the game was marked completed, resets `is_completed = false` and `winner_side = NULL`.
  5. If the parent match was marked completed, resets `matches.status = 'LIVE'` and `matches.winner_side = NULL`.
  6. Updates `badminton_games` and returns reconciled state.

---

## 11. Server-Side Game & Match Completion

### 11.1 Game Completion Boundaries
The server alone evaluates game completion using:
```sql
v_is_game_over := (
  (v_new_side_a >= v_points_to_win AND (v_new_side_a - v_new_side_b >= v_win_by OR v_new_side_a = v_max_points))
  OR
  (v_new_side_b >= v_points_to_win AND (v_new_side_b - v_new_side_a >= v_win_by OR v_new_side_b = v_max_points))
);
```

### 11.2 Match Completion (Best-of-3)
```text
Game 1 (21–18) → SIDE_A (1–0)
Game 2 (19–21) → SIDE_B (1–1)  --> Game 3 Required
Game 3 (21–16) → SIDE_A (2–1)  --> SIDE_A reaches 2 wins --> MATCH COMPLETED
```
If a team wins Game 1 and Game 2 (2–0), the match completes immediately. No Game 3 is ever scheduled or permitted.

---

## 12. Service & Side Rotation Logic

### 12.1 Singles Service Dynamics
- Initial toss winner serves at 0–0 from the **Right** service court.
- When serving side's score is **Even** (0, 2, 4, ...): Serve from **Right court**.
- When serving side's score is **Odd** (1, 3, 5, ...): Serve from **Left court**.
- If server wins rally: Score increments, server switches courts (Right ↔ Left), serves again.
- If receiver wins rally: Score increments, receiver becomes server, serves from the court matching their new score.

### 12.2 Doubles Service Dynamics (BWF 21-point rules)
- No second server.
- The serving side switches courts only when they win a rally on their own serve.
- When the receiving side wins a rally, they win a point and become the serving side. **Neither side switches courts**.
- The server on the receiving side is whichever player is already standing in the court dictated by their new score (Even = Right court, Odd = Left court).

---

## 13. Scorecard Read Model (`badminton-scorecard.ts`)

A pure deterministic TypeScript utility deriving full presentation states from raw database snapshots:
- **Game Breakdown**: Points, winner, duration, point sequence timeline.
- **Match Status**: Games won tally (`"2 - 1"`), current active game, match winner.
- **Service Status**: Active server name, receiver name, serving court side (`"RIGHT"` / `"LEFT"`).
- **Match Statistics**: Points won on serve vs return, longest rally streaks, error vs winner breakdown.

---

## 14. Authoritative Reconciliation Invariants

For any game at any moment, the following mathematical invariants must hold:
$$\text{side\_a\_points} = \sum_{r \in \text{rallies}} [r.winner\_side = \text{'SIDE\_A'} \land r.voided\_at \text{ IS NULL}]$$
$$\text{side\_b\_points} = \sum_{r \in \text{rallies}} [r.winner\_side = \text{'SIDE\_B'} \land r.voided\_at \text{ IS NULL}]$$
$$\text{active\_rallies} = \text{side\_a\_points} + \text{side\_b\_points}$$

If a database health check or audit detects any deviation, the point snapshots can be authoritatively re-derived from the un-voided event log with zero data loss.

---

## 15. RLS & Security Model

| Table | Operation | Target Role | Policy Rule |
|---|---|---|---|
| `badminton_games` | `SELECT` | Public / Spectator | Allowed if match is `SCHEDULED`, `LIVE`, `PAUSED`, or `COMPLETED`. |
| `badminton_games` | `INSERT / UPDATE` | Authenticated Scorer | Scorer ID matches or user has organization management role. |
| `badminton_games` | `DELETE` | **DENIED** | No deletion permitted. |
| `badminton_rallies` | `SELECT` | Public / Spectator | Allowed for all visible matches. |
| `badminton_rallies` | `INSERT / UPDATE` | Authorized Scorer | Mediated exclusively via `record_badminton_rally` / `undo_badminton_rally`. |
| `badminton_rallies` | `DELETE` | **DENIED** | Permissive `DELETE` policy strictly omitted. |

---

## 16. Realtime Architecture

```text
Scorer Device
    │
    ▼ (call RPC)
record_badminton_rally(...)
    │
    ▼ (PostgreSQL Commit)
Table Write: badminton_rallies + badminton_games
    │
    ▼ (WAL Event)
Supabase Realtime Broadcast Channel: "badminton_match:<id>"
    │
    ▼ (WebSocket Push)
Spectator Client
    │
    ▼ (Authoritative Refetch)
Fetch latest games + active rallies
    │
    ▼ (Derive View)
badminton-scorecard.ts
    │
    ▼
Live Score UI Update (< 150ms latency)
```

---

## 17. UI & Route Architecture

1. **Scorer Route**: `/matches/[id]/score/badminton/page.tsx`
   - Validates that `match.sport?.name?.toLowerCase() === 'badminton'`. Redirects non-badminton matches.
   - Enforces scorer authorization before mounting `BadmintonScorer.tsx`.
2. **Spectator Match Centre**: `/matches/[id]/live/page.tsx`
   - Inspects `match.sport?.name`. Renders `LiveMatchCentre` for cricket, or `LiveBadmintonMatchCentre` for badminton.
3. **Match Details Page**: `/matches/[id]/page.tsx`
   - Conditionally displays "Open Badminton Scorer" when `sport.name === 'badminton'`.

---

## 18. Cricket & Cross-Sport Isolation Verification

- **Cricket Tables**: `cricket_innings` and `cricket_deliveries` remain untouched.
- **Cricket RPCs**: `record_cricket_delivery`, `undo_cricket_delivery`, and `complete_cricket_match` remain untouched.
- **Cricket UI**: `CricketScorer.tsx` and cricket scorecard engines remain untouched.
- **Future Sports**: Basketball, Table Tennis, Chess, and Carrom will follow the exact same isolated pattern without dependency on Badminton or Cricket.

---

## 19. Migration Strategy (For Future STEP 17B)

When implementation commences in STEP 17B, the following sequential migrations will be created:
1. `20261001000030_badminton_scoring.sql`: Tables `badminton_games`, `badminton_rallies`, indexes, constraints, RLS.
2. `20261001000031_badminton_scoring_rpc.sql`: Stored functions `record_badminton_rally` and `undo_badminton_rally`.
3. `20261001000032_badminton_match_completion.sql`: Stored function `complete_badminton_match`.
4. `20261001000033_badminton_public_read.sql`: Public read policies for spectator scorecard views.

---

## 20. Comprehensive Test Strategy

### Unit Tests (`tests/unit/badminton-scorecard.test.ts`)
- Standard 21-point game win (21–15).
- Deuce progression (20–20 → 21–20 → 22–20).
- Sudden death hard cap at 30 (29–29 → 30–29).
- Best-of-3 match completion (2–0 sweep, 2–1 comeback).
- Singles service court determination (even=right, odd=left).
- Doubles service rotation without court swaps on receive points.
- Soft-undo score recalculation.
- Authoritative reconciliation invariant checks.

### Integration Tests (`tests/integration/badminton-scoring-rpc.test.ts`)
- Scorer role authorization check.
- Idempotent deduplication using `client_event_id`.
- Serialized execution under concurrent submissions.
- Soft-undo rollback of game and match completion.
- Spectator public read verification.

---

## 21. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Doubles service rotation confusion | Low / UI UX | Clear visual court diagrams in `BadmintonScorer.tsx` showing current server and receiver positions. |
| Rapid double-clicking by scorer | Point duplication | Strict client-side event UUID idempotency enforced in the database RPC. |
| Network disconnects on court | Scorer interruption | Local optimistic state queue with automatic replay on reconnect. |

---

## 22. Final Architecture Decision

| Architectural Question | Evaluation | Result |
|---|---|---|
| **A. Is the Common Match Engine reusable?** | `matches`, `match_competitors`, `match_participants` require zero schema changes. | **PASS** |
| **B. Can Badminton be implemented without modifying Cricket?** | 100% segregated tables, RPCs, and UI routes. | **PASS** |
| **C. Can Badminton have an independent event log?** | Dedicated `badminton_rallies` table. | **PASS** |
| **D. Can Badminton have independent RPCs?** | Dedicated `record_badminton_rally` and `undo_badminton_rally`. | **PASS** |
| **E. Can Badminton have independent RLS?** | Dedicated policies on `badminton_*` tables. | **PASS** |
| **F. Can Badminton have an independent scorecard?** | Pure derived read model in `badminton-scorecard.ts`. | **PASS** |
| **G. Does Badminton require a generic scoring engine?** | Completely avoided; domain-specific design preserved. | **NO (PASS)** |
| **H. Does Badminton require modification of existing Cricket tables?** | Cricket tables remain completely frozen and untouched. | **NO (PASS)** |

---

## 23. Final Status

### **STEP 17A STATUS: PASS**

The architectural design for SportsHub Badminton Live Scoring is fully validated, isolated, and ready for future implementation in STEP 17B.
