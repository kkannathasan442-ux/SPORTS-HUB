# SPORTSHUB STEP 19 — Basketball Module Architecture & Database Audit Report

**Date:** 2026-10-07  
**Branch:** `main`  
**Latest Baseline Commit:** `85544f4891d38b3a3757a84b9b2cc11e21cb9e10`  
**Audit Purpose:** Comprehensive Architecture, Business Rules, Database Design & Planning Audit for the upcoming Basketball Module.  
**Audit Rule:** STRICT AUDIT & PLANNING ONLY. Zero changes made to existing code, database, Cricket or Badminton modules.  
**Author:** Antigravity Pair Programmer  

---

## 1. Executive Summary

This report delivers a complete, evidence-based architectural analysis, database schema proposal, server-authoritative scoring API specification, and phased implementation roadmap for introducing a dedicated **Basketball Scoring and Match Management Module** into the SportsHub platform.

The existing SportsHub architecture was audited directly in the local repository and local PostgreSQL database. The audit confirmed that the shared match foundation (`matches`, `match_competitors`, `match_participants`, `organizations`, `venues`, `teams`) provides a rock-solid, multi-tenant substrate that already supports `TEAM` format, while the established sport-specific isolation pattern (as implemented in Cricket and Badminton) provides a proven, zero-leakage integration model.

### Primary Audit Findings Matrix
| Investigation Area | Classification | Summary & Findings |
| :--- | :--- | :--- |
| **Shared Match Foundation** | `VERIFIED` | `matches`, `match_competitors`, and `match_participants` support multi-tenant ownership, format enforcement, and lifecycle state machines (`DRAFT` → `SCHEDULED` → `WARMUP` → `LIVE` → `PAUSED` → `COMPLETED`). |
| **Sports Catalog & Team Support** | `VERIFIED` | In `public.sports`, Basketball exists (`slug = 'basketball'`, `supports_team = true`), but currently has `supports_live_scoring = false`. |
| **Sport Isolation Boundary** | `VERIFIED` | Dynamic router `/matches/[id]/live` and `/matches/[id]/page.tsx` cleanly dispatch by `sport_slug`, isolating Cricket and Badminton without generic abstractions. |
| **Basketball Rules Standard** | `PROPOSED` | Standard FIBA/NBA 4-quarter structure, 1/2/3-point scoring, personal & team foul tracking, overtime on tie, and configurable quarter durations. |
| **Game-Clock Authority** | `PROPOSED` | Server-authoritative elapsed time calculation with client-driven start/pause events, avoiding local clock drift and desynchronization. |
| **Database Schema Design** | `PROPOSED` | Dual-table model: `basketball_periods` (state/clock/aggregate scores) and `basketball_events` (append-only ledger for points, fouls, timeouts, substitutions). |
| **Server-Authoritative RPCs** | `PROPOSED` | 8 atomic plpgsql procedures with explicit row locks (`FOR UPDATE OF m`), idempotency keys (`client_event_id`), and cross-sport rejection. |
| **System Modification Status** | `VERIFIED` | **0 files modified, 0 migrations created, 0 database objects added.** |

---

## 2. Repository and Local Environment Inspected

- **Repository Root:** `F:/SPORTS HUB`
- **Git Branch:** `main`
- **Current Commit:** `85544f4891d38b3a3757a84b9b2cc11e21cb9e10`
- **Local Database Environment:**
  - Docker Container: `supabase_db_SPORTS_HUB` (PostgreSQL 15.8)
  - API Gateway / Auth / Realtime: `http://127.0.0.1:54321`
  - Studio: `http://127.0.0.1:54323`
- **Current Migration State:**
  - `VERIFIED`: Migrations `20261001000001` through `20261001000032` are applied and in 100% sync locally.
  - Frozen Cricket Migrations: `20261001000026` – `20261001000029` (Untouched).
  - Frozen Badminton Migrations: `20261001000030` – `20261001000032` (Untouched).
