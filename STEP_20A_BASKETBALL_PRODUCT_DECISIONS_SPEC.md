# SPORTSHUB STEP 20A — Basketball Product Decisions & Configuration Specification

**Date:** 2026-10-07  
**Branch:** `main`  
**Latest Baseline Commit:** `85544f4891d38b3a3757a84b9b2cc11e21cb9e10`  
**Step Objective:** Define and freeze all product rules, MVP scope, configurable competition settings, scoring mechanics, game-clock behavior, roster/lineup rules, foul/penalty systems, substitution logic, overtime rules, statistics boundaries, and future-phase roadmaps for the SportsHub Basketball module.  
**Step Invariant:** PRODUCT SPECIFICATION AND DECISION-FREEZING ONLY. Zero changes made to code, database, migrations, or frozen sports.  
**Author:** Antigravity Pair Programmer  

---

## 1. Executive Summary

This document serves as the authoritative, frozen product specification for the SportsHub Basketball scoring and match management module. 

Following the architectural audit in STEP 19, this specification establishes the exact business rules, state machines, operational constraints, and database expectations for the upcoming database foundation (STEP 20B) and server-authoritative backend (STEP 20C).

All decisions are categorized using the strict taxonomy:
- **`VERIFIED`**: Existing repository or database fact.
- **`DECIDED`**: Product decision frozen in this specification for the MVP.
- **`CONFIGURABLE`**: Parameter customizable per competition or match via JSON configuration.
- **`PHASE 2`**: Feature intentionally deferred to maintain high delivery quality and avoid operational bloat.
- **`NEEDS CONFIRMATION`**: Specific open question requiring user/product sign-off.

---

## 2. Repository and STEP 19 Verification

- **Repository Root:** `F:/SPORTS HUB` (`VERIFIED`)
- **Current Git Branch:** `main` (`VERIFIED`)
- **Current Commit Hash:** `85544f4891d38b3a3757a84b9b2cc11e21cb9e10` (`VERIFIED`)
- **Working-Tree Status:** Clean of unauthorized changes; includes verified reports from STEP 16H through STEP 19 (`VERIFIED`).
- **STEP 19 Foundation Report:** `STEP_19_BASKETBALL_ARCHITECTURE_DATABASE_AUDIT_REPORT.md` is present and verified (`VERIFIED`).
- **Core Platform Capabilities:**
  - `public.sports` has `slug = 'basketball'` with `supports_team = true` and `supports_live_scoring = false` (`VERIFIED`).
  - `matches`, `match_competitors`, and `match_participants` support multi-tenant ownership, format enforcement, and lifecycle state machines (`DRAFT` → `SCHEDULED` → `WARMUP` → `LIVE` → `PAUSED` → `COMPLETED`) (`VERIFIED`).
  - Cricket (36/36 tests passing) and Badminton (57/57 tests passing) are 100% frozen and isolated (`VERIFIED`).

---

## 3. Product Goals & Target Venues

SportsHub Basketball is designed as a court-side, mobile-first, server-authoritative scoring solution tailored for:
1. Multi-sport recreational and commercial indoor arenas.
2. Amateur basketball leagues and corporate tournaments.
3. School and collegiate athletic programs.
4. Casual pickup matches and weekend club competitions.

### Primary Release Priorities (`DECIDED`)
- **Reliable Scoring:** Fast, tap-based recording of 1-pt, 2-pt, and 3-pt shots with zero duplicate events under intermittent connectivity.
- **Authoritative Game Clock:** Server-calculated remaining match time preventing client timer drift.
- **Fouls & Foul-Out Tracking:** Automatic personal and team foul calculation with configurable foul-out disqualification.
- **Seamless Substitutions:** Intuitive 5-player active lineup swapping during dead-ball intervals.
- **Sub-Second Spectator Experience:** Instantaneous Realtime WebSocket score updates to unauthenticated fans.
- **Tenant Isolation & Security:** Multi-role RBAC ensuring only authorized organization scorers can mutate match state.

