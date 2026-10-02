-- ============================================================================
-- Migration: 022_organization_settings_and_audit_logs.sql
-- Description: STEP 10 — Organization settings extensions, audit logging & immutability
-- ============================================================================

-- 1. Add extensible operational settings JSONB to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{
    "booking": {
      "min_booking_duration_minutes": 30,
      "max_booking_duration_minutes": 480,
      "hold_duration_minutes": 10,
      "cancellation_window_hours": 2,
      "buffer_minutes": 0,
      "allow_auto_confirm": true
    },
    "payment": {
      "enabled_methods": ["SANDBOX", "PAYHERE", "DIRECT_BANK", "CASH"],
      "allow_offline_payments": true,
      "offline_payment_instructions": "Pay at the front desk before game time.",
      "tax_registration_number": null
    },
    "notifications": {
      "email_enabled": true,
      "sms_enabled": false,
      "booking_confirmation_enabled": true,
      "hold_reminder_enabled": true,
      "marketing_consent_required": true
    }
  }'::jsonb;

-- 2. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (char_length(trim(action)) > 0),
  entity_type TEXT NOT NULL CHECK (char_length(trim(entity_type)) > 0),
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Immutability Trigger for Audit Logs (Append-Only Guarantee)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are strictly immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 4. Enable Row Level Security on Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies for Audit Logs
CREATE POLICY "audit_logs_select_authorized_staff"
  ON public.audit_logs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (
      organization_id IS NOT NULL
      AND public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

CREATE POLICY "audit_logs_insert_authorized_staff"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      organization_id IS NOT NULL
      AND public.is_org_member(organization_id)
      AND actor_user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies exist for public.audit_logs (guaranteed append-only)

-- 6. Performance Indexes for Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_at
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON public.audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (action, created_at DESC);

COMMENT ON TABLE public.audit_logs IS 'Immutable audit ledger recording all administrative, financial, and membership activities.';
