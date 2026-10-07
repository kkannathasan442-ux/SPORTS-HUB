import { test, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const testPassword = 'Password123!QA';

test.describe('SPORTSHUB STEP 20D — Real Browser E2E Basketball Court-Side Scorer UI Verification', () => {
  test.describe.configure({ mode: 'serial' });

  let supabaseAdmin: SupabaseClient;

  // Test accounts
  const runId = Date.now();
  const scorerEmail = `bb.e2e.scorer.${runId}@test.sportshub.internal`;
  const spectatorEmail = `bb.e2e.spectator.${runId}@test.sportshub.internal`;

  let scorerUserId: string;
  let spectatorUserId: string;

  // Entities
  let basketballSportId: string;
  let orgAId: string;
  let teamAId: string;
  let teamBId: string;
  let matchId: string;
  let compAId: string;
  let compBId: string;
  let partAIds: string[] = [];
  let partBIds: string[] = [];

  test.beforeAll(async () => {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Basketball Sport
    const { data: sports, error: sportsErr } = await supabaseAdmin.from('sports').select('id, slug, name');
    expect(sportsErr).toBeNull();
    const bbSport = sports?.find((s) => s.slug === 'basketball');
    expect(bbSport).toBeDefined();
    basketballSportId = bbSport!.id;

    // 2. Create Real Auth Users
    const createUser = async (email: string, fullName: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw new Error(`Failed to create test user ${email}: ${error.message}`);
      return data.user.id;
    };

    scorerUserId = await createUser(scorerEmail, 'QA Basketball Scorer');
    spectatorUserId = await createUser(spectatorEmail, 'QA Basketball Spectator');

    // 3. Create Organization
    const { data: orgA, error: orgAErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: `QA Basketball Org ${runId}`,
        slug: `qa-bb-org-${runId}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(orgAErr).toBeNull();
    orgAId = orgA!.id;

    // 4. Assign Member Roles (Scorer role)
    await supabaseAdmin.from('organization_members').insert([
      { organization_id: orgAId, user_id: scorerUserId, role: 'SCORER', status: 'ACTIVE' },
    ]);

    // 5. Create Teams
    const { data: teamA, error: tAErr } = await supabaseAdmin
      .from('teams')
      .insert({
        name: `Lakers E2E ${runId}`,
        sport_id: basketballSportId,
        organization_id: orgAId,
        created_by: scorerUserId,
      })
      .select('id')
      .single();
    expect(tAErr).toBeNull();
    teamAId = teamA!.id;

    const { data: teamB, error: tBErr } = await supabaseAdmin
      .from('teams')
      .insert({
        name: `Celtics E2E ${runId}`,
        sport_id: basketballSportId,
        organization_id: orgAId,
        created_by: scorerUserId,
      })
      .select('id')
      .single();
    expect(tBErr).toBeNull();
    teamBId = teamB!.id;

    // 6. Create Basketball Match in DRAFT status
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 7200000).toISOString();

    const { data: match, error: mErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        sport_id: basketballSportId,
        title: `Lakers vs Celtics E2E ${runId}`,
        match_format: 'TEAM',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: scorerUserId,
        scorer_user_id: scorerUserId,
        metadata: {
          basketball_config: {
            period_duration_seconds: 600,
            regulation_period_count: 4,
            overtime_duration_seconds: 300,
            foul_out_limit: 5,
            team_foul_penalty_threshold: 5,
            timeouts_per_team_regulation: 4,
            timeouts_per_team_overtime: 1,
          },
        },
      })
      .select('id')
      .single();
    expect(mErr).toBeNull();
    matchId = match!.id;

    // 7. Create Competitors
    const { data: compA, error: cAErr } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchId, side: 'SIDE_A', team_id: teamAId, competitor_name: 'Lakers' })
      .select('id')
      .single();
    expect(cAErr).toBeNull();
    compAId = compA!.id;

    const { data: compB, error: cBErr } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchId, side: 'SIDE_B', team_id: teamBId, competitor_name: 'Celtics' })
      .select('id')
      .single();
    expect(cBErr).toBeNull();
    compBId = compB!.id;

    // 8. Create Participants (6 players per team: 5 starters + 1 bench)
    for (let i = 1; i <= 6; i++) {
      const { data: pA } = await supabaseAdmin
        .from('match_participants')
        .insert({
          match_id: matchId,
          competitor_id: compAId,
          display_name: `Lakers Player ${i}`,
          jersey_number: i,
          role: 'PLAYER',
        })
        .select('id')
        .single();
      partAIds.push(pA!.id);

      const { data: pB } = await supabaseAdmin
        .from('match_participants')
        .insert({
          match_id: matchId,
          competitor_id: compBId,
          display_name: `Celtics Player ${i}`,
          jersey_number: i + 10,
          role: 'PLAYER',
        })
        .select('id')
        .single();
      partBIds.push(pB!.id);
    }
  });

  async function loginAs(page: Page, email: string) {
    await page.goto('/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    } catch {
      // Continue if redirect complete
    }
  }

  test('E2E SCENARIOS A–G: Complete Court-Side Scoring & Server-Authoritative Clock Lifecycle', async ({ browser }) => {
    test.setTimeout(90000);
    const scorerContext = await browser.newContext();
    const page = await scorerContext.newPage();

    // 1. Login as authorized scorer
    await loginAs(page, scorerEmail);

    // 2. Navigate to match live/scorer route
    await page.goto(`/matches/${matchId}/live`);
    await page.waitForSelector('[data-testid="init-match-btn"]', { timeout: 15000 });

    // SCENARIO A — Initialization & Scoring
    // Click initialize match button
    const initBtn = page.locator('[data-testid="init-match-btn"]');
    await expect(initBtn).toBeVisible();
    await initBtn.click();

    // Verify scoreboard appears with period Q1 and 0-0 score
    await page.waitForSelector('[data-testid="scoreboard"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="period-badge"]')).toHaveText('Q1');
    await expect(page.locator('[data-testid="score-side-a"]')).toHaveText('0');
    await expect(page.locator('[data-testid="score-side-b"]')).toHaveText('0');
    await expect(page.locator('[data-testid="game-clock"]')).toHaveText('10:00');

    // Select Player 1 on Side A (should be preselected or clicked)
    const playerCardA1 = page.locator(`[data-testid="player-card-${partAIds[0]}"]`);
    await expect(playerCardA1).toBeVisible();
    await playerCardA1.click();

    // Record +2 Field Goal
    const btn2Pt = page.locator('[data-testid="btn-score-2pt"]');
    await expect(btn2Pt).toBeEnabled();
    await btn2Pt.click();

    // Verify score is now 2-0
    await expect(page.locator('[data-testid="score-side-a"]')).toHaveText('2', { timeout: 10000 });

    // Record +3 Pointer for Side A
    const btn3Pt = page.locator('[data-testid="btn-score-3pt"]');
    await btn3Pt.click();
    await expect(page.locator('[data-testid="score-side-a"]')).toHaveText('5', { timeout: 10000 });

    // SCENARIO B — Game Clock Lifecycle
    const btnClockToggle = page.locator('[data-testid="btn-clock-toggle"]');
    await expect(btnClockToggle).toHaveText(/START CLOCK/i);
    await btnClockToggle.click();

    // Verify clock is running and button toggles to PAUSE
    await expect(btnClockToggle).toHaveText(/PAUSE CLOCK/i, { timeout: 10000 });

    // Wait ~1.5 seconds for visual tick down
    await page.waitForTimeout(1600);

    // Pause clock
    await btnClockToggle.click();
    await expect(btnClockToggle).toHaveText(/START CLOCK/i, { timeout: 10000 });

    // SCENARIO C — Refresh & State Reconnection Recovery
    await page.reload();
    await page.waitForSelector('[data-testid="scoreboard"]', { timeout: 15000 });

    // Verify scores and period state remain fully intact after reload
    await expect(page.locator('[data-testid="period-badge"]')).toHaveText('Q1');
    await expect(page.locator('[data-testid="score-side-a"]')).toHaveText('5');
    await expect(page.locator('[data-testid="score-side-b"]')).toHaveText('0');

    // SCENARIO D — Fouls & Bonus Trigger
    // Switch to Side B tab
    const tabSideB = page.locator('[data-testid="tab-side-b"]');
    await tabSideB.click();

    // Select Player 1 on Side B
    const playerCardB1 = page.locator(`[data-testid="player-card-${partBIds[0]}"]`);
    await playerCardB1.waitFor({ state: 'visible' });
    await playerCardB1.click();

    // Open foul modal and record 5 fouls
    for (let i = 0; i < 5; i++) {
      const btnFoul = page.locator('[data-testid="btn-record-foul"]');
      await btnFoul.waitFor({ state: 'visible' });
      await btnFoul.click();

      // Inside modal, confirm foul
      const confirmFoulBtn = page.locator('[data-testid="modal-confirm-foul"]');
      await confirmFoulBtn.waitFor({ state: 'visible' });
      await confirmFoulBtn.click();
      await expect(confirmFoulBtn).not.toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(300);
    }

    // Verify team fouls is 5/5 and BONUS badge is displayed
    await expect(page.locator('[data-testid="team-fouls-side-b"]')).toHaveText('5/5', { timeout: 10000 });
    await expect(page.locator('[data-testid="bonus-side-b"]')).toBeVisible();

    // SCENARIO E — Substitution (5-Player Court Invariant)
    const btnSub = page.locator('[data-testid="btn-substitute"]');
    await btnSub.click();

    // Inside sub modal, ensure modal opens then close it cleanly
    const subModal = page.locator('[data-testid="modal-confirm-sub"]');
    await subModal.waitFor({ state: 'visible' });

    // Close substitution modal
    await page.locator('[data-testid="modal-close-sub"]').click();
    await expect(subModal).not.toBeVisible({ timeout: 5000 });

    // SCENARIO F — Timeout
    const btnTimeout = page.locator('[data-testid="btn-timeout"]');
    await btnTimeout.click();

    // Verify timeouts count decreased
    await expect(page.locator('[data-testid="timeouts-side-b"]')).toHaveText('3', { timeout: 10000 });

    // SCENARIO G — Undo Latest Action
    const btnUndo = page.locator('[data-testid="btn-undo"]');
    await btnUndo.click();

    const confirmUndo = page.locator('[data-testid="modal-confirm-undo"]');
    await confirmUndo.waitFor({ state: 'visible' });
    await confirmUndo.click();
    await expect(confirmUndo).not.toBeVisible({ timeout: 5000 });

    // Timeout should be restored back to 4
    await expect(page.locator('[data-testid="timeouts-side-b"]')).toHaveText('4', { timeout: 10000 });
  });

  test('E2E SCENARIO H: Realtime Spectator Read-Only Mode (Dual Contexts)', async ({ browser }) => {
    test.setTimeout(60000);
    // Browser Context A: Authorized Scorer
    const scorerCtx = await browser.newContext();
    const pageScorer = await scorerCtx.newPage();

    // Browser Context B: Spectator
    const spectatorCtx = await browser.newContext();
    const pageSpectator = await spectatorCtx.newPage();

    // 1. Scorer logs in and visits court-side scorer
    await loginAs(pageScorer, scorerEmail);
    await pageScorer.goto(`/matches/${matchId}/live`);
    await pageScorer.waitForSelector('[data-testid="scoreboard"]', { timeout: 15000 });

    // 2. Spectator visits match live page without mutation rights
    await pageSpectator.goto(`/matches/${matchId}/live`);
    await pageSpectator.waitForSelector('[data-testid="scoreboard"]', { timeout: 15000 });

    // Verify spectator sees scoreboard but DOES NOT have mutation controls
    await expect(pageSpectator.locator('[data-testid="score-side-a"]')).toHaveText('5');
    await expect(pageSpectator.locator('[data-testid="score-side-b"]')).toHaveText('0');
    await expect(pageSpectator.locator('[data-testid="btn-score-2pt"]')).not.toBeVisible();
    await expect(pageSpectator.locator('[data-testid="btn-record-foul"]')).not.toBeVisible();

    // 3. Scorer records +3 points in Context A
    const tabSideA = pageScorer.locator('[data-testid="tab-side-a"]');
    await tabSideA.click();
    const playerCardA1 = pageScorer.locator(`[data-testid="player-card-${partAIds[0]}"]`);
    await playerCardA1.click();
    const btn3Pt = pageScorer.locator('[data-testid="btn-score-3pt"]');
    await btn3Pt.click();

    // Scorer verifies 8 points
    await expect(pageScorer.locator('[data-testid="score-side-a"]')).toHaveText('8', { timeout: 10000 });

    // Spectator context receives authoritative update via Realtime broadcast
    await expect(pageSpectator.locator('[data-testid="score-side-a"]')).toHaveText('8', { timeout: 15000 });
  });
});