---

## 4. Basketball Format Decision

### A. Primary MVP Format: 5v5 Basketball (`DECIDED`)
- **Team Format:** Two competing sides (`SIDE_A` and `SIDE_B`) linked to registered `public.teams` via `match_competitors`.
- **On-Court Lineup:** Exactly 5 active players on court per team during live play.
- **Bench / Roster:** 0 to 10 substitute players per team (total match roster: 5 to 15 players).
- **Starting Lineup Requirement:** Prior to transitioning match from `SCHEDULED`/`WARMUP` to `LIVE`, exactly 5 starting players per side must be designated.
- **Format Enum:** Stored as `matches.match_format = 'TEAM'`.

### B. 3x3 Basketball Format: Phase 2 Evaluation (`PHASE 2`)
- **Analysis:** FIBA 3x3 uses half-court play, 10-minute game duration, 12-second shot clock, 1-point and 2-point scoring, and a sudden-death 21-point victory condition.
- **Decision:** **Deferred to Phase 2.** Attempting to merge 3x3 victory logic and shot clocks into the 5v5 MVP would add severe branching complexity to scoring procedures. 
- **Future Compatibility:** The 5v5 architecture preserves compatibility by storing format-specific parameters in `matches.metadata->'basketball_config'`.

---

## 5. Period Structure

### A. Regulation Periods (`DECIDED`)
- **Default Structure:** 4 Quarters (`Q1`, `Q2`, `Q3`, `Q4`).
- **Ordering & Numbering:** Sequential integer `period_number` (1 to 4 for regulation; 5+ for Overtime).
- **Halftime:** Occurs between Q2 and Q3.
- **Period Completion:** A quarter finishes when `time_remaining_seconds = 0` and the scorer confirms period conclusion.
- **Quarter Progression:** Scorer advances period via `progress_basketball_period`.

### B. Configurable Duration (`CONFIGURABLE`)
- **Parameter:** `period_duration_seconds` in `basketball_config`.
- **Default Value:** **600 seconds (10 minutes)** — the FIBA amateur standard.
- **Allowed Range:** 300 seconds (5 mins) to 1200 seconds (20 mins).
- **Uniformity:** All 4 regulation quarters use identical duration.

### C. Overtime Periods (`DECIDED` & `CONFIGURABLE`)
- **Trigger:** If scores are tied at the conclusion of Q4, Overtime is required (when `overtime_enabled = true`).
- **Overtime Numbering:** Sequential starting at `period_number = 5` (`OT1`), `6` (`OT2`), etc.
- **Overtime Duration (`CONFIGURABLE`):** `overtime_duration_seconds`.
  - **Default:** **300 seconds (5 minutes)**.
  - **Allowed Range:** 180 seconds (3 mins) to 300 seconds (5 mins).
- **Tied Overtime:** If scores remain tied at the end of an Overtime period, successive overtimes are played until a winner emerges.

---

## 6. Game Clock Rules

### A. Clock Authority Model (`DECIDED`)
The client browser is **never the authoritative source of match time**. The PostgreSQL database maintains the authoritative clock state.

### B. Clock States (`DECIDED`)
1. **`STOPPED`**: Clock is paused (during whistles, fouls, free throws, timeouts, quarter breaks).
2. **`RUNNING`**: Clock is actively counting down.
3. **`EXPIRED`**: Clock reached `0:00` for the current period.

### C. Server-Authoritative Elapsed Time Formula (`DECIDED`)
When `clock_status = 'RUNNING'`, the server records `clock_last_started_at = NOW()`. Any client or server process calculates authoritative remaining time at timestamp $T$ as:
$$\text{Remaining}(T) = \max\left(0, \text{time\_remaining\_seconds} - \left\lfloor\frac{T - \text{clock\_last\_started\_at}}{1000}\right\rfloor\right)$$

