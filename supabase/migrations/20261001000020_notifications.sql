-- ============================================================================
-- Migration: 20261001000020_notifications.sql
-- Description: STEP 8 — Notifications & Communication System
-- Tables: public.notifications, public.notification_preferences
-- Enums: notification_type, notification_channel, notification_status
-- ============================================================================

-- 1. Custom Types & Enums
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'BOOKING_HOLD_CREATED',
    'BOOKING_HOLD_EXPIRING',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'WALK_IN_BOOKING_CREATED',
    'PAYMENT_PENDING',
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
    'REFUND_PROCESSED',
    'SYSTEM_ALERT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM (
    'IN_APP',
    'EMAIL',
    'SMS',
    'PUSH'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT NOT NULL, -- 'booking', 'payment', 'refund', 'system'
  related_entity_id UUID,
  channel public.notification_channel NOT NULL DEFAULT 'IN_APP',
  status public.notification_status NOT NULL DEFAULT 'SENT',
  idempotency_key TEXT UNIQUE,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_booking_confirmations BOOLEAN NOT NULL DEFAULT true,
  email_payment_receipts BOOLEAN NOT NULL DEFAULT true,
  email_hold_reminders BOOLEAN NOT NULL DEFAULT true,
  email_cancellations BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON public.notifications (recipient_user_id, read_at) 
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
  ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_org_created 
  ON public.notifications (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_idempotency 
  ON public.notifications (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_notifications_related_entity 
  ON public.notifications (related_entity_type, related_entity_id);

-- 5. Enable Row-Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for Notifications

-- Customers can view their own notifications
CREATE POLICY "notifications_customer_select"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
  );

-- Organization staff can view notifications related to their organization
CREATE POLICY "notifications_staff_select"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND public.is_org_member(organization_id)
  );

-- Recipients can update only the read_at timestamp on their own notifications
CREATE POLICY "notifications_customer_update_read"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- Deny public/anonymous access to notifications
CREATE POLICY "notifications_public_deny"
  ON public.notifications
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 7. RLS Policies for Preferences

-- Users can view their own notification preferences
CREATE POLICY "notification_preferences_select"
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own notification preferences
CREATE POLICY "notification_preferences_insert"
  ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own notification preferences
CREATE POLICY "notification_preferences_update"
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Deny public/anonymous access to preferences
CREATE POLICY "notification_preferences_public_deny"
  ON public.notification_preferences
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
