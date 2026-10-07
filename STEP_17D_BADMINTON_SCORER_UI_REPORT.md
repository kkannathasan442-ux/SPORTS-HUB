# SportsHub — STEP 17D: Badminton Scorer UI & RPC Integration Report

## 1. Executive Summary & Objective

In **STEP 17D**, we implemented the dedicated, mobile-first **Badminton Scorer UI** and integrated it authoritatively with the STEP 17B database foundation and STEP 17C stored procedures (`record_badminton_rally()` and `undo_badminton_rally()`).

The UI is designed strictly as a **thin client**:
- PostgreSQL RPC remains the single source of truth for scores, game state, server/receiver assignments, and match completion.
- No client-side score recalculation or service rotation is performed.
- Double-tap and concurrency protection is enforced with in-flight mutation locks, disabled buttons, and client-generated UUID `client_event_id` tokens.
- Soft-undo with accidental-tap confirmation restores state authoritatively via PostgreSQL.

---

## 2. Pre-Change Verification

Before making changes, the project environment was audited:
1. **Migrations Verified:** Migrations `00001` through `000031` are active and intact. No new migrations were created in STEP 17D.
2. **Cricket Isolation:** All Cricket tables, RPCs, scorecard logic, and tests (`tests/integration/cricket-*.test.ts`, `tests/unit/cricket-*.test.ts`) remained completely untouched.
3. **Common Match Foundation:** `matches`, `match_competitors`, and `match_participants` tables remain the sport-neutral substrate.

---

## 3. UI Architecture & Components