- **Inspected Sources:**
  - `supabase/migrations/20261001000007_sports.sql`
  - `supabase/migrations/20261001000024_teams_and_rosters.sql`
  - `supabase/migrations/20261001000025_matches.sql`
  - `apps/web/src/app/matches/[id]/page.tsx`
  - `apps/web/src/app/matches/[id]/live/page.tsx`
  - Existing Cricket and Badminton scoring & live centre components.

---

## 3. Actual Shared Match Foundation Findings

### A. Core Tables and Lifecycle State Machine
- `VERIFIED`: **`public.matches`**
  - Columns: `id`, `match_reference` (e.g. `MTH-YYYYMMDD-XXXXXX`), `sport_id`, `organization_id`, `venue_id`, `facility_id`, `booking_id`, `title`, `match_type`, `match_format`, `status`, `scheduled_start`, `scheduled_end`, `actual_start`, `actual_end`, `created_by`, `scorer_user_id`, `winner_side`, `result_summary`, `metadata`.
  - Status Enum (`match_status`): `DRAFT`, `SCHEDULED`, `WARMUP`, `LIVE`, `PAUSED`, `COMPLETED`, `ABANDONED`, `CANCELLED`.
  - Format Enum (`match_format`): `SINGLES`, `DOUBLES`, `TEAM`.
- `VERIFIED`: **`public.match_competitors`**
  - Enforces exactly two sides: `SIDE_A` and `SIDE_B` via unique constraint `uq_match_competitor_side (match_id, side)`.
  - Foreign key `team_id REFERENCES public.teams(id)` connects to registered teams.
- `VERIFIED`: **`public.match_participants`**
  - Links individual players (`user_id` or unregistered guests via `display_name`) to a competitor side (`SIDE_A` or `SIDE_B`).
  - Columns: `role` (`CAPTAIN`, `PLAYER`, `SUBSTITUTE`), `jersey_number` (`0..999`), `status` (`INVITED`, `CONFIRMED`, `DECLINED`, `PLAYING`, `BENCH`).

### B. Team Format Validation & Sport Catalog
- `VERIFIED`: Trigger function `public.validate_match_roster_completeness` in migration 25:
  - For `p_format = 'TEAM'`, validates:
    1. Both `SIDE_A` and `SIDE_B` competitors have assigned `team_id`.
    2. Selected sport has `sports.supports_team = true`.
    3. Both sides have at least 1 participant before transition from `DRAFT` to `SCHEDULED`.
- `VERIFIED`: In `public.sports`:
  - `id`: `00000000-0000-0000-0000-000000000003`
  - `name`: `'Basketball'`
  - `slug`: `'basketball'`
  - `supports_team`: `true`
  - `supports_booking`: `true`
  - `supports_tournament`: `true`
  - `supports_live_scoring`: `false` (Must be enabled when Basketball live scoring migration is created).

---

## 4. Cricket and Badminton Integration Boundaries

SportsHub follows a strict **Sport-Specific Scoring Engine Pattern**. There is deliberately **no generic scoring engine**.

### A. Lessons from Cricket and Badminton
1. **Cricket Boundary (`VERIFIED`):**
   - Tables: `cricket_innings`, `cricket_deliveries`.
   - Logic: Ball-by-ball append-only ledger with over tracking, wickets, extras, target calculation, and Duckworth-Lewis-Stern / run chase completion.
   - Status: 100% frozen. Must never be imported, referenced, or altered by Basketball.
2. **Badminton Boundary (`VERIFIED`):**
   - Tables: `badminton_games`, `badminton_rallies`.
   - Logic: Rally-by-rally append-only ledger with service court (even/odd), server rotation, deuce handling (win-by-2 up to 30), and Best-of-3 game progression.
   - Status: 100% frozen. Must never be imported, referenced, or altered by Basketball.
3. **Route Integration Boundary (`VERIFIED`):**
   - `/matches/[id]/live/page.tsx` inspects `match.sport.slug` and renders `<CricketLiveMatchCentre />` or `<BadmintonLiveMatchCentre />`, with a safe redirect fallback for other sports.
   - `/matches/[id]/page.tsx` renders "Open Cricket Scorer" or "Open Badminton Scorer" conditionally based on sport slug.

