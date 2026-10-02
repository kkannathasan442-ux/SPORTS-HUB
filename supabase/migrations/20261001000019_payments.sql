-- ============================================================================
-- Migration: 019_payments.sql
-- Description: Payment transactions, refunds, and financial ledger foundation
-- ============================================================================

-- 1. Payment Status Enum
CREATE TYPE public.payment_status AS ENUM (
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

-- 2. Payment Method Enum
CREATE TYPE public.payment_method AS ENUM (
  'CARD',
  'ONLINE_BANKING',
  'WALLET',
  'CASH',
  'BANK_TRANSFER',
  'COMPLIMENTARY'
);

-- 3. Payment Transactions Table
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider details
  provider VARCHAR(50) NOT NULL DEFAULT 'SANDBOX',
  provider_transaction_id VARCHAR(100),
  provider_reference VARCHAR(100),
  idempotency_key VARCHAR(100) UNIQUE NOT NULL,
  
  -- Financial details
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  
  -- State & Classification
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  payment_method public.payment_method NOT NULL DEFAULT 'CARD',
  
  -- Failure Tracking
  failure_code VARCHAR(50),
  failure_message TEXT,
  
  -- Metadata & Auditing
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_refund_not_exceed_amount CHECK (refunded_amount <= amount)
);

-- 4. Refund Records Table
CREATE TABLE public.refund_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  provider_refund_id VARCHAR(100),
  refunded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Updated At Trigger
CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Indexes for High-Performance Queries & Security Lookups
CREATE INDEX idx_payment_transactions_booking_id ON public.payment_transactions(booking_id);
CREATE INDEX idx_payment_transactions_org_id ON public.payment_transactions(organization_id);
CREATE INDEX idx_payment_transactions_venue_id ON public.payment_transactions(venue_id);
CREATE INDEX idx_payment_transactions_customer_id ON public.payment_transactions(customer_user_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_payment_transactions_created_at ON public.payment_transactions(created_at);
CREATE INDEX idx_payment_transactions_idempotency ON public.payment_transactions(idempotency_key);
CREATE INDEX idx_payment_transactions_provider_tx ON public.payment_transactions(provider, provider_transaction_id);

CREATE INDEX idx_refund_records_transaction_id ON public.refund_records(transaction_id);
CREATE INDEX idx_refund_records_booking_id ON public.refund_records(booking_id);
CREATE INDEX idx_refund_records_org_id ON public.refund_records(organization_id);

-- 7. Row Level Security (RLS)
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;

-- Customers can view their own payment transactions
CREATE POLICY "Customers can view their own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

-- Organization staff/owners can view payment transactions belonging to their organization
CREATE POLICY "Staff can view organization payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = payment_transactions.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'ACTIVE'
    )
  );

-- Customers can view refunds for their own bookings
CREATE POLICY "Customers can view their own refunds"
  ON public.refund_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payment_transactions
      WHERE payment_transactions.id = refund_records.transaction_id
      AND payment_transactions.customer_user_id = auth.uid()
    )
  );

-- Staff can view refunds in their organization
CREATE POLICY "Staff can view organization refunds"
  ON public.refund_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = refund_records.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'ACTIVE'
    )
  );

COMMENT ON TABLE public.payment_transactions IS 'Authoritative ledger of all financial transactions and payment attempts.';
COMMENT ON TABLE public.refund_records IS 'Historical audit trail of all refunds issued for booking payments.';
