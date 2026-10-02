-- ============================================================================
-- Migration: 015_auth_profile_sync.sql
-- Description: Automated auth profile synchronization and owner onboarding RPC
-- ============================================================================

-- Function to safely synchronize auth.users creation into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  -- Extract metadata safely without accepting untrusted roles or privileges
  v_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  IF v_full_name IS NULL THEN
    v_full_name := COALESCE(NULLIF(TRIM(SPLIT_PART(NEW.email, '@', 1)), ''), 'SportsHub User');
  END IF;

  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');

  -- Insert or update user profile with restricted attributes
  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_phone,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to safely synchronize basic auth.users metadata into public.profiles.';

-- Trigger on auth.users for new user sign-ups
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Safe RPC to create an organization with the current authenticated user as OWNER
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_currency VARCHAR(3) DEFAULT 'LKR',
  p_timezone TEXT DEFAULT 'Asia/Colombo'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_trimmed_name TEXT;
  v_trimmed_slug TEXT;
BEGIN
  -- Verify caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register an organization.';
  END IF;

  v_trimmed_name := TRIM(p_name);
  v_trimmed_slug := TRIM(p_slug);

  IF char_length(v_trimmed_name) = 0 THEN
    RAISE EXCEPTION 'Organization name cannot be empty.';
  END IF;

  IF char_length(v_trimmed_slug) = 0 OR NOT (v_trimmed_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') THEN
    RAISE EXCEPTION 'Organization slug is invalid.';
  END IF;

  -- Ensure profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (v_user_id, 'SportsHub Owner', TRUE);
  END IF;

  -- Insert new organization
  INSERT INTO public.organizations (
    name,
    slug,
    currency,
    timezone,
    status
  )
  VALUES (
    v_trimmed_name,
    v_trimmed_slug,
    COALESCE(p_currency, 'LKR'),
    COALESCE(p_timezone, 'Asia/Colombo'),
    'ACTIVE'::public.organization_status
  )
  RETURNING id INTO v_org_id;

  -- Insert membership as OWNER with ACTIVE status
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_org_id,
    v_user_id,
    'OWNER'::public.app_role,
    'ACTIVE'::public.member_status
  );

  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, VARCHAR, TEXT) IS 'Atomic RPC to create an organization and assign the authenticated caller as OWNER.';