### B. Architectural Invariant for Basketball
- Basketball **MUST** have its own dedicated tables, RPC procedures, and React components.
- Shared code is restricted to:
  - Base authentication and organization RBAC.
  - Base match record (`matches`), competitors (`match_competitors`), and participants (`match_participants`).
  - Shared UI design tokens (`Container`, `Card`, `Button`, `Badge`).

---

## 5. Basketball Requirements Specification

### A. Standard Basketball Rules (`PROPOSED`)
1. **Team Lineup & On-Court Roster:**
   - Standard 5-player active lineup per team on the court.
   - Substitutions: Bench players can substitute in for active on-court players during dead-ball / paused clock intervals.
2. **Scoring Breakdown:**
   - **1 Point:** Successful Free Throw.
   - **2 Points:** Successful Field Goal (inside 3-point arc, including layups, dunks, mid-range).
   - **3 Points:** Successful Field Goal (beyond 3-point arc).
3. **Fouls:**
   - **Personal Foul:** Committed by a player.
   - **Team Foul:** Sum of personal fouls by a team in the current period.
   - **Bonus / Penalty:** Exceeding team foul limit triggers automatic free throws on subsequent non-shooting fouls.
   - **Foul Out:** A player accumulating 5 fouls (FIBA) or 6 fouls (NBA) is disqualified from further play in the match.
4. **Periods & Overtime:**
   - Regulation match consists of 4 periods (Quarters).
   - If tied at the end of regulation (Q4), 5-minute Overtime (OT) periods are played until a winner is determined.

### B. Configurable Competition Rules (`PROPOSED`)
Because SportsHub serves casual matches, corporate leagues, and organized tournaments, the following parameters must be configurable per match (stored in `matches.metadata->'basketball_config'`):
1. **Quarter Duration:** Default 10 minutes (FIBA: 600s). Configurable to 12 mins (NBA: 720s), 8 mins (Youth/Casual: 480s), or 20 mins (2 halves: 1200s).
2. **Number of Periods:** Default 4 quarters. Configurable to 2 halves.
3. **Overtime Duration:** Default 5 minutes (300s). Configurable to 3 mins or 0 (allow ties in casual league stages).
4. **Foul-Out Limit:** Default 5 personal fouls. Configurable to 6.
5. **Team Foul Bonus Threshold:** Default 5 fouls per quarter.
6. **Running Clock vs Stop Clock:**
   - *Stop Clock (Standard):* Clock pauses on every whistle, foul, out-of-bounds, and free throw.
   - *Running Clock (Recreational/Corporate):* Clock continuously runs except during the final 2 minutes of the 4th quarter.

### C. SportsHub Product Decisions Requiring Confirmation (`NEEDS CONFIRMATION`)
1. **Shot Clock Support:**
   - *Decision:* Is 24-second / 14-second shot-clock tracking required for Phase 1?
   - *Recommendation:* **Defer to Phase 2.** Most recreational and amateur venues lack dedicated shot-clock operators. A scorer managing clock, score, and shot clock simultaneously on one mobile screen is prone to error.
2. **Advanced Box-Score Statistics:**
   - *Decision:* Should Phase 1 track individual rebounds (offensive/defensive), assists, steals, blocks, and turnovers?
   - *Recommendation:* **Phase 1 MVP should focus on authoritative Points (1, 2, 3), Fouls (Personal/Tech), Timeouts, and Substitutions.** Advanced stat tracking adds immense UI cognitive load for a single court-side scorer. The schema should support optional stat event types without enforcing them.
3. **3x3 Basketball Format:**
   - *Decision:* Should FIBA 3x3 (half-court, 10-minute game, 21-point target, 1pt and 2pt scoring) be supported under the same module?
   - *Recommendation:* Support via match format configuration (`format = 'TEAM'`, `config.players_on_court = 3`, `config.points_rule = '3x3'`).

---

## 6. Proposed Dedicated Database Architecture (`PROPOSED`)

