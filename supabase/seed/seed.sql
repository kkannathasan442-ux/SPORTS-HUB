-- ============================================================================
-- SportsHub Development Seed Dataset
-- STEP 2 — Core Catalog & Demo Organization / Venue / Facilities
-- ============================================================================

-- Deterministic UUIDs for development seed consistency
-- Sports
DO $$
DECLARE
  v_sport_cricket UUID := '00000000-0000-0000-0000-000000000001';
  v_sport_badminton UUID := '00000000-0000-0000-0000-000000000002';
  v_sport_basketball UUID := '00000000-0000-0000-0000-000000000003';
  v_sport_table_tennis UUID := '00000000-0000-0000-0000-000000000004';
  v_sport_chess UUID := '00000000-0000-0000-0000-000000000005';
  v_sport_carrom UUID := '00000000-0000-0000-0000-000000000006';

  -- Organization & Venue
  v_org_demo UUID := '10000000-0000-0000-0000-000000000001';
  v_venue_demo UUID := '20000000-0000-0000-0000-000000000001';

  -- Facilities
  v_fac_cricket UUID := '30000000-0000-0000-0000-000000000001';
  v_fac_badminton_1 UUID := '30000000-0000-0000-0000-000000000002';
  v_fac_badminton_2 UUID := '30000000-0000-0000-0000-000000000003';
  v_fac_basketball UUID := '30000000-0000-0000-0000-000000000004';
  v_fac_table_tennis UUID := '30000000-0000-0000-0000-000000000005';
  v_fac_chess UUID := '30000000-0000-0000-0000-000000000006';
  v_fac_carrom UUID := '30000000-0000-0000-0000-000000000007';

  v_day SMALLINT;
