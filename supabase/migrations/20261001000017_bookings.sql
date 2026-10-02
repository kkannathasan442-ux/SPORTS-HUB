-- ============================================================================
-- Migration: 017_bookings.sql
-- Description: Core booking schema, status enums, and double-booking prevention
-- ============================================================================

-- Enable btree_gist for exclusion constraints combining UUID and Range types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Booking Status Enum
CREATE TYPE public.booking_status AS ENUM (
  'HOLD',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'COMPLETED',
  'NO_SHOW'
);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_profile_id UUID REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  
  -- Time tracking
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  
  -- The actual interval for double-booking protection (includes buffer)
  protected_time_range TSTZRANGE NOT NULL,
  
  status public.booking_status NOT NULL DEFAULT 'HOLD',
  
  -- Financial tracking
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  price_snapshot JSONB NOT NULL,
  
  -- Optional metadata
  customer_note TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  hold_expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add PostgreSQL exclusion constraint for double booking protection
-- We only consider HOLD and CONFIRMED as active
ALTER TABLE public.bookings ADD CONSTRAINT prevent_double_booking
  EXCLUDE USING gist (
    facility_id WITH =,
    protected_time_range WITH &&
  )
  WHERE (status IN ('HOLD', 'CONFIRMED'));

-- RLS setup
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Customers can view their own bookings
CREATE POLICY "Customers can view their own bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

-- Customers can insert their own bookings (server validated constraints limit this practically via UI)
CREATE POLICY "Customers can insert their own bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

-- Customers can update their own bookings
CREATE POLICY "Customers can update their own bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (customer_user_id = auth.uid())
  WITH CHECK (customer_user_id = auth.uid());

-- Owners can view bookings in their organization
CREATE POLICY "Owners can view organization bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bookings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'ACTIVE'
    )
  );

-- Indexes
CREATE INDEX idx_bookings_customer_user_id ON public.bookings(customer_user_id);
CREATE INDEX idx_bookings_organization_id ON public.bookings(organization_id);
CREATE INDEX idx_bookings_venue_id ON public.bookings(venue_id);
CREATE INDEX idx_bookings_facility_id ON public.bookings(facility_id);
CREATE INDEX idx_bookings_booking_date ON public.bookings(booking_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_protected_range ON public.bookings USING gist (protected_time_range);

COMMENT ON TABLE public.bookings IS 'Stores all facility bookings, including temporary holds and confirmed reservations.';
