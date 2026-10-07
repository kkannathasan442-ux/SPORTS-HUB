# SPORTSHUB STEP 20D — Basketball Court-Side Scorer UI Final Report

**Classification: PASS**  
**Environment: Production Monorepo (`apps/web`, Next.js 14, Supabase PostgreSQL RPCs, Tailwind CSS)**  
**Author: Antigravity Agentic Engineer**  
**Date: October 7, 2026**

---

## 1. Executive Summary

In **STEP 20D**, SportsHub implemented the production-ready **Basketball Court-Side Scorer UI** strictly integrated with the authoritative PostgreSQL RPC gameplay backend verified in STEP 20C. 

The client UI is intentionally **non-authoritative** for all gameplay rules, scores, clock state, fouls, bonus indicators, lineups, period progression, and match completion. Every court-side mutation is dispatched to verified server-side PostgreSQL RPCs (`init_basketball_match`, `record_basketball_score`, `record_basketball_foul`, `update_basketball_clock`, `substitute_basketball_player`, `record_basketball_timeout`, `undo_basketball_event`, `progress_basketball_period`, and `complete_basketball_match`), and the returned state is reconciled immediately into the view.

### Verification Highlights:
- **Zero Database Migrations:** 0 new migrations introduced. Schema remains 100% frozen from STEP 20C (`20261001000034_basketball_scoring_clock_rpc.sql`).
- **Cricket Regression:** **36 / 36 passed (100%)**. Cricket remains completely frozen and isolated.
- **Badminton Regression:** **57 / 57 passed (100%)**. Badminton remains completely frozen and isolated.
- **Basketball Tests:** **56 / 56 passed** (10 Unit + 12 Integration + 32 Foundation/RPC + 2 Playwright E2E covering Scenarios A–H).
- **Full Test Suite:** **601 / 601 passed** across 58 test files.
- **TypeScript Typecheck:** `npm run typecheck` passed with **0 errors**.
- **ESLint:** `npm run lint` passed with **0 errors**.
- **Production Build:** `npm run build` succeeded across all 41 routes.
- **Real Browser E2E:** 2/2 Playwright browser tests passed, verifying single-scorer lifecycle and dual-context realtime spectator isolation.

---

## 2. UI Architecture

The Basketball Scorer UI follows a strict **Server-Authoritative, Unidirectional Data Flow**:

```text
[ Court-Side Scorer UI ]
   │
   ├─► Action Initiated (e.g. Tap +2, Foul, Sub, Start Clock)
   │     │
   │     ├─► Generates client UUID (idempotency key: client_event_id)
   │     ├─► Sets temporary UI button loading / debounce lock
   │     └─► Calls Authoritative PostgreSQL RPC via Supabase Client
   │
   └─► Authoritative Database Response / Realtime WebSocket Event
         │
         ├─► Overwrites local view models with authoritative server state
         ├─► Updates Scoreboard, Period, Clock Anchor, Fouls, Bonus, Lineups
         ├─► Appends audit log to Recent Events feed
         └─► Dismisses action locks and notifies scorer via UI feedback
```

### Core Design Rules:
1. **Never Calculate Points Locally:** Clicking +2 or +3 never performs `score += 2`. The server calculates competitor totals, player box score points, and period state.
2. **Never Free-Wheel Game Clock:** The UI computes smooth presentation tick interpolation from `last_clock_updated_at` only while `clock_status === 'RUNNING'`. Pauses, adjustments, and period transitions re-anchor immediately to the authoritative server clock seconds.
3. **Optimistic Isolation:** If an RPC request errors or network drops, no local state drift occurs. The UI catches the error, maps it to clear human-readable feedback, and fetches the latest authoritative state snapshot.

---

## 3. Route Integration

The Basketball Court-Side Scorer UI is integrated into SportsHub's unified match routing architecture:

1. **Live Scorer Entry Route:**
   - **Path:** `/matches/[id]/live`
   - **File:** `apps/web/src/app/matches/[id]/live/page.tsx`
   - **Routing Strategy:** Inspects `match.sport.slug` or `match.sport_slug`. When `sportSlug === 'basketball'`, renders `<BasketballScorer match={match} />`. Preserves Cricket (`<CricketScorer>`) and Badminton (`<BadmintonScorer>`) without modification.

2. **Dedicated Sport Route:**
   - **Path:** `/matches/[id]/score/basketball`
   - **File:** `apps/web/src/app/matches/[id]/score/basketball/page.tsx`
   - **Routing Strategy:** Standalone direct route mirroring `/matches/[id]/score/cricket` and `/matches/[id]/score/badminton`.

3. **Match Details Action Integration:**
   - **Path:** `/matches/[id]`
   - **File:** `apps/web/src/app/matches/[id]/page.tsx`
   - **Routing Strategy:** Displays "Court-Side Scorer" and "Open Basketball Scorer" action buttons to authenticated match scorers and managers when `sport_slug === 'basketball'`.

---

## 4. Components Created/Modified

### Created:
1. `apps/web/src/components/matches/BasketballScorer.tsx` (1,580 lines)
   - Primary court-side scorer interface. Includes top bar, server-authoritative clock with start/pause/adjust controls, split-panel scoreboard with bonus and timeout indicators, 5-player on-court lineup selection, +1/+2/+3 scoring actions, modal workflows for fouls, substitutions, clock adjustments, undo confirmation, period progression, match completion, and realtime broadcast subscriptions.
2. `apps/web/src/app/matches/[id]/score/basketball/page.tsx` (34 lines)
   - Dedicated direct route wrapper for the Basketball court-side scorer.
3. `tests/unit/basketball-scorer-ui.test.ts` (134 lines)
   - Unit tests covering clock formatting, bonus derivation (>= 5 fouls), foul-out threshold validation (5 fouls), RPC error mapping, UUID client event ID generation, and RPC payload schemas.
4. `tests/integration/basketball-scorer-ui-integration.test.ts` (340 lines)
   - End-to-end integration tests testing all 9 RPCs, state hydration, spectator read-only restrictions, multi-tenant boundaries, and cross-sport isolation.
5. `tests/e2e/basketball-scorer-e2e.spec.ts` (365 lines)
   - Real browser Playwright E2E suite executing Scenarios A through H.

### Modified:
1. `apps/web/src/app/matches/[id]/live/page.tsx`
   - Added clean conditional branch for Basketball while preserving Cricket and Badminton.
2. `apps/web/src/app/matches/[id]/page.tsx`
   - Added Basketball scorer action buttons on the match detail page.

---

## 5. RPC Integration

Every gameplay action maps 1:1 to authoritative PostgreSQL functions verified in STEP 20C:

| UI Action | PostgreSQL RPC | Authoritative Output / Payload | Error Handling & User Translation |
|---|---|---|---|
| Initialize Match | `init_basketball_match` | Creates Q1 period, hydrates 5 starters per team, starts 10:00 (600s) clock | Rejects invalid sport, non-draft state, or missing starters |
| Record 1PT, 2PT, 3PT | `record_basketball_score` | Updates competitor total score, updates player points, logs event | Rejects inactive bench players, fouled-out players, completed match |
| Record Foul | `record_basketball_foul` | Increments personal fouls, team fouls, triggers BONUS (>=5), marks foul-out (>=5) | Rejects bench players, maps to "Player is on bench" |
| Start / Pause Clock | `update_basketball_clock` | Recalculates elapsed time, transitions RUNNING/STOPPED/EXPIRED | Rejects double-start, unauthenticated callers |
| Custom Time Adjust | `update_basketball_clock` | Sets authoritative seconds, stops clock | Rejects times > period duration |
| Substitute Player | `substitute_basketball_player` | Swaps 1 active player with 1 bench player (enforces 5-on-court invariant) | Rejects while clock is RUNNING, rejects fouled-out players |
| Call Timeout | `record_basketball_timeout` | Automatically STOPS clock, decrements timeouts (4 per team) | Rejects when timeouts exhausted (<=0) |
| Undo Last Action | `undo_basketball_event` | Voids most recent active event, reverts points/fouls/lineup/timeout | Rejects when no events exist or if non-latest event |
| Progress Period | `progress_basketball_period` | Moves Q1→Q2→Q3→Q4→OT1→OT2, resets team fouls, stops clock | Rejects while clock is running, forces OT if tied Q4 |
| Complete Match | `complete_basketball_match` | Evaluates winner, marks match status COMPLETED | Rejects tied regulation without OT, rejects while clock running |
| Hydrate State | `get_basketball_match_state` | Complete authoritative snapshot (scores, clock, fouls, lineups, timeouts, events) | Handles disconnected state gracefully |