The proposed schema follows the highly successful two-tier model proven in Cricket and Badminton:
1. **`basketball_periods`**: Stores period-level state, game clock, and running aggregate scores for lightning-fast reads and Realtime synchronization.
2. **`basketball_events`**: Append-only authoritative event ledger recording every point, foul, substitution, timeout, and clock event, guaranteeing complete auditability and idempotent undo.

```
       ┌────────────────────────┐
       │     public.matches     │
       └───────────┬────────────┘
                   │ 1:N
       ┌───────────▼────────────┐
       │   basketball_periods   │ ◄─── Stores Q1..Q4, OT, clock, team fouls, scores
       └───────────┬────────────┘
                   │ 1:N
       ┌───────────▼────────────┐
       │   basketball_events    │ ◄─── Append-only log (1pt, 2pt, 3pt, foul, sub, timeout)
       └────────────────────────┘
```

### Table 1: `public.basketball_periods` (`PROPOSED`)
- **Purpose:** Tracks the active period (Q1, Q2, Q3, Q4, OT1...), period status, game clock, and period-specific score summaries.
- **Columns:**
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `match_id`: `UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE`
  - `period_number`: `INTEGER NOT NULL CHECK (period_number >= 1)`
  - `period_type`: `TEXT NOT NULL CHECK (period_type IN ('REGULAR', 'OVERTIME')) DEFAULT 'REGULAR'`
  - `side_a_score`: `INTEGER NOT NULL DEFAULT 0 CHECK (side_a_score >= 0)`
  - `side_b_score`: `INTEGER NOT NULL DEFAULT 0 CHECK (side_b_score >= 0)`
  - `side_a_fouls`: `INTEGER NOT NULL DEFAULT 0 CHECK (side_a_fouls >= 0)`
  - `side_b_fouls`: `INTEGER NOT NULL DEFAULT 0 CHECK (side_b_fouls >= 0)`
  - `duration_seconds`: `INTEGER NOT NULL DEFAULT 600` (Configured period length)
  - `time_remaining_seconds`: `INTEGER NOT NULL DEFAULT 600 CHECK (time_remaining_seconds >= 0)`
  - `clock_status`: `TEXT NOT NULL CHECK (clock_status IN ('STOPPED', 'RUNNING')) DEFAULT 'STOPPED'`
  - `clock_last_started_at`: `TIMESTAMPTZ` (Timestamp when clock last resumed running)
  - `is_completed`: `BOOLEAN NOT NULL DEFAULT FALSE`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints & Indexes:**
  - `CONSTRAINT uq_basketball_period UNIQUE (match_id, period_number)`
  - `INDEX idx_basketball_periods_match_id ON public.basketball_periods(match_id)`

### Table 2: `public.basketball_events` (`PROPOSED`)
- **Purpose:** Authoritative append-only log of every game event. Serves as the source of truth for the scoreboard, play-by-play ticker, player statistics, and undo operations.
- **Columns:**
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `match_id`: `UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE`
  - `period_id`: `UUID NOT NULL REFERENCES public.basketball_periods(id) ON DELETE CASCADE`
  - `sequence_number`: `INTEGER NOT NULL CHECK (sequence_number >= 1)`
  - `client_event_id`: `UUID NOT NULL` (Idempotency key)
  - `side`: `TEXT NOT NULL CHECK (side IN ('SIDE_A', 'SIDE_B'))`
  - `competitor_id`: `UUID NOT NULL REFERENCES public.match_competitors(id) ON DELETE CASCADE`
  - `participant_id`: `UUID REFERENCES public.match_participants(id) ON DELETE SET NULL`
  - `event_type`: `TEXT NOT NULL CHECK (event_type IN ('FIELD_GOAL_2PT', 'FIELD_GOAL_3PT', 'FREE_THROW_1PT', 'MISSED_SHOT', 'PERSONAL_FOUL', 'TECHNICAL_FOUL', 'TIMEOUT', 'SUBSTITUTION', 'PERIOD_START', 'PERIOD_END'))`
  - `points`: `INTEGER NOT NULL DEFAULT 0 CHECK (points IN (0, 1, 2, 3))`
  - `game_clock_seconds`: `INTEGER NOT NULL CHECK (game_clock_seconds >= 0)` (Remaining time when event occurred)
  - `metadata`: `JSONB NOT NULL DEFAULT '{}'::jsonb` (e.g. `{ sub_out_id: uuid }`, `{ foul_details: 'SHOOTING' }`)
  - `voided_at`: `TIMESTAMPTZ` (Non-null if undone)
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints & Indexes:**
  - `CONSTRAINT uq_basketball_events_sequence UNIQUE (period_id, sequence_number)`
  - `CONSTRAINT uq_basketball_events_client_event UNIQUE (match_id, client_event_id)`
  - `INDEX idx_basketball_events_match_active ON public.basketball_events(match_id, period_id) WHERE voided_at IS NULL`
  - `INDEX idx_basketball_events_participant ON public.basketball_events(participant_id)`