### D. Scorer Clock Operations (`DECIDED`)
- **`START`**: Sets `clock_status = 'RUNNING'`, `clock_last_started_at = NOW()`.
- **`PAUSE`**: Computes elapsed seconds since `clock_last_started_at`, subtracts from `time_remaining_seconds`, sets `clock_status = 'STOPPED'`, and clears `clock_last_started_at`.
- **`SET_TIME`**: Allows authorized scorer to adjust clock seconds to reconcile with physical scoreboard or referee instructions.

### E. Hard Refresh & Reconnect Recovery (`DECIDED`)
When a scorer or spectator browser refreshes or wakes from sleep:
1. Client fetches authoritative `basketball_periods` record.
2. Applies formula above using local client clock offset from server timestamp.
3. Instantly displays exact ticking game clock without polling.

---

## 7. Shot Clock Decision

### Frozen Decision: **PHASE 2 (DEFERRED)** (`PHASE 2`)
- **Rationale:** 
  1. Amateur venues and recreational leagues almost never have physical shot-clock hardware or dedicated shot-clock operators.
  2. Forcing a single court-side mobile scorer to manage score, fouls, game clock, and a 24-second/14-second reset countdown creates unacceptable cognitive overload and high error rates.
- **Architectural Preservation:**
  - `basketball_events` metadata column will support future `{ shot_clock_remaining: 14 }` payloads.
  - No shot-clock tables or countdown constraints will be built during MVP.

---

## 8. Scoring Rules

### A. Point Values (`DECIDED`)
1. **1 Point:** Free Throw Made (`FREE_THROW_1PT`).
2. **2 Points:** 2-Point Field Goal Made (`FIELD_GOAL_2PT`) — layups, jump shots inside the arc, dunks.
3. **3 Points:** 3-Point Field Goal Made (`FIELD_GOAL_3PT`) — shots behind the arc.

### B. Scoring Event Attributes (`DECIDED`)
Every scoring event logged in `basketball_events` contains:
- `match_id` & `period_id`
- `sequence_number` (Strictly sequential per period)
- `client_event_id` (UUID idempotency key generated by client)
- `side` (`SIDE_A` or `SIDE_B`)
- `competitor_id` & `participant_id` (Player credited)
- `event_type` (`FIELD_GOAL_2PT`, `FIELD_GOAL_3PT`, `FREE_THROW_1PT`)
- `points` (1, 2, or 3)
- `game_clock_seconds` (Remaining time at point of score)
- `metadata` (`{ is_fast_break: boolean }`)

### C. Missed Shot Tracking (`PHASE 2`)
- **Decision:** Missed field goals and missed free throws are **excluded from MVP**.
- **Rationale:** Logging every missed shot requires a dedicated statistician. MVP prioritizes authoritative scorekeeper tasks.

---

## 9. Score Consistency & Reconciliation

### A. Zero Arbitrary Client Scores (`DECIDED`)
- The client UI **cannot directly write or override** team score totals.
- All score changes occur exclusively through database RPCs that append to `basketball_events`.

### B. Projection and Reconciliation Flow (`DECIDED`)
```
  [ Scorer Clicks Point ]
            │
            ▼
  RPC: record_basketball_score
            │
            ├─► 1. INSERT INTO basketball_events (Authoritative Ledger)
            ├─► 2. UPDATE basketball_periods (Aggregate Period Score)
            ├─► 3. UPDATE basketball_lineups (Player Points Tally)
            └─► 4. UPDATE matches.metadata (Match Total & Result Summary)
```
- If an event is undone via `undo_basketball_event`, points are decremented across all projections in the same atomic database transaction.

---

## 10. Player Statistics — MVP vs Phase 2