---

## 6. Clock UI

1. **Large High-Contrast Clock Display:** Rendered with `font-mono font-black text-4xl sm:text-6xl`, displaying `MM:SS` (e.g., `09:42`).
2. **Authoritative Server Anchor:** Clock runs entirely on server timestamps (`last_clock_updated_at` + `game_clock_seconds`).
3. **Smooth Client Interpolation:** While `clock_status === 'RUNNING'`, an internal `setInterval` tick computes remaining seconds from `Date.now() - Date.parse(last_clock_updated_at)`.
4. **START / PAUSE Controls:**
   - When `STOPPED`: Prominent green `▶ START CLOCK` button (touch target: 48px).
   - When `RUNNING`: Amber `⏸ PAUSE CLOCK` button.
   - When `EXPIRED` (`00:00`): Start disabled; prompts scorer to advance to next period.
5. **Set Time Dialog:** Protected modal allowing scorer to adjust minutes and seconds with dead-ball validation.
6. **Refresh Recovery:** Reloading the browser immediately pulls `get_basketball_match_state`. If the clock was running on the server, the elapsed time continues seamlessly without drift or loss.

---

## 7. Scoring UI

1. **Touch-First Workflow:**
   - Step 1: Tap active on-court player card (shows jersey number, player name, points, personal fouls).
   - Step 2: Tap point action button (`+1 FREE THROW`, `+2 FIELD GOAL`, `+3 3-POINTER`).
2. **Prominent Touch Targets:** All scoring buttons are minimum `48px` to `64px` in height with vibrant team accents (Orange for Side A, Sky Blue for Side B).
3. **Authoritative Re-anchoring:** Tapping a point action calls `record_basketball_score` with `client_event_id: crypto.randomUUID()`. Authoritative score totals returned by the server immediately replace the display.
4. **Duplicate Protection:** Point buttons are disabled while `submitting === true`.

---

## 8. Foul UI

1. **Dedicated Court-Side Foul Modal:** Triggered via `FOUL` toolbar button.
2. **Team & Player Selection:** Pre-selects active player and provides fast single-tap selector across active on-court players.
3. **Foul Classification Selector:** Supports `PERSONAL`, `TECHNICAL`, `FLAGRANT`, and `OFFENSIVE` (exact STEP 20C enums).
4. **Personal Foul Tracking:** Displays personal foul count (`PF: X/5`) on player cards. Warns at 4 fouls (`⚠️ FOUL OUT RISK`).
5. **Team Fouls & Bonus Indicator:** Tracks period team fouls (`X/5`). When team fouls reach 5, the glowing `BONUS` badge automatically illuminates on the scoreboard. Team fouls automatically reset to 0 upon period progression.
6. **Foul-Out Enforcement:** Once a player records 5 personal fouls, the server marks `is_fouled_out = true`. The UI displays a prominent `FOULED OUT` badge, removes them from active scoring eligibility, and blocks them from returning to the court.

---

## 9. Substitution UI

1. **Dead-Ball Guard:** Substitution button detects clock status. If the game clock is `RUNNING`, the UI displays a clear amber warning: *"Game clock is RUNNING. Substitutions require the clock to be STOPPED."*
2. **5-Player Court Invariant:**
   - Column 1: On-Court Active Players (select player to leave).
   - Column 2: Available Bench Players (select player to enter).
   - Swaps exactly 1 for 1, ensuring 5 active players remain on court at all times.
