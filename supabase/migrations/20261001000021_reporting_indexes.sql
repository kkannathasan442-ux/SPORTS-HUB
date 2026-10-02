-- ============================================================================
-- Migration: 20261001000021_reporting_indexes.sql
-- Description: STEP 9 — Reporting, Analytics & Business Intelligence Indexes
-- ============================================================================

-- 1. Composite Index for Date-Range Booking Aggregations
CREATE INDEX IF NOT EXISTS idx_bookings_org_date 
  ON public.bookings (organization_id, booking_date DESC, status);

-- 2. Index for Facility-Level Utilization Aggregations
CREATE INDEX IF NOT EXISTS idx_bookings_facility_status_date 
  ON public.bookings (facility_id, status, booking_date);

-- 3. Composite Index for Payment Transaction Revenue Aggregations
CREATE INDEX IF NOT EXISTS idx_payments_org_created_status 
  ON public.payment_transactions (organization_id, created_at DESC, status);

-- 4. Composite Index for Refund Aggregations
CREATE INDEX IF NOT EXISTS idx_refunds_org_created_status 
  ON public.refund_records (organization_id, created_at DESC, status);

-- 5. Index for Customer Booking History Cohorts
CREATE INDEX IF NOT EXISTS idx_bookings_customer_org 
  ON public.bookings (organization_id, customer_user_id, created_at DESC);