### A. MVP Player Statistics (`DECIDED`)
| Statistic | Classification | Method of Derivation |
| :--- | :--- | :--- |
| **Points Scored (PTS)** | `DECIDED` (MVP) | Sum of points from active scoring events for participant. |
| **Personal Fouls (PF)** | `DECIDED` (MVP) | Count of personal fouls logged for participant. |
| **Technical Fouls (TF)** | `DECIDED` (MVP) | Count of technical fouls logged for participant. |
| **Foul-Out Status** | `DECIDED` (MVP) | Boolean flag `is_fouled_out` when fouls reach limit. |
| **Minutes Played (MIN)** | `PHASE 2` | Computed from substitution intervals. Deferred to Phase 2. |

### B. Advanced Box-Score Statistics (`PHASE 2`)
- Offensive & Defensive Rebounds (REB)
- Assists (AST)
- Steals (STL)
- Blocks (BLK)
- Turnovers (TO)
- Field Goal Attempts & Percentages (FGA / FG%)
- Free Throw Attempts & Percentages (FTA / FT%)
*All deferred to Phase 2 to ensure rapid, error-free MVP scoring.*

---

## 11. Team Statistics — MVP

### MVP Team Metrics (`DECIDED`)
1. **Total Team Score:** Sum of points across all periods.
2. **Period Scores:** Individual score totals for Q1, Q2, Q3, Q4, and OT periods.
3. **Team Fouls (Current Period):** Total personal/technical fouls committed by team members in the active period.
4. **Bonus / Penalty Status:** Calculated when team fouls $\ge$ `team_foul_penalty_threshold`.
5. **Timeouts Remaining:** Current count of timeouts available for the half/period.

---

## 12. Foul System

### A. Personal Fouls (`DECIDED`)
- Attributed to an active on-court player (`participant_id`).
- Increments the player's personal foul count.
- Increments the team's period foul count (`side_a_fouls` or `side_b_fouls`).

### B. Team Fouls & Reset (`DECIDED`)
- Team fouls accumulate during each regulation quarter.
- **Period Reset:** At the start of Q2, Q3, Q4, and Overtime, team fouls automatically reset to 0 (per FIBA/NBA standard).
- Player personal fouls **never reset**; they persist across the entire match.

### C. Bonus / Penalty Free-Throw Threshold (`CONFIGURABLE`)
- **Parameter:** `team_foul_penalty_threshold` in `basketball_config`.
- **Default:** **5 team fouls per quarter**.
- **Behavior:** When a team commits its 5th foul in a quarter, the spectator and scorer interfaces display the "BONUS" flag.

### D. Foul-Out Enforcement (`DECIDED` & `CONFIGURABLE`)
- **Parameter:** `foul_out_limit` in `basketball_config`.
- **Default:** **5 personal fouls** (FIBA standard for 10-minute quarters).
- **Configurable Alternative:** 6 personal fouls (NBA / 12-minute quarter standard).
- **Enforcement:**
  - When a player reaches the foul limit, database RPC sets `is_fouled_out = true` and `is_on_court = false`.
  - Scorer UI marks player as "FOULED OUT".
  - System rejects any substitution attempting to return that player to the court.

---

## 13. Free Throw Handling

### Single-Shot Recording Model (`DECIDED`)
- Scorer records free throws individually:
  - Free Throw 1: Tap "+1 FT" (logs 1 point, credits shooter).
  - Free Throw 2: Tap "+1 FT" (logs 1 point, credits shooter).
- **Rationale:** Maximum auditability. If the shooter makes 1 of 2 free throws, the scorer logs exactly what occurred without complex UI modals.

---

## 14. Substitutions

### Substitution Invariants (`DECIDED`)
1. **Dead-Ball Only:** Substitutions may only be logged when `clock_status = 'STOPPED'` (during pauses, timeouts, or quarter breaks).
2. **5-Player Invariant:** Each side must have exactly 5 players marked `is_on_court = true`.
3. **Roster Validation:** The incoming player must belong to the match roster (`match_participants`) for that side.
4. **Foul-Out Prohibition:** An incoming player must not have `is_fouled_out = true`.
5. **Single-Action Swap:** Scorer selects on-court player to exit and bench player to enter, executing an atomic database swap.

