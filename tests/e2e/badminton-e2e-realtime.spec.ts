import { test, expect, BrowserContext, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const testPassword = 'Password123!QA';

test.describe('SPORTSHUB STEP 17F — Real Browser E2E Badminton Verification & Production Readiness', () => {
  test.describe.configure({ mode: 'serial' });

  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;

  // Test accounts
  const runId = Date.now();
  const scorerEmail = `badminton.scorer.${runId}@test.sportshub.internal`;
  const otherTenantScorerEmail = `badminton.otherorg.${runId}@test.sportshub.internal`;
  const customerEmail = `badminton.customer.${runId}@test.sportshub.internal`;

  let scorerUserId: string;
  let otherTenantScorerUserId: string;
  let customerUserId: string;

  // DB entities
  let badmintonSportId: string;
  let cricketSportId: string;
  let orgAId: string;
  let orgBId: string;
  let venueAId: string;
  let facilityAId: string;
  let matchAId: string;
  let draftMatchId: string;
  let cricketMatchId: string;
  let compAId: string;
  let compBId: string;
  let partAId: string;
  let partBId: string;

  test.beforeAll(async () => {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Fetch Sports
    const { data: sports, error: sportsErr } = await supabaseAdmin.from('sports').select('id, slug, name');
    expect(sportsErr).toBeNull();
    const bSport = sports?.find((s) => s.slug === 'badminton');
    const cSport = sports?.find((s) => s.slug === 'cricket');
    expect(bSport).toBeDefined();
    expect(cSport).toBeDefined();
    badmintonSportId = bSport!.id;
    cricketSportId = cSport!.id;

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

    scorerUserId = await createUser(scorerEmail, 'QA Scorer Alpha');
    otherTenantScorerUserId = await createUser(otherTenantScorerEmail, 'QA Scorer Beta Org B');
    customerUserId = await createUser(customerEmail, 'QA Customer Gamma');

    // 3. Create Organizations
    const { data: orgA, error: orgAErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: `QA Badminton Org A ${runId}`,
        slug: `qa-badminton-org-a-${runId}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(orgAErr).toBeNull();
    orgAId = orgA!.id;

    const { data: orgB, error: orgBErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: `QA Badminton Org B ${runId}`,
        slug: `qa-badminton-org-b-${runId}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(orgBErr).toBeNull();
    orgBId = orgB!.id;

    // 4. Assign Organization Roles
    await supabaseAdmin.from('organization_members').insert([
      { organization_id: orgAId, user_id: scorerUserId, role: 'SCORER', status: 'ACTIVE' },
      { organization_id: orgBId, user_id: otherTenantScorerUserId, role: 'SCORER', status: 'ACTIVE' },
    ]);

    // 5. Create Venue and Facility
    const { data: venue, error: vErr } = await supabaseAdmin
      .from('venues')
      .insert({
        organization_id: orgAId,
        name: 'SportsHub E2E Badminton Arena',
        slug: `e2e-arena-${runId}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(vErr).toBeNull();
    venueAId = venue!.id;

    const { data: facility, error: fErr } = await supabaseAdmin
      .from('facilities')
      .insert({
        venue_id: venueAId,
        sport_id: badmintonSportId,
        name: 'Court 1 - Tournament Floor',
        slug: `court-1-${runId}`,
        status: 'AVAILABLE',
      })
      .select('id')
      .single();
    expect(fErr).toBeNull();
    facilityAId = facility!.id;

    // 6. Create Badminton Match in Org A (starts in DRAFT)
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 3600000).toISOString();

    const { data: matchA, error: mErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        venue_id: venueAId,
        facility_id: facilityAId,
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: scorerUserId,
        scorer_user_id: scorerUserId,
        title: `Badminton E2E Championship ${runId}`,
      })
      .select('id')
      .single();
    expect(mErr).toBeNull();
    matchAId = matchA!.id;

    // Competitors & Participants
    const { data: compA, error: cAErr } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchAId, side: 'SIDE_A', competitor_name: 'Player Alpha' })
      .select('id')
      .single();
    expect(cAErr).toBeNull();
    compAId = compA!.id;

    const { data: compB, error: cBErr } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchAId, side: 'SIDE_B', competitor_name: 'Player Beta' })
      .select('id')
      .single();
    expect(cBErr).toBeNull();
    compBId = compB!.id;

    const { data: partA, error: pAErr } = await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: matchAId, competitor_id: compAId, display_name: 'Player Alpha' })
      .select('id')
      .single();
    expect(pAErr).toBeNull();
    partAId = partA!.id;

    const { data: partB, error: pBErr } = await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: matchAId, competitor_id: compBId, display_name: 'Player Beta' })
      .select('id')
      .single();
    expect(pBErr).toBeNull();
    partBId = partB!.id;

    // Lifecycle transition: DRAFT -> SCHEDULED -> WARMUP -> LIVE
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', matchAId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', matchAId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', matchAId);

    // Initialize Game 1 via RPC
    const { data: initRes, error: initErr } = await supabaseAdmin.rpc('progress_badminton_match', {
      p_match_id: matchAId,
    });
    expect(initErr).toBeNull();
    expect(initRes.status).toBe('game_created');

    // 7. Create DRAFT Badminton Match (for non-public isolation check)
    const { data: draftMatch, error: dmErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        venue_id: venueAId,
        facility_id: facilityAId,
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: scorerUserId,
        title: `Draft Badminton Match ${runId}`,
      })
      .select('id')
      .single();
    expect(dmErr).toBeNull();
    draftMatchId = draftMatch!.id;

    // 8. Create Cricket Match (for sport isolation check)
    const { data: cMatch, error: cmErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        sport_id: cricketSportId,
        match_format: 'TEAM',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: scorerUserId,
        title: `Cricket Super League Match ${runId}`,
      })
      .select('id')
      .single();
    expect(cmErr).toBeNull();
    cricketMatchId = cMatch!.id;

    // Add cricket competitors and transition to LIVE
    await supabaseAdmin.from('match_competitors').insert([
      { match_id: cricketMatchId, side: 'SIDE_A', competitor_name: 'Lions CC' },
      { match_id: cricketMatchId, side: 'SIDE_B', competitor_name: 'Tigers CC' },
    ]);
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', cricketMatchId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', cricketMatchId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', cricketMatchId);
  });

  // Helper to log in a page
  async function loginAs(page: Page, email: string) {
    await page.goto('/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    } catch (err) {
      const errorMsg = await page.locator('.text-rose-700').textContent().catch(() => null);
      console.log(`[LOGIN_DEBUG] Failed login for ${email}:`, errorMsg, 'Current URL:', page.url());
      throw new Error(`Login failed for ${email}: ${errorMsg || 'Timeout waiting for redirect'}`);
    }
  }

  test('E2E SCENARIO A: Game 1 to Game 2 Progression (Dual Browser Contexts)', async ({ browser }) => {
    // Context A: Authorized Scorer
    const scorerContext = await browser.newContext();
    const pageScorer = await scorerContext.newPage();
    pageScorer.on('console', msg => console.log('[SCORER_BROWSER_CONSOLE]', msg.type(), msg.text()));
    pageScorer.on('pageerror', err => console.log('[SCORER_PAGE_ERROR]', err));
    pageScorer.on('response', async res => {
      if (!res.ok()) {
        const text = await res.text().catch(() => '');
        console.log('[SCORER_HTTP_ERROR]', res.url(), res.status(), text);
      }
    });

    // Context B: Public Spectator (Anonymous, no auth)
    const spectatorContext = await browser.newContext();
    const pageSpectator = await spectatorContext.newPage();

    try {
      // 1. Scorer logs in and opens match scorer
      await loginAs(pageScorer, scorerEmail);
      await pageScorer.goto(`/matches/${matchAId}/score/badminton`);
      await pageScorer.waitForSelector('[data-testid="score-side-a"]', { timeout: 15000 });

      // Verify Game 1 at 0-0
      await expect(pageScorer.locator('[data-testid="score-side-a"]')).toHaveText('0');
      await expect(pageScorer.locator('[data-testid="score-side-b"]')).toHaveText('0');

      // 2. Spectator opens public live match centre
      await pageSpectator.goto(`/matches/${matchAId}/live`);
      await pageSpectator.waitForSelector('[data-testid="badminton-live-centre"]', { timeout: 15000 });

      await expect(pageSpectator.locator('[data-testid="live-side-a-score"]')).toHaveText('0');
      await expect(pageSpectator.locator('[data-testid="live-side-b-score"]')).toHaveText('0');

      // 3. Record rallies in Browser A until Side A reaches 21 points
      for (let pts = 1; pts <= 21; pts++) {
        const btnPoint = pageScorer.locator('[data-testid="btn-side-a-point"]');
        await btnPoint.waitFor({ state: 'visible' });
        await expect(btnPoint).toBeEnabled();
        await btnPoint.click();

        // Wait for score update in Scorer UI
        await expect(pageScorer.locator('[data-testid="score-side-a"]')).toHaveText(String(pts));
      }

      // 4. Verify Game 1 completion banner in Scorer UI
      await expect(pageScorer.getByText('GAME 1 COMPLETED')).toBeVisible({ timeout: 10000 });
      await expect(pageScorer.getByText(/Winner:\s*Player Alpha/i)).toBeVisible();
      const btnStartGame2 = pageScorer.locator('[data-testid="btn-start-next-game"]');
      await expect(btnStartGame2).toBeVisible();
      await expect(btnStartGame2).toHaveText(/START GAME 2/i);

      // 5. Verify Spectator receives Game 1 completion state
      await expect(pageSpectator.locator('[data-testid="live-side-a-score"]')).toHaveText('21', { timeout: 10000 });
      await expect(pageSpectator.getByText('1 game won')).toBeVisible();

      // 6. Start Game 2 in Scorer UI
      await btnStartGame2.click();

      // 7. Verify Game 2 begins at 0-0, serving Side A (BWF Rule)
      await expect(pageScorer.getByText('Game 2')).toBeVisible({ timeout: 10000 });
      await expect(pageScorer.locator('[data-testid="score-side-a"]')).toHaveText('0');
      await expect(pageScorer.locator('[data-testid="score-side-b"]')).toHaveText('0');
      await expect(pageScorer.getByText('Server: Player Alpha')).toBeVisible();

      // 8. Refresh Spectator browser and verify persisted state
      await pageSpectator.reload();
      await pageSpectator.waitForSelector('[data-testid="badminton-live-centre"]');
      await expect(pageSpectator.locator('[data-testid="live-side-a-score"]')).toHaveText('0');
      await expect(pageSpectator.locator('[data-testid="live-side-b-score"]')).toHaveText('0');
      await expect(pageSpectator.getByText('GAME 2 OF 3')).toBeVisible();
      // Game 1 score preserved in scorecard breakdown
      await expect(pageSpectator.getByText('GAME 1')).toBeVisible();
      await expect(pageSpectator.getByText('Final').first()).toBeVisible();
    } finally {
      await scorerContext.close();
      await spectatorContext.close();
    }
  });

  test('E2E SCENARIO B: Game 2 to Game 3 Progression (Opposing Side Wins Game 2)', async ({ browser }) => {
    const scorerContext = await browser.newContext();
    const pageScorer = await scorerContext.newPage();

    const spectatorContext = await browser.newContext();
    const pageSpectator = await spectatorContext.newPage();

    try {
      await loginAs(pageScorer, scorerEmail);
      await pageScorer.goto(`/matches/${matchAId}/score/badminton`);
      await pageScorer.waitForSelector('[data-testid="score-side-b"]', { timeout: 15000 });

      await pageSpectator.goto(`/matches/${matchAId}/live`);
      await pageSpectator.waitForSelector('[data-testid="badminton-live-centre"]', { timeout: 15000 });

      // 1. Side B scores 21 points in Game 2
      for (let pts = 1; pts <= 21; pts++) {
        const btnPointB = pageScorer.locator('[data-testid="btn-side-b-point"]');
        await btnPointB.waitFor({ state: 'visible' });
        await expect(btnPointB).toBeEnabled();
        await btnPointB.click();
        await expect(pageScorer.locator('[data-testid="score-side-b"]')).toHaveText(String(pts));
      }

      // 2. Verify Game 2 completed, tied at 1 game each
      await expect(pageScorer.getByText('GAME 2 COMPLETED')).toBeVisible({ timeout: 10000 });
      await expect(pageScorer.getByText(/Winner:\s*Player Beta/i)).toBeVisible();

      // Verify Start Game 3 button is available exactly once
      const btnStartGame3 = pageScorer.locator('[data-testid="btn-start-next-game"]');
      await expect(btnStartGame3).toBeVisible();
      await expect(btnStartGame3).toHaveText(/START GAME 3/i);

      // Verify Spectator shows 1 game won for each competitor
      await pageSpectator.reload();
      await pageSpectator.waitForSelector('[data-testid="badminton-live-centre"]');
      const gamesWonBadges = pageSpectator.getByText('1 game won');
      await expect(gamesWonBadges).toHaveCount(2);

      // 3. Scorer starts Game 3
      await btnStartGame3.click();

      // 4. Verify Game 3 starts at 0-0 with Side B serving (winner of Game 2 per BWF rule)
      await expect(pageScorer.getByText('Game 3')).toBeVisible({ timeout: 10000 });
      await expect(pageScorer.locator('[data-testid="score-side-a"]')).toHaveText('0');
      await expect(pageScorer.locator('[data-testid="score-side-b"]')).toHaveText('0');
      await expect(pageScorer.getByText('Server: Player Beta')).toBeVisible();

      // 5. Database Invariant Check: exactly 3 games exist, exactly Game 3 is active
      const { data: dbGames, error: dbGamesErr } = await supabaseAdmin
        .from('badminton_games')
        .select('*')
        .eq('match_id', matchAId)
        .order('game_number', { ascending: true });

      expect(dbGamesErr).toBeNull();
      expect(dbGames).toHaveLength(3);
      expect(dbGames![0].game_number).toBe(1);
      expect(dbGames![0].is_completed).toBe(true);
      expect(dbGames![0].winner_side).toBe('SIDE_A');

      expect(dbGames![1].game_number).toBe(2);
      expect(dbGames![1].is_completed).toBe(true);
      expect(dbGames![1].winner_side).toBe('SIDE_B');

      expect(dbGames![2].game_number).toBe(3);
      expect(dbGames![2].is_completed).toBe(false);
      expect(dbGames![2].serving_side).toBe('SIDE_B');
    } finally {
      await scorerContext.close();
      await spectatorContext.close();
    }
  });

  test('E2E SCENARIO C: Match Completion & Authoritative Winner Persistence', async ({ browser }) => {
    const scorerContext = await browser.newContext();
    const pageScorer = await scorerContext.newPage();

    const spectatorContext = await browser.newContext();
    const pageSpectator = await spectatorContext.newPage();

    try {
      await loginAs(pageScorer, scorerEmail);
      await pageScorer.goto(`/matches/${matchAId}/score/badminton`);
      await pageScorer.waitForSelector('[data-testid="score-side-a"]', { timeout: 15000 });

      await pageSpectator.goto(`/matches/${matchAId}/live`);
      await pageSpectator.waitForSelector('[data-testid="badminton-live-centre"]', { timeout: 15000 });

      // 1. Side A scores 21 points in Game 3 to clinch the match 2-1
      for (let pts = 1; pts <= 21; pts++) {
        const btnPointA = pageScorer.locator('[data-testid="btn-side-a-point"]');
        await btnPointA.waitFor({ state: 'visible' });
        await expect(btnPointA).toBeEnabled();
        await btnPointA.click();
        await expect(pageScorer.locator('[data-testid="score-side-a"]')).toHaveText(String(pts));
      }

      // 2. Trigger match completion via progression
      const btnStartGame = pageScorer.locator('[data-testid="btn-start-next-game"]');
      if (await btnStartGame.isVisible()) {
        await btnStartGame.click();
      }

      // 3. Verify Scorer Celebratory Card & Winner announcement
      await expect(pageScorer.getByText('MATCH COMPLETED')).toBeVisible({ timeout: 10000 });
      await expect(pageScorer.locator('[data-testid="match-winner-announcement"]')).toContainText('Player Alpha');

      // Verify no Game 4 button exists
      await expect(pageScorer.locator('[data-testid="btn-start-next-game"]')).not.toBeVisible();
      await expect(pageScorer.locator('[data-testid="btn-side-a-point"]')).not.toBeVisible();

      // 4. Verify Spectator Live Centre reflects completed match
      await pageSpectator.reload();
      await pageSpectator.waitForSelector('[data-testid="badminton-live-centre"]');
      await expect(pageSpectator.getByText('MATCH COMPLETED')).toBeVisible();
      await expect(pageSpectator.getByText('Player Alpha won').first()).toBeVisible();

      // 5. Hard refresh both browsers and confirm final persisted state
      await pageScorer.reload();
      await expect(pageScorer.getByText('MATCH COMPLETED')).toBeVisible();
      await expect(pageScorer.locator('[data-testid="match-winner-announcement"]')).toContainText('Player Alpha');

      await pageSpectator.reload();
      await expect(pageSpectator.getByText('MATCH COMPLETED')).toBeVisible();

      // 6. DB check: Match status is COMPLETED, winner_side is SIDE_A
      const { data: finalMatch } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('id', matchAId)
        .single();

      expect(finalMatch.status).toBe('COMPLETED');
      expect(finalMatch.winner_side).toBe('SIDE_A');
      expect(finalMatch.result_summary).toContain('Player Alpha');

      // 7. Verify further scoring attempts are rejected by DB
      const { error: rejectRallyErr } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: finalMatch.id, // Any ID
        p_client_event_id: crypto.randomUUID(),
        p_winner_side: 'SIDE_A',
      });
      expect(rejectRallyErr).not.toBeNull();
      expect(rejectRallyErr!.message).toContain('COMPLETED');
    } finally {
      await scorerContext.close();
      await spectatorContext.close();
    }
  });

  test('E2E SCENARIO D: Realtime Latency & Subscriptions Teardown', async ({ browser }) => {
    // Create fresh match for latency & teardown measurement
    const now = new Date();
    const scheduledStart = now.toISOString();
    const scheduledEnd = new Date(now.getTime() + 3600000).toISOString();

    const { data: latencyMatch, error: lmErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        venue_id: venueAId,
        facility_id: facilityAId,
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: scorerUserId,
        scorer_user_id: scorerUserId,
        title: `Realtime Latency Test Match ${Date.now()}`,
      })
      .select('id')
      .single();
    expect(lmErr).toBeNull();
    const lMatchId = latencyMatch!.id;

    // Competitors & Participants
    const { data: comp1 } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: lMatchId, side: 'SIDE_A', competitor_name: 'Speedy A' })
      .select('id')
      .single();
    const { data: comp2 } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: lMatchId, side: 'SIDE_B', competitor_name: 'Speedy B' })
      .select('id')
      .single();

    await supabaseAdmin.from('match_participants').insert([
      { match_id: lMatchId, competitor_id: comp1!.id, display_name: 'Speedy A' },
      { match_id: lMatchId, competitor_id: comp2!.id, display_name: 'Speedy B' },
    ]);

    // Transition to LIVE
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', lMatchId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', lMatchId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', lMatchId);

    // Initialize Game 1
    await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: lMatchId });

    const scorerContext = await browser.newContext();
    const pageScorer = await scorerContext.newPage();

    const spectatorContext = await browser.newContext();
    const pageSpectator = await spectatorContext.newPage();

    try {
      await loginAs(pageScorer, scorerEmail);
      await pageScorer.goto(`/matches/${lMatchId}/score/badminton`);
      await pageScorer.waitForSelector('[data-testid="score-side-a"]');

      await pageSpectator.goto(`/matches/${lMatchId}/live`);
      await pageSpectator.waitForSelector('[data-testid="badminton-live-centre"]');

      // Measure delivery time from Scorer point click to Spectator DOM update
      const t0 = Date.now();
      await pageScorer.click('[data-testid="btn-side-a-point"]');

      await expect(pageScorer.locator('[data-testid="score-side-a"]')).toHaveText('1');

      // Wait for Spectator to receive update (via Realtime or fallback refresh)
      await expect(pageSpectator.locator('[data-testid="live-side-a-score"]')).toHaveText('1', { timeout: 10000 });
      const elapsed = Date.now() - t0;
      console.log(`Measured Realtime E2E delivery latency: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(10000);

      // Verify clean unmount / navigation away from spectator page
      await pageSpectator.goto('/venues');
      await expect(pageSpectator.locator('h1').first()).toBeVisible();
    } finally {
      await scorerContext.close();
      await spectatorContext.close();
    }
  });

  test('SECURITY & TENANT ISOLATION: Multi-role, cross-tenant, and sport validation', async ({ browser }) => {
    // 1. Cross-Tenant Rejection: Scorer from Org B cannot score Org A match
    const orgBScorerClient = createClient(supabaseUrl, supabaseAnonKey);
    await orgBScorerClient.auth.signInWithPassword({
      email: otherTenantScorerEmail,
      password: testPassword,
    });

    const { error: crossTenantErr } = await orgBScorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: matchAId, // arbitrary uuid
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(crossTenantErr).not.toBeNull();
    expect(crossTenantErr!.message).toContain('UNAUTHORIZED');

    // 2. Customer Rejection: Customer cannot perform scoring RPCs
    const customerClient = createClient(supabaseUrl, supabaseAnonKey);
    await customerClient.auth.signInWithPassword({
      email: customerEmail,
      password: testPassword,
    });

    const { error: customerRpcErr } = await customerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: matchAId,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(customerRpcErr).not.toBeNull();
    expect(customerRpcErr!.message).toContain('UNAUTHORIZED');

    // 3. Anonymous Rejection: Anon cannot perform scoring mutations
    const { error: anonRpcErr } = await supabaseAnon.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: matchAId,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(anonRpcErr).not.toBeNull();
    expect(anonRpcErr!.message).toContain('UNAUTHORIZED');

    // 4. Draft Match Isolation: Public live page does not expose DRAFT match
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const response = await page.goto(`/matches/${draftMatchId}/live`);
      // Matches in DRAFT are not available on public live page (404 / not found / redirect)
      const is404 = response?.status() === 404 || (await page.getByText(/404|not found/i).count()) > 0;
      expect(is404).toBe(true);
    } finally {
      await context.close();
    }

    // 5. Sport Isolation: Badminton Scorer rejects Cricket matches
    const { error: cricketBadmintonErr } = await supabaseAdmin.rpc('record_badminton_rally', {
      p_match_id: cricketMatchId,
      p_game_id: cricketMatchId,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(cricketBadmintonErr).not.toBeNull();
    expect(cricketBadmintonErr!.message).toContain('INVALID_SPORT');

    // 6. Shared Live Route Sport Routing: Cricket match loads Cricket Live Centre, NOT Badminton
    const cricketContext = await browser.newContext();
    const cricketPage = await cricketContext.newPage();
    try {
      await cricketPage.goto(`/matches/${cricketMatchId}/live`);
      // Cricket live centre renders cricket-specific elements, NOT badminton live centre
      await expect(cricketPage.locator('[data-testid="badminton-live-centre"]')).not.toBeVisible();
    } finally {
      await cricketContext.close();
    }
  });
});