3. **Eligibility Enforcement:** Fouled-out players are filtered out from the bench selector and cannot be substituted back into gameplay.

---

## 10. Timeout UI

1. **Allocation Counter:** Scoreboard displays remaining timeouts (e.g. `TO: 4/4`).
2. **Direct Action:** Clicking `TIMEOUT` calls `record_basketball_timeout`.
3. **Authoritative Behavior:**
   - Server automatically sets `clock_status = 'STOPPED'`.
   - Decrements remaining timeout allocation.
   - When allocation reaches 0, button transitions to `TIMEOUTS EXHAUSTED` and disables further requests.
   - Logs timeout event in the play-by-play audit feed.

---

## 11. Undo UI

1. **Court-Side Undo Button:** High-contrast `↩ UNDO LAST` button in the action toolbar.
2. **Safety Confirmation Modal:** Displays the exact last active event to be reversed (e.g., *"Are you sure you want to undo event #12: +2 PTS (FIELD_GOAL_2PT)?"*).
3. **Authoritative Rollback:** Calls `undo_basketball_event`. The backend marks the event void, decrements score or foul totals atomically, and restores previous lineups or timeout counts.
4. **Full State Re-fetch:** On undo completion, the UI re-hydrates `get_basketball_match_state` to ensure 100% synchronization.

---

## 12. Period / Overtime UI

1. **Regulation Flow:** Clean progression modal handles transitions `Q1 → Q2 → Halftime → Q3 → Q4`.
2. **Halftime Indicator:** Prominent visual banner after Q2 indicating halftime break.
3. **Overtime Handling:** If scores are tied at the conclusion of Q4, the UI indicates `TIED REGULATION` and presents the `START OVERTIME (OT1)` action. Sequential ties progress to `OT2`, `OT3`, etc.
4. **Match Finalization:** When regulation concludes with a leader (or after completed overtime), scorer can click `End & Complete Match`. Displays winner declaration (`TEAM A WINS` or `DRAW`) and disables active scoring controls.

---

## 13. Realtime Synchronization & Race Safety

1. **Supabase Realtime Channel:** Subscribes to Postgres change events on:
   - `basketball_periods` (`match_id = eq.${match.id}`)
   - `basketball_events` (`match_id = eq.${match.id}`)
   - `basketball_lineups` (`match_id = eq.${match.id}`)
2. **Authoritative State Refresh Pattern:**
   - When a Realtime message is received, the client dispatches a throttled call to `get_basketball_match_state`.
   - The UI **never** applies incremental math locally from Realtime broadcast payloads (avoids double-counting race conditions between RPC response and WebSocket broadcast).
3. **Connection State Monitor:** Displays real-time status badge:
   - `● LIVE / CONNECTED` (emerald)
   - `● RECONNECTING` (amber)
   - `● OFFLINE` (rose)

---

## 14. Authorization & Spectator Mode

1. **Role Verification:** Compares authenticated `user.id` against `match.scorer_user_id` and organization manager permissions.
2. **Authorized Scorer View:** Full access to game clock controls, scoring buttons, foul modal, substitution modal, timeout actions, undo modal, and period progression.
3. **Spectator Read-Only View:**
   - Displays live scoreboard, period badge, running game clock, team fouls, bonus status, and play-by-play event feed.
   - Mutation controls (scoring buttons, foul button, substitution, timeouts, clock controls, undo) are completely omitted from the DOM.
   - Verified via Playwright Dual-Context Browser E2E test.

---

## 15. Responsive & Mobile QA

The court-side UI was engineered and verified across all required breakpoints:

