/**
 * SportsHub Organization Settings Management Service — STEP 10
 *
 * Provides typed access and authorized updates to organization profiles and operational settings.
 * Enforces schema validation, safe defaults, and immutable audit logging.
 */

import { createSupabaseServerClient } from '../supabase/server';
import { createAuditLog } from '../audit/audit-service';
import type {
  OrganizationOperationalSettings,
  OrganizationWithSettings,
} from '@sportshub/types';
import type { UpdateOrganizationSettingsSchema } from '@sportshub/validation';

export const DEFAULT_OPERATIONAL_SETTINGS: OrganizationOperationalSettings = {
  booking: {
    min_booking_duration_minutes: 30,
    max_booking_duration_minutes: 480,
    hold_duration_minutes: 10,
    cancellation_window_hours: 2,
    buffer_minutes: 0,
    allow_auto_confirm: true,
  },
  payment: {
    enabled_methods: ['SANDBOX', 'PAYHERE', 'DIRECT_BANK', 'CASH'],
    allow_offline_payments: true,
    offline_payment_instructions: 'Pay at the front desk before game time.',
    tax_registration_number: null,
  },
  notifications: {
    email_enabled: true,
    sms_enabled: false,
    booking_confirmation_enabled: true,
    hold_reminder_enabled: true,
    marketing_consent_required: true,
  },
};

/**
 * Fetch organization with typed operational settings merged with safe defaults
 */
export async function fetchOrganizationWithSettings(
  organizationId: string
): Promise<OrganizationWithSettings | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (error || !data) {
    console.error('Error fetching organization with settings:', error);
    return null;
  }

  const rawSettings = (data.settings || {}) as Partial<OrganizationOperationalSettings>;

  const mergedSettings: OrganizationOperationalSettings = {
    booking: {
      ...DEFAULT_OPERATIONAL_SETTINGS.booking,
      ...(rawSettings.booking || {}),
    },
    payment: {
      ...DEFAULT_OPERATIONAL_SETTINGS.payment,
      ...(rawSettings.payment || {}),
    },
    notifications: {
      ...DEFAULT_OPERATIONAL_SETTINGS.notifications,
      ...(rawSettings.notifications || {}),
    },
  };

  return {
    ...data,
    settings: mergedSettings,
  } as OrganizationWithSettings;
}

/**
 * Update organization profile and operational settings
 */
export async function updateOrganizationWithSettings(
  organizationId: string,
  actorUserId: string,
  input: UpdateOrganizationSettingsSchema
): Promise<{ success: boolean; organization?: OrganizationWithSettings; error?: string }> {
  const current = await fetchOrganizationWithSettings(organizationId);
  if (!current) {
    return { success: false, error: 'Organization not found.' };
  }

  const beforeData = {
    name: current.name,
    description: current.description,
    logo_url: current.logo_url,
    phone: current.phone,
    email: current.email,
    website: current.website,
    currency: current.currency,
    timezone: current.timezone,
    settings: current.settings,
  };

  const updatedSettings: OrganizationOperationalSettings = {
    booking: {
      ...current.settings!.booking,
      ...(input.settings?.booking || {}),
    },
    payment: {
      ...current.settings!.payment,
      ...(input.settings?.payment || {}),
    },
    notifications: {
      ...current.settings!.notifications,
      ...(input.settings?.notifications || {}),
    },
  };

  const updatePayload: Record<string, unknown> = {
    settings: updatedSettings,
  };

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.logo_url !== undefined) updatePayload.logo_url = input.logo_url || null;
  if (input.phone !== undefined) updatePayload.phone = input.phone || null;
  if (input.email !== undefined) updatePayload.email = input.email || null;
  if (input.website !== undefined) updatePayload.website = input.website || null;
  if (input.currency !== undefined) updatePayload.currency = input.currency;
  if (input.timezone !== undefined) updatePayload.timezone = input.timezone;

  const supabase = await createSupabaseServerClient();
  const { data: updatedOrg, error: updateErr } = await supabase
    .from('organizations')
    .update(updatePayload)
    .eq('id', organizationId)
    .select()
    .single();

  if (updateErr || !updatedOrg) {
    return { success: false, error: updateErr?.message || 'Failed to update organization settings.' };
  }

  const resultOrg: OrganizationWithSettings = {
    ...updatedOrg,
    settings: updatedSettings,
  };

  // Record audit log
  await createAuditLog({
    organizationId,
    actorUserId,
    action: 'ORGANIZATION_SETTINGS_UPDATED',
    entityType: 'organizations',
    entityId: organizationId,
    beforeData,
    afterData: {
      name: resultOrg.name,
      description: resultOrg.description,
      logo_url: resultOrg.logo_url,
      phone: resultOrg.phone,
      email: resultOrg.email,
      website: resultOrg.website,
      currency: resultOrg.currency,
      timezone: resultOrg.timezone,
      settings: updatedSettings,
    },
    metadata: {
      updatedFields: Object.keys(updatePayload),
    },
  });

  return { success: true, organization: resultOrg };
}