### Table 3: `public.basketball_lineups` (`PROPOSED`)
- **Purpose:** Tracks current on-court players vs. bench players per competitor side.
- **Columns:**
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `match_id`: `UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE`
  - `competitor_id`: `UUID NOT NULL REFERENCES public.match_competitors(id) ON DELETE CASCADE`
  - `participant_id`: `UUID NOT NULL REFERENCES public.match_participants(id) ON DELETE CASCADE`
  - `is_on_court`: `BOOLEAN NOT NULL DEFAULT FALSE`
  - `fouls_count`: `INTEGER NOT NULL DEFAULT 0 CHECK (fouls_count >= 0)`
  - `points_count`: `INTEGER NOT NULL DEFAULT 0 CHECK (points_count >= 0)`
  - `is_fouled_out`: `BOOLEAN NOT NULL DEFAULT FALSE`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints:**
  - `CONSTRAINT uq_basketball_lineup_player UNIQUE (match_id, participant_id)`

---

## 7. Server-Authoritative Scoring API (Proposed RPCs)

All mutations will be executed via database RPCs with `SECURITY INVOKER` or `SECURITY DEFINER` (with internal role validation), ensuring clients cannot inject unverified scores.

### 1. `init_basketball_match(p_match_id UUID, p_config JSONB)` (`PROPOSED`)
- Validates:
  - Match is active and sport is `basketball`.
  - Caller is authorized (scorer, manager, or owner).
  - Teams are assigned to `SIDE_A` and `SIDE_B`.
- Action:
  - Locks match row `FOR UPDATE OF m`.
  - Creates Period 1 (`period_number = 1`, `duration_seconds = 600`, `time_remaining_seconds = 600`, `clock_status = 'STOPPED'`).
  - Sets initial 5 starting players per side as `is_on_court = true`.
  - Transitions match status from `SCHEDULED`/`WARMUP` to `LIVE`.

### 2. `record_basketball_score(p_match_id UUID, p_period_id UUID, p_client_event_id UUID, p_side TEXT, p_participant_id UUID, p_points INTEGER, p_event_type TEXT)` (`PROPOSED`)
- Validates:
  - Match is `LIVE` and period is active.
  - Idempotency: Returns existing event if `p_client_event_id` already processed.
  - `p_points` in (1, 2, 3).
  - `p_participant_id` belongs to `p_side` and is active on court.
- Action:
  - Appends to `basketball_events`.
  - Increments `side_a_score` or `side_b_score` on `basketball_periods`.
  - Updates player points on `basketball_lineups`.
  - Synchronizes total match score in `matches.metadata`.

### 3. `record_basketball_foul(p_match_id UUID, p_period_id UUID, p_client_event_id UUID, p_side TEXT, p_participant_id UUID, p_foul_type TEXT)` (`PROPOSED`)
- Validates:
  - Match is `LIVE`.
  - `p_participant_id` has not already fouled out.
- Action:
  - Appends foul to `basketball_events`.
  - Increments period team fouls (`side_a_fouls` or `side_b_fouls`).
  - Increments player `fouls_count`. If player reaches foul-out limit (e.g. 5), sets `is_fouled_out = true` and `is_on_court = false`.