---

## 15. Timeouts

### Timeout Rules (`DECIDED` & `CONFIGURABLE`)
- **Tracking:** Each team has a remaining timeout counter.
- **Action:** Scorer taps "Timeout Team A/B":
  - Game clock automatically pauses (`clock_status = 'STOPPED'`).
  - Appends `TIMEOUT` event to `basketball_events`.
  - Decrements available timeouts for that team.
- **Configurable Allocation (`CONFIGURABLE`):**
  - `timeouts_per_team_regulation`: Default **4 timeouts per match** (or 2 per half).
  - `timeouts_per_team_overtime`: Default **1 timeout per overtime period**.

---

## 16. Match Lifecycle Alignment

Aligned with SportsHub `match_status` enum:

| Status | Basketball Operational State | Permitted Actions |
| :--- | :--- | :--- |
| **`DRAFT`** | Match created, teams assigned. | Roster entry, configuration edits. |
| **`SCHEDULED`** | Roster validated, match scheduled. | Confirming starting 5 lineups. |
| **`WARMUP`** | Pre-game warmups on court. | Lineup verification, coin toss/possession check. |
| **`LIVE`** | Q1 active, clock ready. | Scoring, fouls, clock start/pause, substitutions, timeouts. |
| **`PAUSED`** | Halftime or referee stoppage. | Substitutions, clock adjustments. |
| **`COMPLETED`** | Final quarter or OT concluded. | Scorecard viewing. All mutations locked. |
| **`ABANDONED`** | Match terminated due to incident. | Locked terminal state. |
| **`CANCELLED`** | Match called off before start. | Locked terminal state. |

---

## 17. Match Completion & Winner Determination

### Completion Rules (`DECIDED`)
1. **Regulation End (Q4):**
   - If Q4 time expires and Side A score $\ne$ Side B score:
     - Match marks `COMPLETED`.
     - `winner_side` set to higher score (`SIDE_A` or `SIDE_B`).
     - `result_summary` formatted as: `"{Winner Name} won {A_Score} - {B_Score}"`.
2. **Regulation Tie (Q4):**
   - If scores are tied and `overtime_enabled = true`:
     - Match remains in progress (`status = 'LIVE'`).
     - Period progresses to `OT1` (`period_number = 5`, `time_remaining = 300s`).
3. **Terminal Invariant:**
   - Once marked `COMPLETED`, subsequent scoring, foul, or clock mutations are rejected with `INVALID_STATE: Match is already completed.`

---

## 18. Undo / Correction Policy

### Frozen Approach: Option A — Undo Latest Active Event (`DECIDED`)
- **Mechanism:**
  - Scorer clicks "Undo Last Action".
  - Scorer confirms action in a modal.
  - RPC finds the latest event where `voided_at IS NULL` for the active period.
  - Sets `voided_at = NOW()`.
  - Atomically reverses points, fouls, or substitution state.
- **Justification:**
  - Consistent with the proven, bug-free undo architectures in Cricket (`undo_cricket_delivery`) and Badminton (`undo_badminton_rally`).
  - Arbitrary historical event editing creates desynchronization cascades (e.g. undoing a foul from Q1 after player fouled out in Q4). Option A is rock-solid and auditable.

---

## 19. Idempotency and Concurrency

### Invariant Rules (`DECIDED`)
1. **Client Event UUID:** Every event submission includes a `p_client_event_id UUID`.
   - If the database detects an existing event with the same `(match_id, client_event_id)`, it returns the existing record idempotently without double-counting points.