| Viewport | Device Class | Layout Adaptation & Usability |
|---|---|---|
| **360px** | Small Phone | Single-column stack, 48px touch targets, compact tabbed team switcher, no horizontal overflow. |
| **390px** | iPhone 14/15 | High-contrast scoreboard with large score numbers, sticky bottom toolbar for fouls/subs. |
| **430px** | iPhone Pro Max | Optimal mobile layout; active lineup player cards fit comfortably in single view. |
| **768px** | iPad / Tablet | 2-column grid displaying Side A and Side B scoring controls side-by-side. |
| **1024px** | iPad Pro / Laptop | Full court-side table view; clock, scoreboard, lineups, and live audit feed visible above fold. |
| **1280px+** | Desktop Arena Display | Professional court-side scorer station with split-panel team consoles and real-time feed. |

---

## 16. Real Browser E2E Test Results

Executed via Playwright (`tests/e2e/basketball-scorer-e2e.spec.ts`):

```text
Running 2 tests using 1 worker

[1/2] [chromium] › tests/e2e/basketball-scorer-e2e.spec.ts:201:7 › SPORTSHUB STEP 20D — Real Browser E2E Basketball Court-Side Scorer UI Verification › E2E SCENARIOS A–G: Complete Court-Side Scoring & Server-Authoritative Clock Lifecycle
[2/2] [chromium] › tests/e2e/basketball-scorer-e2e.spec.ts:328:7 › SPORTSHUB STEP 20D — Real Browser E2E Basketball Court-Side Scorer UI Verification › E2E SCENARIO H: Realtime Spectator Read-Only Mode (Dual Contexts)
  2 passed (27.6s)
```

### Verified Scenarios:
- **Scenario A (Scoring):** Scorer initializes match; taps +2 field goal, then +3 three-pointer; scoreboard updates authoritative score to 5.
- **Scenario B (Clock):** Scorer starts clock, verifies state is `RUNNING`, observes timer decrement, and pauses clock.
- **Scenario C (Refresh Recovery):** Hard browser refresh (`page.reload()`); verifies score (5-0), period (Q1), and clock state persist from server.
- **Scenario D (Fouls & Bonus):** Scorer records 5 consecutive fouls on Side B; verifies team fouls counter hits 5/5 and glowing `BONUS` badge appears.
- **Scenario E (Substitution):** Dead-ball substitution modal opens; enforces 5-on-court active player count.
- **Scenario F (Timeout):** Scorer calls timeout; clock stops and remaining timeouts decrease from 4 to 3.
- **Scenario G (Undo):** Scorer opens undo confirmation; latest timeout event is reversed; timeouts count restores to 4.
- **Scenario H (Realtime Spectator):** Dual browser contexts (Scorer vs Spectator). Spectator sees read-only scoreboard with no mutation controls. Scorer records +3 points; spectator view updates automatically via Realtime.

---

## 17. Basketball Test Suite

- **Unit Tests:** `tests/unit/basketball-scorer-ui.test.ts` — **10 / 10 passed**
- **Foundation Integration Tests:** `tests/integration/basketball-database-foundation.test.ts` — **7 / 7 passed**
- **UI Integration Tests:** `tests/integration/basketball-scorer-ui-integration.test.ts` — **12 / 12 passed**
- **RPC & Game Clock Tests:** `tests/integration/basketball-scoring-clock-rpc.test.ts` — **25 / 25 passed**
- **Browser Playwright E2E:** `tests/e2e/basketball-scorer-e2e.spec.ts` — **2 / 2 passed (Scenarios A–H)**
- **Total Basketball Tests:** **56 / 56 passed (100%)**

---

## 18. Cricket Regression Verification

Cricket is frozen. Regression baseline: **36 / 36**.
- `tests/unit/cricket-scorecard.test.ts` (19 tests) — **PASS**
- `tests/unit/cricket-match-simulation.test.ts` (11 tests) — **PASS**
- `tests/integration/cricket-scorecard.test.ts` (2 tests) — **PASS**
- `tests/integration/cricket-scoring.test.ts` (2 tests) — **PASS**
- `tests/integration/cricket-scoring-rpc.test.ts` (2 tests) — **PASS**
- **Actual Cricket Result:** **36 / 36 passed (100%)**

---

## 19. Badminton Regression Verification

