-- ============================================================================
-- Migration: 013_customer_profiles.sql
-- Description: Extended player and customer application profile information
-- ============================================================================

CREATE TABLE public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.customer_profiles IS 'Extended customer and athlete profile information (emergency contacts, preferences).';