2. **PostgreSQL Row Locking:**
   - All scoring, foul, clock, and progression RPCs lock the match row via:
     ```sql
     SELECT m.*, s.slug FROM public.matches m JOIN public.sports s ON s.id = m.sport_id WHERE m.id = p_match_id FOR UPDATE OF m;
     ```
   - Guarantees sequential serialization of concurrent scorer taps.

---

## 20. Roster & Lineup Rules

### Invariant Rules (`DECIDED`)
1. **Roster Size:** Minimum 5 players per team; maximum 15 players.
2. **Lineup Validation:** Exactly 5 active on-court players per side.
3. **No Dual-Roster Players:** A player cannot appear on both Side A and Side B for the same match (enforced by `idx_match_participants_unique_user`).
4. **Jersey Numbers:** Unique per team in the range `0..999`.

---

## 21. Public Scorecard Requirements

### Spectator Live Centre Display (`DECIDED`)
- **Scoreboard:** Team names, team logos, total scores, active period badge (`Q1`, `Q2`, `Q3`, `Q4`, `OT1`), and running game clock.
- **Quarter Breakdown Table:** Points scored per quarter for each team.
- **Team Fouls & Bonus Indicator:** Shows period team fouls and highlights "BONUS" when active.
- **Top Scorers Leaderboard:** Top 3 scorers per team with points and field goal tallies.
- **Play-by-Play Feed:** Reverse-chronological timeline of made shots, fouls, timeouts, and substitutions.
- **Privacy Enforcement:** No internal member emails, user IDs, or administrative notes exposed to spectators.

---

## 22. Realtime Requirements

### Supabase Realtime Pub/Sub Channels (`DECIDED`)
1. `realtime:public:basketball_periods:match_id=eq.{matchId}`: Broadcasts clock state, time remaining, period transitions, and aggregate score changes.
2. `realtime:public:basketball_events:match_id=eq.{matchId}`: Broadcasts play-by-play events for live spectator ticker.
3. **Resilience Pattern:**
   - On page mount or network reconnect: Client executes authoritative REST fetch of `get_basketball_scorecard`.
   - Client attaches WebSocket listener.
   - On component unmount: All channels are explicitly removed via `supabase.removeChannel()`.

---

## 23. Mobile-First Scorer Requirements

### UX Design Rules (`DECIDED`)
1. **Big-Button Layout:** Oversized buttons for `+1 Free Throw`, `+2 Field Goal`, `+3 Field Goal`, `Foul`, and `Clock Toggle`.
2. **Single-Tap Workflow:** Tapping `+2` prompts quick active-player selection (5 player buttons on screen), recording the score in 2 taps total.
3. **Prominent Clock:** Large, high-contrast clock with instant "Start / Stop" toggle button.
4. **Safety Guards:** Destructive actions ("Undo", "End Quarter", "Finalize Match") require confirmation dialogs.

---

## 24. Scope Matrix: MVP vs. Phase 2

| Feature / Capability | Classification | Scope | Implementation Phase |
| :--- | :--- | :--- | :--- |
| **5v5 Team Format** | `DECIDED` | In Scope | **MVP (STEP 20B–20D)** |
| **1-pt, 2-pt, 3-pt Scoring** | `DECIDED` | In Scope | **MVP (STEP 20B–20C)** |
| **Server-Authoritative Clock** | `DECIDED` | In Scope | **MVP (STEP 20C)** |
| **4 Quarters & Overtime** | `DECIDED` | In Scope | **MVP (STEP 20B–20C)** |
| **Configurable Quarter Duration** | `CONFIGURABLE` | In Scope | **MVP (STEP 20B)** |
| **Personal & Team Fouls** | `DECIDED` | In Scope | **MVP (STEP 20B–20E)** |
| **Foul-Out Disqualification** | `DECIDED` | In Scope | **MVP (STEP 20E)** |
| **Player Substitutions (5v5)** | `DECIDED` | In Scope | **MVP (STEP 20E)** |
| **Timeouts Tracking** | `DECIDED` | In Scope | **MVP (STEP 20C)** |
| **Single-Event Undo** | `DECIDED` | In Scope | **MVP (STEP 20C)** |
| **Public Live Centre & Realtime** | `DECIDED` | In Scope | **MVP (STEP 20F)** |
| **3x3 Basketball Format** | `PHASE 2` | Out of Scope | Phase 2 |
| **24s / 14s Shot Clock** | `PHASE 2` | Out of Scope | Phase 2 |
| **Missed Shot Tracking** | `PHASE 2` | Out of Scope | Phase 2 |
| **Rebounds, Assists, Steals, Blocks** | `PHASE 2` | Out of Scope | Phase 2 |
| **Turnovers & Shooting %** | `PHASE 2` | Out of Scope | Phase 2 |
| **Minutes Played Tracking** | `PHASE 2` | Out of Scope | Phase 2 |

