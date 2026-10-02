-- ============================================================================
-- Migration: 003_profiles.sql
-- Description: Application user profiles linked to Supabase Auth (auth.users)
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) > 0),
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  gender TEXT,
  country_code VARCHAR(8) DEFAULT '+94',
  preferred_language VARCHAR(10) DEFAULT 'en',
  timezone TEXT DEFAULT 'Asia/Colombo',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.profiles IS 'Application-level user profile metadata linked to Supabase auth.users.';
