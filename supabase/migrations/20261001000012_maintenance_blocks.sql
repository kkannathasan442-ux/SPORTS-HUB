-- ============================================================================
-- Migration: 012_maintenance_blocks.sql
-- Description: Scheduled maintenance closures and unavailable time intervals
-- ============================================================================

CREATE TABLE public.maintenance_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status public.maintenance_block_status NOT NULL DEFAULT 'ACTIVE',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_maintenance_blocks_period CHECK (start_at < end_at),
  -- Strict multi-tenant composite foreign keys
  CONSTRAINT fk_maintenance_blocks_venue_org FOREIGN KEY (venue_id, organization_id)
    REFERENCES public.venues(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_blocks_facility_venue FOREIGN KEY (facility_id, venue_id)
    REFERENCES public.facilities(id, venue_id) ON DELETE CASCADE
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_maintenance_blocks_updated_at
  BEFORE UPDATE ON public.maintenance_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.maintenance_blocks IS 'Scheduled maintenance downtime blocks for specific facilities within a venue.';
