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
-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  v_customer_a UUID := '11111111-1111-1111-1111-111111111111';
  v_customer_b UUID := '22222222-2222-2222-2222-222222222222';
  v_owner_a UUID := '33333333-3333-3333-3333-333333333333';
  v_manager_a UUID := '44444444-4444-4444-4444-444444444444';
  v_receptionist_a UUID := '55555555-5555-5555-5555-555555555555';
  v_customer_orgb UUID := '66666666-6666-6666-6666-666666666666';

  v_org_a UUID := '77777777-7777-7777-7777-777777777777';
  v_org_b UUID := '88888888-8888-8888-8888-888888888888';

  v_team_a UUID := '99999999-9999-9999-9999-999999999999';
  v_team_b UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN

  -- 1. Create auth.users
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, is_super_admin)
  VALUES
    (v_customer_a, '00000000-0000-0000-0000-000000000000', 'step14.customer.a@test.local', extensions.crypt('TestPass123!', extensions.gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"first_name":"Customer", "last_name":"A"}', now(), now(), 'authenticated', false),
    (v_customer_b, '00000000-0000-0000-0000-000000000000', 'step14.customer.b@test.local', extensions.crypt('TestPass123!', extensions.gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"first_name":"Customer", "last_name":"B"}', now(), now(), 'authenticated', false),
    (v_owner_a, '00000000-0000-0000-0000-000000000000', 'step14.owner.a@test.local', extensions.crypt('TestPass123!', extensions.gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"first_name":"Owner", "last_name":"A"}', now(), now(), 'authenticated', false),
    (v_manager_a, '00000000-0000-0000-0000-000000000000', 'step14.manager.a@test.local', extensions.crypt('TestPass123!', extensions.gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"first_name":"Manager", "last_name":"A"}', now(), now(), 'authenticated', false),
    (v_receptionist_a, '00000000-0000-0000-0000-000000000000', 'step14.receptionist.a@test.local', extensions.crypt('TestPass123!', extensions.gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"first_name":"Receptionist", "last_name":"A"}', now(), now(), 'authenticated', false),
    (v_customer_orgb, '00000000-0000-0000-0000-000000000000', 'step14.customer.orgb@test.local', extensions.crypt('TestPass123!', extensions.gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"first_name":"Customer", "last_name":"OrgB"}', now(), now(), 'authenticated', false)
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

  -- 2. Verify/Update profiles (created by auth trigger)
  UPDATE public.profiles
  SET full_name = (raw_user_meta_data->>'first_name') || ' ' || (raw_user_meta_data->>'last_name')
  FROM auth.users
  WHERE public.profiles.id = auth.users.id;

  -- Create customer_profiles for customers
  INSERT INTO public.customer_profiles (user_id, emergency_contact_phone)
  VALUES
    (v_customer_a, '+12345678901'),
    (v_customer_b, '+12345678902'),
    (v_customer_orgb, '+12345678903')
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Create ORG A and ORG B
  INSERT INTO public.organizations (id, name, slug, description, status)
  VALUES
    (v_org_a, 'ORG A', 'org-a', 'Test Org A', 'ACTIVE'),
    (v_org_b, 'ORG B', 'org-b', 'Test Org B', 'ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Create Organization Memberships
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES
    (v_org_a, v_owner_a, 'OWNER', 'ACTIVE'),
    (v_org_a, v_manager_a, 'MANAGER', 'ACTIVE'),
    (v_org_a, v_receptionist_a, 'RECEPTIONIST', 'ACTIVE'),
    (v_org_b, v_customer_orgb, 'CUSTOMER', 'ACTIVE')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- 5. Create TEAM A and TEAM B
  -- Assuming sport_id from the initial seed
  DECLARE
     v_sport_id UUID := '00000000-0000-0000-0000-000000000001'; -- Cricket
  BEGIN
      INSERT INTO public.teams (id, organization_id, sport_id, name, description, is_active, created_by)
      VALUES
        (v_team_a, v_org_a, v_sport_id, 'TEAM A', 'Team A Description', TRUE, v_owner_a),
        (v_team_b, NULL, v_sport_id, 'TEAM B', 'Team B Description', TRUE, v_customer_b)
      ON CONFLICT (id) DO NOTHING;
  END;

  -- 6. Team Ownership / Captains
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES
    (v_team_a, v_owner_a, 'CAPTAIN'),
    (v_team_b, v_customer_b, 'CAPTAIN')
  ON CONFLICT (team_id, user_id) DO NOTHING;

END $$;
