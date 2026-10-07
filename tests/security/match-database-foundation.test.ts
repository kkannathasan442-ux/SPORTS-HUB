import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

describe('STEP 15B — Match Database Foundation & Integrity Tests', () => {
  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;

  // Cached fixture IDs
  let cricketSportId: string;
  let badmintonSportId: string;
  let demoOrgId: string;
  let otherOrgId: string;
  let demoVenueId: string;
  let badmintonFac1Id: string;
  let cricketFacId: string;
  let testUserId1: string;
  let testUserId2: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

    // Fetch Sports
    const { data: sports } = await supabaseAdmin.from('sports').select('id, slug');
    cricketSportId = sports?.find(s => s.slug === 'cricket')?.id!;
    badmintonSportId = sports?.find(s => s.slug === 'badminton')?.id!;

    // Fetch Demo Organization & Venue
    const { data: orgs } = await supabaseAdmin.from('organizations').select('id, slug');
    demoOrgId = orgs?.find(o => o.slug === 'demo-sports-group')?.id!;

    // Create a secondary org for cross-tenant tests
    const { data: secondaryOrg } = await supabaseAdmin.from('organizations').insert({
      name: 'Secondary Sports Org',
      slug: 'secondary-sports-org-' + Date.now(),
      status: 'ACTIVE',
      currency: 'LKR',
      timezone: 'Asia/Colombo'
    }).select('id').single();
    otherOrgId = secondaryOrg?.id!;

    // Fetch Demo Venue
    const { data: venues } = await supabaseAdmin.from('venues').select('id, organization_id').eq('organization_id', demoOrgId);
    demoVenueId = venues?.[0]?.id!;

    // Fetch Facilities
    const { data: facs } = await supabaseAdmin.from('facilities').select('id, sport_id, name');
    badmintonFac1Id = facs?.find(f => f.name.includes('Badminton Court 01'))?.id!;
    cricketFacId = facs?.find(f => f.name.includes('Cricket Turf 01'))?.id!;

    // Fetch test profiles
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').limit(2);
    testUserId1 = profiles?.[0]?.id!;
    testUserId2 = profiles?.[1]?.id!;
  }, 30000);

  afterAll(async () => {
    // Cleanup secondary org
    if (otherOrgId) {
      await supabaseAdmin.from('organizations').delete().eq('id', otherOrgId);
    }
  }, 30000);

  // 1. Match reference format and auto-generation
  it('1. Server auto-generates unique MTH-YYYYMMDD-XXXXXX match_reference on insert and enforces immutability', async () => {
    const { data: match, error } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
      match_format: 'SINGLES',
      match_type: 'CASUAL',
    }).select('*').single();

    expect(error).toBeNull();
    expect(match).toBeDefined();
    expect(match.match_reference).toMatch(/^MTH-\d{8}-[A-Z0-9]{6}$/);

    // Verify immutability of match_reference
    const { error: updateError } = await supabaseAdmin.from('matches').update({
      match_reference: 'MTH-TAMPERED-REF'
    }).eq('id', match.id);

    expect(updateError).toBeDefined();
    expect(updateError?.message).toContain('match_reference is immutable');

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', match.id);
  });

  // 2. Competitor side uniqueness
  it('2. Enforces competitor side uniqueness: exactly SIDE_A and SIDE_B, rejects duplicates and invalid sides', async () => {
    const { data: match } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
      match_format: 'SINGLES',
    }).select('id').single();

    // Insert SIDE_A
    const { error: errA } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_A',
      competitor_name: 'Player One',
    });
    expect(errA).toBeNull();

    // Insert duplicate SIDE_A (should fail)
    const { error: errDup } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_A',
      competitor_name: 'Player Duplicate',
    });
    expect(errDup).toBeDefined();
    expect(errDup?.message).toContain('uq_match_competitor_side');

    // Insert invalid SIDE_C (should fail check constraint)
    const { error: errInvalid } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_C',
      competitor_name: 'Player Three',
    });
    expect(errInvalid).toBeDefined();

    // Insert valid SIDE_B
    const { error: errB } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_B',
      competitor_name: 'Player Two',
    });
    expect(errB).toBeNull();

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', match!.id);
  });

  // 3. Participant uniqueness (partial unique index on match_id, user_id)
  it('3. Enforces participant uniqueness: same registered user cannot participate twice in the same match', async () => {
    const { data: match } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
      match_format: 'DOUBLES',
    }).select('id').single();

    const { data: sideA } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_A',
      competitor_name: 'Team Alpha',
    }).select('id').single();

    const { data: sideB } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_B',
      competitor_name: 'Team Beta',
    }).select('id').single();

    // Add user1 to SIDE_A
    const { error: errPart1 } = await supabaseAdmin.from('match_participants').insert({
      match_id: match!.id,
      competitor_id: sideA!.id,
      user_id: testUserId1,
      display_name: 'User 1',
    });
    expect(errPart1).toBeNull();

    // Try adding user1 again to SIDE_B (should fail unique index)
    const { error: errPartDup } = await supabaseAdmin.from('match_participants').insert({
      match_id: match!.id,
      competitor_id: sideB!.id,
      user_id: testUserId1,
      display_name: 'User 1 Duplicate',
    });
    expect(errPartDup).toBeDefined();
    expect(errPartDup?.message).toContain('idx_match_participants_unique_user');

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', match!.id);
  });

  // 4. Tenant mismatch rejection
  it('4. Rejects tenant mismatch: venue belonging to Org B cannot be assigned to Org A match', async () => {
    const { data: otherVenue } = await supabaseAdmin.from('venues').insert({
      organization_id: otherOrgId,
      name: 'Other Org Venue',
      slug: 'other-org-venue-' + Date.now(),
      status: 'ACTIVE',
      timezone: 'Asia/Colombo'
    }).select('id').single();

    const { error } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      organization_id: demoOrgId, // Org A
      venue_id: otherVenue!.id, // Org B venue
      created_by: testUserId1,
      status: 'DRAFT',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Venue organization_id');

    // Cleanup venue
    await supabaseAdmin.from('venues').delete().eq('id', otherVenue!.id);
  });

  // 5. Facility/venue mismatch rejection (composite FK)
  it('5. Rejects facility/venue mismatch via composite foreign key', async () => {
    const { data: secondVenue } = await supabaseAdmin.from('venues').insert({
      organization_id: demoOrgId,
      name: 'Second Demo Venue',
      slug: 'second-demo-venue-' + Date.now(),
      status: 'ACTIVE',
      timezone: 'Asia/Colombo'
    }).select('id').single();

    // badmintonFac1Id belongs to demoVenueId, NOT secondVenue
    const { error } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      organization_id: demoOrgId,
      venue_id: secondVenue!.id,
      facility_id: badmintonFac1Id, // mismatch!
      created_by: testUserId1,
      status: 'DRAFT',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('fk_matches_facility_venue');

    // Cleanup
    await supabaseAdmin.from('venues').delete().eq('id', secondVenue!.id);
  });

  // 6. Booking mismatch rejection
  it('6. Rejects booking mismatch: match org/venue/facility/sport must match booking', async () => {
    // Create a real booking for testing
    const startTime = '10:00:00';
    const endTime = '11:00:00';
    const ref = 'SPH-MTH-TEST-' + Math.floor(Math.random() * 100000);
    const range = `[2026-10-25 10:00:00+05:30, 2026-10-25 11:00:00+05:30)`;

    const { data: booking, error: bErr } = await supabaseAdmin.from('bookings').insert({
      booking_reference: ref,
      customer_user_id: testUserId1,
      organization_id: demoOrgId,
      venue_id: demoVenueId,
      facility_id: badmintonFac1Id,
      sport_id: badmintonSportId,
      booking_date: '2026-10-25',
      start_time: startTime,
      end_time: endTime,
      duration_minutes: 60,
      protected_time_range: range,
      status: 'CONFIRMED',
      price_snapshot: { price: 2000 }
    }).select('id').single();

    expect(bErr).toBeNull();

    // Try linking booking to a Cricket match (mismatch sport)
    const { error: errSportMismatch } = await supabaseAdmin.from('matches').insert({
      sport_id: cricketSportId, // Mismatch!
      organization_id: demoOrgId,
      venue_id: demoVenueId,
      facility_id: badmintonFac1Id,
      booking_id: booking!.id,
      created_by: testUserId1,
      status: 'DRAFT',
    });
    expect(errSportMismatch).toBeDefined();
    expect(errSportMismatch?.message).toContain('Match sport_id');

    // Try linking booking with mismatched organization
    const { error: errOrgMismatch } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      organization_id: otherOrgId, // Mismatch!
      booking_id: booking!.id,
      created_by: testUserId1,
      status: 'DRAFT',
    });
    expect(errOrgMismatch).toBeDefined();
    expect(errOrgMismatch?.message).toContain('Match organization_id');

    // Valid booking link auto-inherits correctly
    const { data: validMatch, error: validErr } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      booking_id: booking!.id,
      created_by: testUserId1,
      status: 'DRAFT',
    }).select('*').single();
    expect(validErr).toBeNull();
    expect(validMatch?.organization_id).toBe(demoOrgId);
    expect(validMatch?.venue_id).toBe(demoVenueId);
    expect(validMatch?.facility_id).toBe(badmintonFac1Id);

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', validMatch!.id);
    await supabaseAdmin.from('bookings').delete().eq('id', booking!.id);
  });

  // 7. Sport/facility mismatch rejection
  it('7. Rejects sport/facility mismatch (Cricket match on Badminton court)', async () => {
    const { error } = await supabaseAdmin.from('matches').insert({
      sport_id: cricketSportId, // Cricket
      organization_id: demoOrgId,
      venue_id: demoVenueId,
      facility_id: badmintonFac1Id, // Badminton court
      created_by: testUserId1,
      status: 'DRAFT',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Facility sport');
  });

  // 8. Competitor team validation (global match cannot use private team)
  it('8. Rejects organization-private team in global match (organization_id IS NULL)', async () => {
    // Create an organization-private team
    const { data: orgTeam } = await supabaseAdmin.from('teams').insert({
      name: 'Org Private Team ' + Date.now(),
      sport_id: cricketSportId,
      organization_id: demoOrgId,
      created_by: testUserId1,
    }).select('id').single();

    // Create global match
    const { data: match } = await supabaseAdmin.from('matches').insert({
      sport_id: cricketSportId,
      organization_id: null, // Global match
      created_by: testUserId1,
      status: 'DRAFT',
      match_format: 'TEAM',
    }).select('id').single();

    // Try assigning org-private team to global match
    const { error } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_A',
      competitor_name: 'Org Team',
      team_id: orgTeam!.id,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Organization-private teams cannot be used in a global match');

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', match!.id);
    await supabaseAdmin.from('teams').delete().eq('id', orgTeam!.id);
  });

  // 9. Participant competitor consistency via composite foreign key
  it('9. Rejects participant whose competitor belongs to another match', async () => {
    // Match 1
    const { data: m1 } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
    }).select('id').single();

    const { data: m1SideA } = await supabaseAdmin.from('match_competitors').insert({
      match_id: m1!.id,
      side: 'SIDE_A',
      competitor_name: 'M1 Side A',
    }).select('id').single();

    // Match 2
    const { data: m2 } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
    }).select('id').single();

    // Try adding participant to Match 2 referencing competitor from Match 1
    const { error } = await supabaseAdmin.from('match_participants').insert({
      match_id: m2!.id,
      competitor_id: m1SideA!.id, // Belongs to m1, not m2!
      display_name: 'Invalid Participant',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('fk_match_participants_competitor_match');

    // Cleanup
    await supabaseAdmin.from('matches').delete().in('id', [m1!.id, m2!.id]);
  });

  // 10. Status transition protection (invalid transitions & terminal protection)
  it('10. Enforces valid status transitions and protects terminal states (CANCELLED, COMPLETED, ABANDONED)', async () => {
    const { data: match } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
    }).select('id').single();

    // Invalid: DRAFT directly to LIVE without SCHEDULED (should fail)
    const { error: errDirectLive } = await supabaseAdmin.from('matches').update({
      status: 'LIVE'
    }).eq('id', match!.id);
    expect(errDirectLive).toBeDefined();
    expect(errDirectLive?.message).toContain('Invalid match status transition');

    // Valid: DRAFT to CANCELLED (terminal)
    const { error: errCancel } = await supabaseAdmin.from('matches').update({
      status: 'CANCELLED'
    }).eq('id', match!.id);
    expect(errCancel).toBeNull();

    // Transition OUT of terminal CANCELLED (must fail)
    const { error: errRevive } = await supabaseAdmin.from('matches').update({
      status: 'DRAFT'
    }).eq('id', match!.id);
    expect(errRevive).toBeDefined();
    expect(errRevive?.message).toContain('terminal status CANCELLED');

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', match!.id);
  });

  // 11. DRAFT incomplete roster allowed vs SCHEDULED incomplete roster rejected
  it('11. Allows incomplete roster in DRAFT, but strictly rejects transition to SCHEDULED without full roster', async () => {
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const endTime = new Date(Date.now() + 7200000).toISOString();

    const { data: match } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
      match_format: 'SINGLES',
      scheduled_start: startTime,
      scheduled_end: endTime,
    }).select('id').single();

    // Try transitioning to SCHEDULED without any competitors (must fail)
    const { error: errNoComp } = await supabaseAdmin.from('matches').update({
      status: 'SCHEDULED'
    }).eq('id', match!.id);
    expect(errNoComp).toBeDefined();
    expect(errNoComp?.message).toContain('both SIDE_A and SIDE_B must be configured');

    // Add SIDE_A and SIDE_B
    const { data: sideA } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_A',
      competitor_name: 'Player A',
    }).select('id').single();

    const { data: sideB } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_B',
      competitor_name: 'Player B',
    }).select('id').single();

    // Try transitioning to SCHEDULED with 0 participants on SINGLES (must fail)
    const { error: errNoParts } = await supabaseAdmin.from('matches').update({
      status: 'SCHEDULED'
    }).eq('id', match!.id);
    expect(errNoParts).toBeDefined();
    expect(errNoParts?.message).toContain('SINGLES format requires exactly 1 participant on each side');

    // Add 1 participant to SIDE_A and 1 participant to SIDE_B
    await supabaseAdmin.from('match_participants').insert({
      match_id: match!.id,
      competitor_id: sideA!.id,
      user_id: testUserId1,
      display_name: 'Player A',
    });
    await supabaseAdmin.from('match_participants').insert({
      match_id: match!.id,
      competitor_id: sideB!.id,
      user_id: testUserId2,
      display_name: 'Player B',
    });

    // Now transition to SCHEDULED must SUCCEED!
    const { error: errScheduled } = await supabaseAdmin.from('matches').update({
      status: 'SCHEDULED'
    }).eq('id', match!.id);
    expect(errScheduled).toBeNull();

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', match!.id);
  });

  // 12. Server timestamp integrity
  it('12. Automatically populates server timestamps actual_start on LIVE and actual_end on COMPLETED', async () => {
    const startTime = new Date(Date.now() + 3600000).toISOString();
    const endTime = new Date(Date.now() + 7200000).toISOString();

    const { data: match } = await supabaseAdmin.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
      match_format: 'SINGLES',
      scheduled_start: startTime,
      scheduled_end: endTime,
    }).select('id').single();

    const { data: sideA } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_A',
      competitor_name: 'Player A',
    }).select('id').single();

    const { data: sideB } = await supabaseAdmin.from('match_competitors').insert({
      match_id: match!.id,
      side: 'SIDE_B',
      competitor_name: 'Player B',
    }).select('id').single();

    await supabaseAdmin.from('match_participants').insert([
      { match_id: match!.id, competitor_id: sideA!.id, user_id: testUserId1, display_name: 'A' },
      { match_id: match!.id, competitor_id: sideB!.id, user_id: testUserId2, display_name: 'B' },
    ]);

    // Transition to SCHEDULED
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', match!.id);

    // Transition to LIVE
    const { data: liveMatch } = await supabaseAdmin.from('matches').update({
      status: 'LIVE'
    }).eq('id', match!.id).select('actual_start').single();

    expect(liveMatch?.actual_start).toBeDefined();
    expect(new Date(liveMatch?.actual_start).getTime()).toBeGreaterThan(Date.now() - 10000);

    // Transition to COMPLETED
    const { data: completedMatch } = await supabaseAdmin.from('matches').update({
      status: 'COMPLETED',
      winner_side: 'SIDE_A',
      result_summary: 'Player A won 21-19, 21-17'
    }).eq('id', match!.id).select('actual_end, winner_side').single();

    expect(completedMatch?.actual_end).toBeDefined();
    expect(completedMatch?.winner_side).toBe('SIDE_A');

    // Cleanup
    await supabaseAdmin.from('matches').delete().eq('id', match!.id);
  });

  // 13. RLS Security: Anonymous access rejected
  it('13. RLS Security: Anonymous users cannot insert matches', async () => {
    const { error } = await supabaseAnon.from('matches').insert({
      sport_id: badmintonSportId,
      created_by: testUserId1,
      status: 'DRAFT',
    });

    expect(error).toBeDefined();
  });
});