BEGIN

  -- 1. Insert Initial 6 Sports
  INSERT INTO public.sports (id, name, slug, description, is_active, supports_booking, supports_team, supports_tournament, supports_live_scoring)
  VALUES
    (v_sport_cricket, 'Cricket', 'cricket', 'Nets, turf pitches, full ground matches, and live scoring.', TRUE, TRUE, TRUE, TRUE, TRUE),
    (v_sport_badminton, 'Badminton', 'badminton', 'Indoor synthetic & wooden court reservations and doubles tournaments.', TRUE, TRUE, FALSE, TRUE, TRUE),
    (v_sport_basketball, 'Basketball', 'basketball', 'Full court and half court hourly bookings and pickup games.', TRUE, TRUE, TRUE, TRUE, FALSE),
    (v_sport_table_tennis, 'Table Tennis', 'table-tennis', 'ITTF-standard indoor tables, robot training, and ladder tournaments.', TRUE, TRUE, FALSE, TRUE, TRUE),
    (v_sport_chess, 'Chess', 'chess', 'Rapid, Blitz, and Classical rated matches and coaching clinics.', TRUE, TRUE, FALSE, TRUE, TRUE),
    (v_sport_carrom, 'Carrom', 'carrom', 'Championship powder boards for singles and doubles club matches.', TRUE, TRUE, FALSE, TRUE, FALSE)
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    supports_booking = EXCLUDED.supports_booking,
    supports_team = EXCLUDED.supports_team,
    supports_tournament = EXCLUDED.supports_tournament,
    supports_live_scoring = EXCLUDED.supports_live_scoring;

  -- 2. Insert Demo Organization
  INSERT INTO public.organizations (id, name, slug, description, status, currency, timezone)
  VALUES (
    v_org_demo,
    'Demo Sports Group',
    'demo-sports-group',
    'Premier multi-sport facilities operator in Western Province.',
    'ACTIVE',
    'LKR',
    'Asia/Colombo'
  )
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status;

  -- 3. Insert Demo Venue
  INSERT INTO public.venues (
    id,
    organization_id,
    name,
    slug,
    description,
    address_line_1,
    city,
    district,
    postal_code,
    latitude,
    longitude,
    phone,
    email,
    status,
    timezone
  )
  VALUES (
    v_venue_demo,
    v_org_demo,
    'Demo Sports Arena',
    'demo-sports-arena',
    'State-of-the-art multi-sport complex with turf nets, badminton courts, and indoor games lounge.',
    '100 Sports Complex Road',
    'Colombo',
    'Colombo',
    '00700',
    6.927079,
    79.861244,
    '+94 11 234 5678',
    'arena@demosports.local',
    'ACTIVE',
    'Asia/Colombo'
  )
  ON CONFLICT (organization_id, slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status;

  -- 4. Connect Demo Venue to Supported Sports
  INSERT INTO public.venue_sports (venue_id, sport_id, is_active)
  VALUES
    (v_venue_demo, v_sport_cricket, TRUE),
    (v_venue_demo, v_sport_badminton, TRUE),
    (v_venue_demo, v_sport_basketball, TRUE),
    (v_venue_demo, v_sport_table_tennis, TRUE),
    (v_venue_demo, v_sport_chess, TRUE),
    (v_venue_demo, v_sport_carrom, TRUE)
  ON CONFLICT (venue_id, sport_id) DO NOTHING;

  -- 5. Insert Demo Facilities
  INSERT INTO public.facilities (id, venue_id, sport_id, name, slug, facility_type, capacity, status, is_bookable, default_duration_minutes, buffer_minutes)
  VALUES
    (v_fac_cricket, v_venue_demo, v_sport_cricket, 'Cricket Turf 01', 'cricket-turf-01', 'Turf Net', 12, 'AVAILABLE', TRUE, 60, 0),
    (v_fac_badminton_1, v_venue_demo, v_sport_badminton, 'Badminton Court 01', 'badminton-court-01', 'Synthetic Court', 4, 'AVAILABLE', TRUE, 60, 0),
    (v_fac_badminton_2, v_venue_demo, v_sport_badminton, 'Badminton Court 02', 'badminton-court-02', 'Wooden Court', 4, 'AVAILABLE', TRUE, 60, 0),
    (v_fac_basketball, v_venue_demo, v_sport_basketball, 'Basketball Court 01', 'basketball-court-01', 'Indoor Hardwood', 10, 'AVAILABLE', TRUE, 60, 0),
    (v_fac_table_tennis, v_venue_demo, v_sport_table_tennis, 'Table Tennis Table 01', 'table-tennis-table-01', 'ITTF Standard Table', 4, 'AVAILABLE', TRUE, 60, 0),
    (v_fac_chess, v_venue_demo, v_sport_chess, 'Chess Room', 'chess-room', 'Quiet Arena Room', 10, 'AVAILABLE', TRUE, 60, 0),
    (v_fac_carrom, v_venue_demo, v_sport_carrom, 'Carrom Room', 'carrom-room', 'Tournament Powder Board Room', 8, 'AVAILABLE', TRUE, 60, 0)
  ON CONFLICT (venue_id, slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    capacity = EXCLUDED.capacity,
    status = EXCLUDED.status;

  -- 6. Insert Operating Hours (Mon-Sun: 06:00 to 23:00)
  FOR v_day IN 0..6 LOOP
    INSERT INTO public.venue_operating_hours (venue_id, day_of_week, open_time, close_time, is_closed)
    VALUES (v_venue_demo, v_day, '06:00:00'::TIME, '23:00:00'::TIME, FALSE)
    ON CONFLICT (venue_id, day_of_week) DO UPDATE
    SET
      open_time = EXCLUDED.open_time,
      close_time = EXCLUDED.close_time,
      is_closed = EXCLUDED.is_closed;
  END LOOP;

  -- 7. Insert Base Hourly Pricing Rules for Demo Facilities
  INSERT INTO public.pricing_rules (organization_id, venue_id, facility_id, name, pricing_type, price_per_hour, member_price, priority, is_active)
  VALUES
    (v_org_demo, v_venue_demo, v_fac_cricket, 'Cricket Turf Standard Hourly', 'BASE', 3500.00, 3000.00, 0, TRUE),
    (v_org_demo, v_venue_demo, v_fac_badminton_1, 'Badminton Court 1 Standard Hourly', 'BASE', 2000.00, 1800.00, 0, TRUE),
    (v_org_demo, v_venue_demo, v_fac_badminton_2, 'Badminton Court 2 Standard Hourly', 'BASE', 2200.00, 1900.00, 0, TRUE),
    (v_org_demo, v_venue_demo, v_fac_basketball, 'Basketball Court Standard Hourly', 'BASE', 4000.00, 3500.00, 0, TRUE),
    (v_org_demo, v_venue_demo, v_fac_table_tennis, 'Table Tennis Standard Hourly', 'BASE', 1200.00, 1000.00, 0, TRUE),
    (v_org_demo, v_venue_demo, v_fac_chess, 'Chess Room Standard Hourly', 'BASE', 1000.00, 800.00, 0, TRUE),
    (v_org_demo, v_venue_demo, v_fac_carrom, 'Carrom Room Standard Hourly', 'BASE', 1000.00, 800.00, 0, TRUE)
  ON CONFLICT DO NOTHING;

END $$;
