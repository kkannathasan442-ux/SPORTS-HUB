-- ============================================================================
-- Migration: 011_pricing_rules.sql
-- Description: Dynamic and base hourly pricing rules for venues and facilities
-- ============================================================================

CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  pricing_type public.pricing_type NOT NULL,
  day_of_week SMALLINT CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6)),
  start_time TIME,
  end_time TIME,
  price_per_hour NUMERIC(12,2) NOT NULL CHECK (price_per_hour >= 0),
  member_price NUMERIC(12,2) CHECK (member_price IS NULL OR member_price >= 0),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pricing_rules_times CHECK (
    (start_time IS NULL AND end_time IS NULL) OR 
    (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  ),
  CONSTRAINT chk_pricing_rules_dates CHECK (
    (valid_from IS NULL OR valid_until IS NULL) OR (valid_from <= valid_until)
  ),
  -- Strict multi-tenant composite foreign keys to guarantee relational integrity
  CONSTRAINT fk_pricing_rules_venue_org FOREIGN KEY (venue_id, organization_id)
    REFERENCES public.venues(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_pricing_rules_facility_venue FOREIGN KEY (facility_id, venue_id)
    REFERENCES public.facilities(id, venue_id) ON DELETE CASCADE
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.pricing_rules IS 'Tiered pricing matrix (base, peak, member, weekend) for venues and specific facilities.';
