-- ============================================================================
-- Migration: 023_booking_operations.sql
-- Description: Adds fields for check-in tracking, walk-in support and staff RLS
-- ============================================================================

ALTER TABLE public.bookings
ADD COLUMN checked_in_at TIMESTAMPTZ,
ADD COLUMN checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN is_walk_in BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN walk_in_customer_name TEXT;

COMMENT ON COLUMN public.bookings.checked_in_at IS 'Timestamp when the customer physically arrived and was checked in.';
COMMENT ON COLUMN public.bookings.checked_in_by IS 'Staff member who performed the check-in.';
COMMENT ON COLUMN public.bookings.is_walk_in IS 'Flags if this booking was created on-site by staff without a prior reservation.';
COMMENT ON COLUMN public.bookings.walk_in_customer_name IS 'Name of the walk-in customer if not using a registered profile.';

-- Add Staff UPDATE policy so they can check in / mark no show
CREATE POLICY "Staff can update organization bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bookings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'ACTIVE'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bookings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'ACTIVE'
    )
  );

-- Add Staff INSERT policy so they can create walk-in bookings
CREATE POLICY "Staff can insert organization walk-in bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bookings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'ACTIVE'
    )
  );