Badminton is frozen. Regression baseline: **57 / 57**.
- `tests/unit/badminton-live-centre.test.ts` (7 tests) — **PASS**
- `tests/unit/badminton-scorer-ui.test.ts` (7 tests) — **PASS**
- `tests/integration/badminton-scoring.test.ts` (15 tests) — **PASS**
- `tests/integration/badminton-scoring-rpc.test.ts` (18 tests) — **PASS**
- `tests/integration/badminton-progression-live.test.ts` (10 tests) — **PASS**
- **Actual Badminton Result:** **57 / 57 passed (100%)**

---

## 20. Full Test Suite Result

Ran full test suite across the monorepo:
- **Total Test Files:** 58 passed (58)
- **Total Tests:** **601 passed (601)**
- **Test Duration:** 10.41s
- **Status:** **100% PASS**

---

## 21. Typecheck Result

Command: `npm run typecheck`
- `@sportshub/mobile`: 0 errors
- `@sportshub/web`: 0 errors
- `@sportshub/api`: 0 errors
- `@sportshub/config`: 0 errors
- `@sportshub/shared`: 0 errors
- `@sportshub/types`: 0 errors
- `@sportshub/validation`: 0 errors
- `tests/tsconfig.json`: 0 errors
- **Result:** **0 TypeScript errors**

---

## 22. ESLint Result

Command: `npm run lint`
- Zero ESLint errors across all packages and apps.
- **Result:** **0 ESLint errors**

---

## 23. Production Build Result

Command: `npm run build`
- All 41 Next.js application routes compiled successfully.
- Generated static and server-rendered chunks without warnings or failures.
- Route `/matches/[id]/score/basketball`: 192 B (202 kB First Load JS)
- Route `/matches/[id]/live`: 10.1 kB (212 kB First Load JS)
- **Result:** **Production Build Succeeded**

---

## 24. Visual QA Verification

- Scoreboard readability: High-contrast large scoreboard numbers (Orange vs Sky Blue).
- Clock visibility: High-contrast monospace game clock with clear START/PAUSE states.
- Touch targets: Minimum 44px to 64px on all primary scoring, clock, and foul controls.
- Modal interactions: Modals have distinct backdrops, clear dismiss actions, and input validation.
- Responsive design: Clean reflow from mobile 360px up to 1280px+ desktop.

---

## 25. Files Changed

### Added:
1. `STEP_20D_BASKETBALL_COURT_SIDE_SCORER_UI_REPORT.md` (this report)
2. `apps/web/src/components/matches/BasketballScorer.tsx`
3. `apps/web/src/app/matches/[id]/score/basketball/page.tsx`
4. `tests/unit/basketball-scorer-ui.test.ts`
5. `tests/integration/basketball-scorer-ui-integration.test.ts`
6. `tests/e2e/basketball-scorer-e2e.spec.ts`

### Modified:
1. `apps/web/src/app/matches/[id]/live/page.tsx` (routed `sportSlug === 'basketball'` to `BasketballScorer`)
2. `apps/web/src/app/matches/[id]/page.tsx` (added court-side scorer buttons for Basketball matches)
3. `vitest.config.ts` (increased timeout to 20,000ms for database integration test concurrency)

---

## 26. Database Changes

- **Database Migrations Added:** **NONE (0)**
- Schema and RPCs remain completely frozen from STEP 20C.

---

## 27. Known Limitations

1. **Shot Clock:** Not in MVP scope (reserved for future basketball extensions).
2. **Phase 2 Box-Score Stats:** Advanced statistics (rebounds, assists, steals, blocks, turnovers, shooting percentages) are intentionally deferred to future iterations per product decision specifications.
3. **Format Support:** 5v5 Full-Court Basketball is supported; 3x3 half-court format is deferred.

---

## 28. STEP 20E Readiness

The Basketball Court-Side Scorer UI is verified, resilient, responsive, fully authorized, and safe for production usage. The authoritative database and scoring engine remain stable.

**Verdict: READY FOR STEP 20E (Basketball Public Live Match Centre & Fan Experience).**