### 3.1. Dedicated Component: `BadmintonScorer.tsx`
Location: [`apps/web/src/components/matches/BadmintonScorer.tsx`](file:///f:/SPORTS%20HUB/apps/web/src/components/matches/BadmintonScorer.tsx)

- **Thin Client Philosophy:** Accepts `matchId` and initial match/competitor/participant metadata. Holds no authoritative score algorithm.
- **Authoritative Hydration:** On load, fetches Game 1 state from `badminton_games` and rally history from `badminton_rallies`. If no game row exists yet, auto-initializes Game 1 via authorized RLS.
- **Rally Submission:**
  - Generates unique `crypto.randomUUID()` for `client_event_id`.
  - Disables both rally buttons (`isSubmitting = true`).
  - Calls `supabase.rpc('record_badminton_rally', { ... })`.
  - Sets component state strictly from the returned authoritative JSON (`result.game`, `result.completed_game`, `result.server_participant_id`, etc.).
- **Accidental Double-Tap Prevention:**
  - Mutation locking prevents concurrent RPC requests.
  - Both scoring buttons display loading spinner and text `Submitting...`.
- **Soft Undo:**
  - Modal confirmation prevents accidental court-side taps: *"Undo last rally?"*.
  - Calls `supabase.rpc('undo_badminton_rally', { p_game_id, p_reason })`.
  - Updates score, server/receiver, and marks voided rallies authoritatively from the RPC response.
- **Deuce & 30-Point Cap UI:**
  - Displays a clean visual badge `DEUCE` when game is tied at 20-20 or 21-20 / 22-21 prior to a 2-point lead.
  - Automatically respects the 30-point sudden death cap enforced by the RPC without inventing client rules.
- **Realtime State Synchronization:**
  - Listens to Supabase Realtime channel `badminton_game_{gameId}` on `badminton_games` and `badminton_rallies` table changes for background/spectator updates.

---

## 4. Route Implementation

### 4.1. Scorer Route: `/matches/[id]/score/badminton`
Location: [`apps/web/src/app/matches/[id]/score/badminton/page.tsx`](file:///f:/SPORTS%20HUB/apps/web/src/app/matches/[id]/score/badminton/page.tsx)

- **Sport Verification:** Checks `match.sport.name.toLowerCase() === 'badminton'`. If the match is not Badminton, returns a clean error state: *"Sport Mismatch: This scorer is dedicated to Badminton only."*
- **Auth Verification:** Verifies session presence and checks permissions via `match_competitors` / `matches` organizational scoping. Displays clear *"Unauthorized"* screen if not authenticated.
- **Clean Fallbacks:** Implements *"Loading match..."*, *"Match not found"*, and back navigation links to the main match page.

### 4.2. Match Detail Integration: `/matches/[id]`
Location: [`apps/web/src/app/matches/[id]/page.tsx`](file:///f:/SPORTS%20HUB/apps/web/src/app/matches/[id]/page.tsx)

- Updated Scorer CTA logic to branch cleanly by sport:
  - Cricket: routes to `/matches/[id]/score/cricket`
  - Badminton: routes to `/matches/[id]/score/badminton`
  - Other sports: Scorer CTA suppressed until their dedicated scorer is built.

---

## 5. Score Display & Service State

The UI delivers a high-contrast court-side display:
- **Game Header:** Displays `GAME {game_number}` and status badge (`LIVE`, `COMPLETED`).
- **Scoreboard:** Side A and Side B cards prominently display side names, players, and large numeric scores (4xl font).
- **Service State:** Authoritative badges indicate:
  - `🏸 SERVING` indicator highlighting the serving side card.
  - Serving court derived directly from score parity (`RIGHT COURT (EVEN)` or `LEFT COURT (ODD)`).
  - Server and Receiver player names displayed when assigned in match participants.
- **Rally History Log:**
  - Compact feed showing the last 10 rallies with rally number, winner side, score at the time, and rally type tag (`SMASH`, `DROP`, `OUT`, etc.).
  - Voided rallies (from soft-undo) are visually styled with line-through and muted opacity.

---

## 6. Error Handling

RPC error responses are intercepted and mapped into user-friendly court-side feedback:
- `UNAUTHORIZED`: *"You do not have permission to score this match."*
- `INVALID_SPORT`: *"This match is not configured for badminton scoring."*
- `NOT_FOUND`: *"Game record or rally not found."*
- `GAME_COMPLETED`: *"This game is already completed. No further rallies can be recorded."*
- `INVALID_GAME_STATE`: *"Game state is invalid for scoring."*
- `INVALID_SEQUENCE`: *"Rally sequence error. Please refresh the scoreboard."*
- `IDEMPOTENCY_CONFLICT`: *"This rally was already processed. UI synchronized."*
- `INVALID_UNDO`: *"No active rally available to undo in this game."*
- Network / Unknown: *"Unable to record rally. Please check connection and retry."*

---

## 7. Responsive & Accessibility Verification

- **Mobile First Viewports:**
  - 360px, 390px, 412px: Layout stacks cleanly into a vertical card format. Primary action buttons are large (min-h: 70px) and easily tappable with one thumb.
  - 768px (Tablet) & 1024px+ (Desktop): Two-column scoreboard with centered action tray and history drawer.
- **Accessibility:**
  - Semantic `<button>` elements with distinct `aria-label`s.
  - High-contrast color tokens adhering to WCAG 2.1 AA.
  - Keyboard accessible tab order and focus rings.
  - Disabled states prevent focus and screen reader activation during pending submission.

---

## 8. Test Verification & Results

### 8.1. Unit & Scorer UI Tests
Created [`tests/unit/badminton-scorer-ui.test.ts`](file:///f:/SPORTS%20HUB/tests/unit/badminton-scorer-ui.test.ts) covering:
1. Badminton vs non-badminton sport validation
2. Competitor name extraction for Singles and Doubles
3. Serving court derivation from authoritative score parity
4. Deuce detection logic
5. RPC error mapping to user-friendly messages
6. Unique UUID `client_event_id` generation
7. `record_badminton_rally` and `undo_badminton_rally` payload structuring

```
 ✓ tests/unit/badminton-scorer-ui.test.ts (7 tests) 11ms
   ✓ Badminton Scorer UI Logic > should identify badminton matches and reject other sports
   ✓ Badminton Scorer UI Logic > should extract competitor names accurately
   ✓ Badminton Scorer UI Logic > should correctly derive serving court from authoritative score parity
   ✓ Badminton Scorer UI Logic > should identify deuce state accurately
   ✓ Badminton Scorer UI Logic > should map known RPC error codes to user-friendly messages
   ✓ Badminton Scorer UI Logic > should generate valid and unique UUID client event IDs
   ✓ Badminton Scorer UI Logic > should structure RPC payloads correctly for record_badminton_rally
```

### 8.2. Full Test Suite Regression (Cricket + Badminton)
Ran all unit and integration test suites:
- **Total Tests:** 76
- **Passed:** 76
- **Failed:** 0
- **Cricket Baseline:** 36 / 36 PASS (100% frozen Cricket integrity preserved)
- **Badminton Foundation & RPCs:** 33 / 33 PASS
- **Badminton Scorer UI Unit:** 7 / 7 PASS

### 8.3. Typecheck
```bash
npm run typecheck
```
**Exit Code 0** across all workspaces (`@sportshub/web`, `@sportshub/api`, `@sportshub/database`, `@sportshub/shared`, `@sportshub/validation`, `@sportshub/auth`, `@sportshub/types`, `@sportshub/logger`).

### 8.4. Lint
```bash
npm run lint
```
**Exit Code 0** (no errors).

### 8.5. Production Build
```bash
npm run build
```
**Exit Code 0**. Next.js compiled 42 routes including `/matches/[id]/score/badminton` (5 kB, 196 kB first load JS).

---

## 9. Files Changed

| File | Status | Description |
|---|---|---|
| `apps/web/src/components/matches/BadmintonScorer.tsx` | **Added** | Dedicated mobile-first thin client Badminton scorer component |
| `apps/web/src/app/matches/[id]/score/badminton/page.tsx` | **Added** | Dedicated scorer route with sport verification & auth |
| `apps/web/src/app/matches/[id]/page.tsx` | **Modified** | Added sport-conditional link to Badminton scorer |
| `tests/unit/badminton-scorer-ui.test.ts` | **Added** | Unit tests for UI logic, court derivation, and error mapping |
| `STEP_17D_BADMINTON_SCORER_UI_REPORT.md` | **Added** | Step 17D completion report |

**Zero modifications to database migrations, schema, or Cricket logic.**

---

## 10. Known Limitations & Deferred Work

1. **Automatic Best-of-3 Flow:** Moving to Game 2/Game 3 upon completion of Game 1 will be integrated in the match progression phase.
2. **Spectator Live Match Centre:** Badminton public spectator center is deferred to STEP 17E.
3. **Offline Queuing:** Client relies on online Supabase RPC for authoritative scoring.

---

## 11. Final Status

```text
STEP 17D STATUS: PASS
```