---

## 25. Configuration Model (`CONFIGURABLE`)

The match configuration object is stored in `matches.metadata->'basketball_config'`.

### Conceptual Configuration Schema (`CONFIGURABLE`)
```json
{
  "format": "5V5",
  "players_on_court": 5,
  "regulation_period_count": 4,
  "period_duration_seconds": 600,
  "overtime_enabled": true,
  "overtime_duration_seconds": 300,
  "foul_out_limit": 5,
  "team_foul_penalty_threshold": 5,
  "timeouts_per_team_regulation": 4,
  "timeouts_per_team_overtime": 1,
  "shot_clock_enabled": false
}
```

### Parameter Rules & Constraints (`CONFIGURABLE`)
| Field | Type | Default | Valid Range | Mutability After Match Starts |
| :--- | :--- | :--- | :--- | :--- |
| `format` | string | `"5V5"` | `"5V5"`, `"3X3"` | **IMMUTABLE** |
| `players_on_court` | integer | `5` | `3` to `5` | **IMMUTABLE** |
| `regulation_period_count` | integer | `4` | `2` or `4` | **IMMUTABLE** |
| `period_duration_seconds` | integer | `600` | `300` to `1200` | **IMMUTABLE** |
| `overtime_enabled` | boolean | `true` | `true`, `false` | **IMMUTABLE** |
| `overtime_duration_seconds` | integer | `300` | `180` to `300` | **IMMUTABLE** |
| `foul_out_limit` | integer | `5` | `4` to `6` | **IMMUTABLE** |
| `team_foul_penalty_threshold`| integer | `5` | `4` to `7` | **IMMUTABLE** |
| `timeouts_per_team_regulation`| integer | `4` | `2` to `7` | **IMMUTABLE** |

*Rule:* Configuration parameters are strictly immutable once `matches.status` transitions from `WARMUP` to `LIVE`.

---

## 26. Product Invariants

The Basketball module enforces the following immutable system invariants:
1. **Sport Invariant:** A Basketball match cannot be scored using Cricket or Badminton RPCs; conversely, Basketball RPCs strictly reject Cricket and Badminton match IDs (`INVALID_SPORT`).
2. **RBAC Invariant:** Only authorized scorers (`scorer_user_id`), organization managers, or owners can execute scoring, clock, or progression mutations.
3. **Customer & Public Invariant:** Customer accounts and unauthenticated anonymous spectators have strictly read-only access to published matches.
4. **Cross-Tenant Invariant:** Scorers belonging to Organization B cannot view draft matches or execute mutations on Organization A matches.
5. **Score Non-Negativity:** Scores and points cannot be negative at any time.
6. **Strict 5-Player Lineup:** Neither team can have fewer than or more than 5 players active on court while the clock is running.
7. **Disqualification Invariant:** A player marked `is_fouled_out = true` cannot be substituted back into active play.
8. **Clock Authority:** The client browser is never authoritative for elapsed game time.
9. **Forward-Only Progression:** Periods cannot move backward during standard match progression (Q1 → Q2 → Q3 → Q4 → OT1).
10. **Terminal Immutability:** Once a match reaches `COMPLETED`, all further scoring, foul, clock, or progression mutations are rejected.
11. **Idempotent Mutations:** Duplicate event submissions bearing the same `client_event_id` return the existing event without re-incrementing scores.
12. **Auditability:** Undo actions mark events `voided_at = NOW()` rather than performing destructive physical row deletions.

