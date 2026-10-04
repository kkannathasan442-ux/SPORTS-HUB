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