### 4. `update_basketball_clock(p_match_id UUID, p_period_id UUID, p_action TEXT, p_set_seconds INTEGER)` (`PROPOSED`)
- Validates caller authorization.
- Actions:
  - If `p_action = 'START'`: Sets `clock_status = 'RUNNING'`, `clock_last_started_at = NOW()`.
  - If `p_action = 'PAUSE'`: Computes elapsed time since `clock_last_started_at`, subtracts from `time_remaining_seconds`, sets `clock_status = 'STOPPED'`, `clock_last_started_at = NULL`.
  - If `p_action = 'SET_TIME'`: Allows authorized scorer to correct clock drift (e.g. adjust to referee's whistle).

### 5. `substitute_basketball_player(p_match_id UUID, p_side TEXT, p_player_out_id UUID, p_player_in_id UUID)` (`PROPOSED`)
- Validates clock is stopped or ball is dead.
- Swaps on-court status: `player_out.is_on_court = false`, `player_in.is_on_court = true`.
- Appends `SUBSTITUTION` event to `basketball_events`.

### 6. `undo_basketball_event(p_match_id UUID, p_period_id UUID, p_event_id UUID)` (`PROPOSED`)
- Validates target event is the latest un-voided scoring/foul event.
- Marks `voided_at = NOW()`.
- Authoritatively rolls back points/fouls on `basketball_periods` and `basketball_lineups`.

### 7. `progress_basketball_period(p_match_id UUID, p_action TEXT)` (`PROPOSED`)
- Handles period transitions:
  - Q1 → Q2, Q2 → Q3 (Halftime), Q3 → Q4.
  - Q4 → Match Completion (if not tied).
  - Q4 → Overtime 1 (if tied and winner required).
  - Resets team fouls to 0 for the new period (per FIBA/NBA rules).
  - Carries forward player personal fouls across all periods and overtimes.

### 8. `complete_basketball_match(p_match_id UUID)` (`PROPOSED`)
- Validates match has completed all regulation (or overtime) periods.
- Sets `matches.status = 'COMPLETED'`, `matches.winner_side`, and `matches.result_summary` (e.g. `'Lakers won 102 - 98'`).

---

## 8. Game-Clock and Period Architecture (`PROPOSED`)

### Server vs. Client Clock Authority Model
In basketball, clock precision is paramount. Relying entirely on client intervals leads to clock drift across tabs and mobile battery savers.
1. **Server-Authoritative Elapsed Time:**
   - When the clock is running, the authoritative database state is:
     - `time_remaining_seconds`: Remaining seconds when the clock started.
     - `clock_last_started_at`: Exact server timestamp when the clock started.
     - `clock_status`: `'RUNNING'`.
   - Any client calculates authoritative remaining time at timestamp $T$ as:
     $$\text{Remaining}(T) = \max\left(0, \text{time\_remaining\_seconds} - \left\lfloor\frac{T - \text{clock\_last\_started\_at}}{1000}\right\rfloor\right)$$
2. **Scorer Actions Stop the Clock:**
   - When a whistle blows or score/foul occurs, the scorer presses "Pause" or records an event.
   - The RPC updates `time_remaining_seconds` based on `NOW() - clock_last_started_at`, freezes the clock at `'STOPPED'`, and broadcasts the new state via Realtime.
3. **Hard Refresh & Reconnect Recovery:**
   - When a spectator refreshes, the formula above instantly computes the exact current game time without needing to poll or query past ticks.

---

## 9. Realtime and Public Live Centre Design (`PROPOSED`)

### Architecture
- **Supabase Realtime Subscriptions:**
  - `basketball_periods`: Broadcasts score changes, quarter transitions, and clock start/pause states.
  - `basketball_events`: Broadcasts play-by-play ticker updates to spectators.
- **Spectator UI (`BasketballLiveMatchCentre.tsx`):**
  - **Scoreboard Banner:** Team names, logos, total score, quarter indicator (`Q1`, `Q2`, `Q3`, `Q4`, `OT1`), and ticking game clock.
  - **Quarter Box Score:** Quarter-by-quarter points breakdown (e.g., `Q1: 24-20`, `Q2: 28-30`, etc.).
  - **Team Fouls Indicator:** Displays team fouls for the active quarter and flags "BONUS" when penalty free throws are active.
  - **Live Play-by-Play:** Reverse-chronological event feed (e.g., `"Alice made 3-pt shot (45 - 40)"`, `"Bob personal foul (2nd)"`).
  - **Box Score Tab:** Points, field goals, and fouls per player.

---

## 10. Security, RLS, RBAC, and Tenant Isolation Plan (`PROPOSED`)

1. **Organization-Scoped Tenant Isolation:**
   - Inherits `matches.organization_id`. Matches belong strictly to an organization.
   - Cross-tenant scorers from Organization B cannot mutate Organization A basketball matches.
2. **Row Level Security (RLS) Policies:**
   - **`basketball_periods`:**
     - `SELECT`: Allowed for public spectators if `matches.status != 'DRAFT'`, or for organization members.
     - `INSERT / UPDATE / DELETE`: Restricted strictly to authorized organization scorers and managers via RPCs.
   - **`basketball_events`:**
     - `SELECT`: Public read for published matches.
     - `INSERT`: Permitted only through verified RPCs.
3. **Cross-Sport Security Invariant:**
   - All basketball RPCs must verify:
     ```sql
     IF v_match.sport_slug != 'basketball' THEN
       RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match.';
     END IF;
     ```
   - Prevents accidental or malicious execution of basketball scoring procedures against Cricket or Badminton matches.

---

## 11. Proposed Route and Component Structure (`PROPOSED`)

Following established conventions in `apps/web/`:
```
apps/web/src/
├── app/
│   └── matches/
│       └── [id]/
│           ├── live/
│           │   └── page.tsx                      # Update: dispatch basketball to BasketballLiveMatchCentre
│           └── score/
│               └── basketball/
│                   └── page.tsx                  # New: Server component with auth check -> renders BasketballScorer
├── components/
│   └── matches/
│       ├── BasketballScorer.tsx                  # New: Court-side scoring UI with big buttons, clock controls, foul counters
│       ├── BasketballLiveMatchCentre.tsx          # New: Public spectator real-time scoreboard & box-score
│       ├── BasketballScoreboard.tsx              # New: Reusable quarter & team score display
│       ├── BasketballClockControl.tsx            # New: Pause/Start/Set game clock component
│       ├── BasketballLineupModal.tsx             # New: Quick player substitution dialog
│       └── BasketballBoxScore.tsx                # New: Detailed player statistics table
└── lib/
    └── matches/
        └── basketball-queries.ts                 # New: Scorecard fetching & event formatting helpers
```

---

## 12. Future Test Matrix (`PROPOSED`)

| Test Suite Category | Target Coverage | Expected Evidence |
| :--- | :--- | :--- |
| **Schema & Constraints** | `basketball_periods`, `events`, `lineups` | Foreign keys, unique sequence numbers, RLS enabled. |
| **Scoring Rules** | 1pt, 2pt, 3pt, aggregate totals | Correct point values added to team and player tallies. |
| **Fouls & Foul-Out** | Personal & team fouls, 5th foul disqualification | Player flagged fouled out; team entered into bonus. |
| **Game Clock & Periods** | Start, pause, elapsed calculation, quarter transition | Clock calculations match elapsed server time; Q1..Q4 progression. |
| **Overtime on Tie** | Regulation ends tied | Overtime period created; game stays in progress until winner. |
| **Idempotency & Concurrency** | Duplicate `client_event_id`, concurrent requests | Exactly one event logged; scores never double-counted. |
| **Undo & Corrections** | Reversing points and fouls | Points deducted; player fouls decremented; timestamps logged. |
| **Security & RLS** | Multi-role & cross-tenant checks | Customer / Org B rejected; anonymous spectator read-only. |
| **Cross-Sport Defense** | Calling basketball RPC on Cricket/Badminton ID | Throws `INVALID_SPORT` error. |
| **Realtime E2E (Playwright)** | Scorer tab vs. Spectator tab | Sub-second WebSocket delivery; clock sync across tabs. |
| **Cricket & Badminton Regression** | Frozen test suites | 36/36 Cricket tests passing; 57/57 Badminton tests passing. |

---

## 13. Phased Implementation Plan

Basketball implementation is broken into 8 sequential, independently verifiable steps:

```
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20A: Basketball Product Decisions & Configuration Spec │
  └──────────────────────────────┬───────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20B: Database Foundation (Tables, RLS, Constraints)     │
  └──────────────────────────────┬───────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20C: Server-Authoritative Scoring & Game-Clock RPCs     │
  └──────────────────────────────┬───────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20D: Basketball Court-Side Scorer UI                    │
  └──────────────────────────────┬───────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20E: Lineups, Substitutions, Fouls & Player Stats       │
  └──────────────────────────────┬───────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20F: Public Basketball Live Centre & Realtime Broadcast │
  └──────────────────────────────┬───────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20G: Real-World E2E, Multi-Tenant Security & Regression │
  └──────────────────────────────┬───────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ STEP 20H: Basketball Release Readiness & Final Sign-off      │
  └──────────────────────────────────────────────────────────────┘
```

1. **STEP 20A — Basketball Product Decisions & Configuration Spec:**
   - Formalize default quarter lengths, foul-out limits, running vs stop clock, and confirmation of deferred features (shot clock, advanced box-score stats).
2. **STEP 20B — Basketball Database Foundation:**
   - Create migration `20261001000033_basketball_schema.sql` defining `basketball_periods`, `basketball_events`, `basketball_lineups`, RLS policies, and enable `supports_live_scoring` in `sports`.
3. **STEP 20C — Atomic Scoring & Game-Clock Backend:**
   - Create migration `20261001000034_basketball_rpc.sql` containing `init_basketball_match`, `record_basketball_score`, `record_basketball_foul`, `update_basketball_clock`, `progress_basketball_period`, and `undo_basketball_event`.
4. **STEP 20D — Basketball Scorer UI:**
   - Implement route `/matches/[id]/score/basketball` and component `<BasketballScorer />` with big tap buttons for points and foul logging.
5. **STEP 20E — Lineups, Substitutions & Player Statistics:**
   - Add lineup management modal, substitution tracking, foul-out enforcement, and player box-score calculation.
6. **STEP 20F — Public Basketball Live Centre & Realtime Broadcast:**
   - Implement `<BasketballLiveMatchCentre />`, add tables to `supabase_realtime`, and update `/matches/[id]/live/page.tsx` sport dispatch.
7. **STEP 20G — Real-World E2E, Security & Regression Audit:**
   - Playwright E2E dual-browser tests, cross-tenant isolation verification, and complete Cricket (36/36) & Badminton (57/57) regression runs.
8. **STEP 20H — Release Readiness & Final Sign-off:**
   - Production build audit, monorepo typecheck/lint, and final production-readiness report.

---

## 14. Risks, Open Product Decisions, and Dependencies

1. **Risk — Clock Drift Across Mobile Browsers:**
   - *Mitigation:* Employ the proposed server-authoritative elapsed timestamp formula rather than local `setInterval` counts.
2. **Risk — Scorer Cognitive Overload:**
   - *Mitigation:* Keep the initial court-side scoring interface stripped down to points, fouls, timeouts, and substitutions. Avoid requiring shot coordinates or complex rebound categories in Phase 1.
3. **Dependency — Team Roster Population:**
   - *Mitigation:* Ensure matches configured as `format = 'TEAM'` have valid participants in `match_participants` before transitioning to `LIVE`.
4. **Safety Confirmation:**
   - No schema changes or code changes were made in this step. The system remains 100% frozen and clean.

---

## 15. Explicit Audit Confirmation

- **No Implementation Performed:** Zero Basketball UI, APIs, RPCs, scoring logic, tables, or migrations were created.
- **Cricket Module:** 100% untouched and frozen.
- **Badminton Module:** 100% untouched and frozen.
- **Database Schema:** 100% untouched; zero destructive actions executed.

---

## 16. Stop Condition & Final Conclusion

The Basketball architecture and database design audit is complete. The system is thoroughly understood, the integration boundaries are clear, and the 8-step phased implementation plan is prepared for execution when authorized.