---

## 27. Open Product Decisions (`NEEDS CONFIRMATION`)

All primary MVP parameters have been resolved with recommended standards. The following two secondary options are marked for product confirmation:

1. **Timeout Model — Half-based vs. Match-based (`NEEDS CONFIRMATION`):**
   - *Option A (Recommended):* Total pool of 4 timeouts per team for the entire regulation match (simplest for court-side scorer).
   - *Option B (FIBA Strict):* 2 timeouts in the 1st half (Q1-Q2) and 3 timeouts in the 2nd half (Q3-Q4), with unused timeouts expiring at halftime.
   - *Impact on MVP:* Option A is recommended for initial implementation as it eliminates halftime timeout reset logic.
2. **Draw / Tie Support in Recreational Leagues (`NEEDS CONFIRMATION`):**
   - *Question:* Should casual league competitions allow matches to end in a DRAW at the end of Q4 if `overtime_enabled = false`?
   - *Recommended Default:* Yes. If `overtime_enabled = false` and Q4 ends tied, `matches.winner_side` is recorded as `'DRAW'`, compatible with the existing `matches.chk_matches_winner_side` constraint.

---

## 28. Future Implementation Dependencies

The implementation will proceed through the sequential phases mapped in STEP 19:

```
  ┌─────────────────────────────────────────────────────────────┐
  │ STEP 20B: Database Foundation (Tables, Constraints, RLS)    │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ STEP 20C: Server-Authoritative Scoring & Game Clock Backend │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ STEP 20D: Court-Side Scorer UI                              │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ STEP 20E: Lineups, Substitutions & Player Statistics        │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ STEP 20F: Public Live Centre & Realtime Broadcast           │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ STEP 20G: Real-World Dual-Browser E2E & Full Regression     │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ STEP 20H: Release Readiness & Final Sign-off                │
  └─────────────────────────────────────────────────────────────┘
```

---

## 29. Backward Compatibility & Frozen Sports Protection

1. **Cricket Module Protection (`VERIFIED`):**
   - Cricket migrations (`26`–`29`), scoring RPCs, scorecard generators, and components remain 100% frozen.
   - The established 36/36 Cricket regression test suite will be executed in all future test checkpoints.
2. **Badminton Module Protection (`VERIFIED`):**
   - Badminton migrations (`30`–`32`), scoring RPCs, progression logic, and components remain 100% frozen.
   - The established 57/57 Badminton test suite will be executed in all future test checkpoints.
3. **Route Safety (`VERIFIED`):**
   - The shared `/matches/[id]/live` router will add a discrete `if (sportSlug === 'basketball')` branch without modifying existing Cricket or Badminton branches.

---

## 30. Required Git Safety Check

- `git status --short`: Executed. Confirmed zero Basketball implementation files, zero new migrations, and zero edits to Cricket or Badminton.
- `git diff --stat`: 0 diffs in Cricket, Badminton, or database schemas.
- Working tree remains clean of unauthorized changes.

---

## 31. Explicit Confirmation of No Implementation

- **Zero Migrations Created.**
- **Zero Database Tables Created.**
- **Zero RPCs Created.**
- **Zero UI Components Built.**
- **Zero Destructive Actions Executed.**

---

## 32. Final Conclusion & Stop Condition

STEP 20A is complete. The Basketball product rules, MVP scope, configurable competition schema, game-clock authority model, foul system, and future-phase boundaries are fully specified and frozen.

**Work is stopped per instructions. STEP 20B will not begin until explicitly authorized.**
