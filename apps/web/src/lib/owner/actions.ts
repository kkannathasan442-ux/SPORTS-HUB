'use server';

/**
 * SportsHub Owner Management Server Actions
 *
 * Provides strictly authorized server-side mutations for:
 * - Organization settings
 * - Venues (Create, Edit)
 * - Venue Sports (Assign, Toggle)
 * - Facilities (Create, Edit)
 * - Operating Hours (Weekly Schedule)
 * - Pricing Rules (Create, Edit, Delete)
 * - Maintenance Blocks (Create, Cancel)
 *
 * All actions strictly enforce server-side active organization resolution,
 * membership verification, role authorization, and tenant isolation.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '../supabase/server';
import { getActiveOrganizationContext } from '../auth/current-user';
import { requireOrganizationRole } from '../auth/authorization';
import { formatAuthError } from '../auth/errors';
import {
  updateOrganizationSchema,
  createVenueInputSchema,
  updateVenueInputSchema,
  createFacilityInputSchema,
  updateFacilityInputSchema,
  updateOperatingHoursInputSchema,
  createPricingRuleInputSchema,
  createMaintenanceBlockInputSchema,
  type DailyOperatingHourInputSchema,
} from '@sportshub/validation';
import type { ActionState } from '../auth/actions';

/**
 * 1. Update Organization Profile & Settings
 * Allowed roles: OWNER, SUPER_ADMIN
 */
export async function updateOrganizationAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    const authContext = await requireOrganizationRole(orgId, ['OWNER', 'SUPER_ADMIN']);

    const rawData = {
      name: formData.get('name'),
      description: formData.get('description'),
      logo_url: formData.get('logo_url') || null,
      phone: formData.get('phone') || null,
      email: formData.get('email') || null,
      website: formData.get('website') || null,
      currency: formData.get('currency') || 'LKR',
      timezone: formData.get('timezone') || 'Asia/Colombo',
    };

    const parsed = updateOrganizationSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Please correct the highlighted form errors.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    // Parse optional settings if provided in form
    const holdDuration = formData.get('hold_duration_minutes');
    const cancelWindow = formData.get('cancellation_window_hours');
    const minDuration = formData.get('min_booking_duration_minutes');
    const maxDuration = formData.get('max_booking_duration_minutes');
    const autoConfirm = formData.get('allow_auto_confirm');
    const offlinePayments = formData.get('allow_offline_payments');
    const offlineInstructions = formData.get('offline_payment_instructions');
    const taxNumber = formData.get('tax_registration_number');
    const emailNotif = formData.get('email_enabled');
    const confirmNotif = formData.get('booking_confirmation_enabled');
    const reminderNotif = formData.get('hold_reminder_enabled');
    const enabledMethods = formData.getAll('enabled_methods') as string[];

    const supabase = await createSupabaseServerClient();

    // Fetch existing settings to merge
    const { data: currentOrg } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();

    const existingSettings = currentOrg?.settings || {};
    const updatedSettings = {
      booking: {
        min_booking_duration_minutes: minDuration ? Number(minDuration) : existingSettings.booking?.min_booking_duration_minutes ?? 30,
        max_booking_duration_minutes: maxDuration ? Number(maxDuration) : existingSettings.booking?.max_booking_duration_minutes ?? 480,
        hold_duration_minutes: holdDuration ? Number(holdDuration) : existingSettings.booking?.hold_duration_minutes ?? 10,
        cancellation_window_hours: cancelWindow ? Number(cancelWindow) : existingSettings.booking?.cancellation_window_hours ?? 2,
        buffer_minutes: existingSettings.booking?.buffer_minutes ?? 0,
        allow_auto_confirm: autoConfirm !== null ? autoConfirm === 'on' || autoConfirm === 'true' : existingSettings.booking?.allow_auto_confirm ?? true,
      },
      payment: {
        enabled_methods: enabledMethods.length > 0 ? enabledMethods : existingSettings.payment?.enabled_methods ?? ['SANDBOX', 'PAYHERE', 'DIRECT_BANK', 'CASH'],
        allow_offline_payments: offlinePayments !== null ? offlinePayments === 'on' || offlinePayments === 'true' : existingSettings.payment?.allow_offline_payments ?? true,
        offline_payment_instructions: offlineInstructions ? String(offlineInstructions) : existingSettings.payment?.offline_payment_instructions ?? null,
        tax_registration_number: taxNumber ? String(taxNumber) : existingSettings.payment?.tax_registration_number ?? null,
      },
      notifications: {
        email_enabled: emailNotif !== null ? emailNotif === 'on' || emailNotif === 'true' : existingSettings.notifications?.email_enabled ?? true,
        sms_enabled: existingSettings.notifications?.sms_enabled ?? false,
        booking_confirmation_enabled: confirmNotif !== null ? confirmNotif === 'on' || confirmNotif === 'true' : existingSettings.notifications?.booking_confirmation_enabled ?? true,
        hold_reminder_enabled: reminderNotif !== null ? reminderNotif === 'on' || reminderNotif === 'true' : existingSettings.notifications?.hold_reminder_enabled ?? true,
        marketing_consent_required: existingSettings.notifications?.marketing_consent_required ?? true,
      },
    };

    const updatePayload = {
      ...parsed.data,
      settings: updatedSettings,
    };

    const { error } = await supabase
      .from('organizations')
      .update(updatePayload)
      .eq('id', orgId);

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    // Write audit log entry
    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      actor_user_id: authContext.user.id,
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entity_type: 'organizations',
      entity_id: orgId,
      after_data: updatePayload,
      metadata: { source: 'owner_dashboard' },
    });

    revalidatePath('/owner');
    revalidatePath('/owner/organization');
    revalidatePath('/owner/settings');

    return { success: true, message: 'Organization settings updated successfully.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 2. Create Venue
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function createVenueAction(
  _prevState: ActionState<{ venueId: string }> | null,
  formData: FormData
): Promise<ActionState<{ venueId: string }>> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const rawData = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      description: formData.get('description') || null,
      address_line_1: formData.get('address_line_1') || null,
      address_line_2: formData.get('address_line_2') || null,
      city: formData.get('city') || null,
      district: formData.get('district') || null,
      postal_code: formData.get('postal_code') || null,
      latitude: formData.get('latitude') || null,
      longitude: formData.get('longitude') || null,
      phone: formData.get('phone') || null,
      email: formData.get('email') || null,
      status: formData.get('status') || 'DRAFT',
      timezone: formData.get('timezone') || 'Asia/Colombo',
      cover_image_url: formData.get('cover_image_url') || null,
    };

    const parsed = createVenueInputSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Please correct the highlighted form errors.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data: venue, error } = await supabase
      .from('venues')
      .insert({
        ...parsed.data,
        organization_id: orgId,
      })
      .select('id')
      .single();

    if (error || !venue) {
      return { success: false, error: formatAuthError(error || new Error('Failed to create venue.')) };
    }

    // Seed default 7-day operating hours for new venue (0=Sun to 6=Sat)
    const initialHours = Array.from({ length: 7 }, (_, day) => ({
      venue_id: venue.id,
      day_of_week: day,
      open_time: '06:00:00',
      close_time: '22:00:00',
      is_closed: false,
    }));

    await supabase.from('venue_operating_hours').insert(initialHours);

    revalidatePath('/owner');
    revalidatePath('/owner/venues');

    return {
      success: true,
      message: 'Venue created successfully.',
      data: { venueId: venue.id },
    };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 3. Update Venue
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function updateVenueAction(
  venueId: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const rawData = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      description: formData.get('description') || null,
      address_line_1: formData.get('address_line_1') || null,
      address_line_2: formData.get('address_line_2') || null,
      city: formData.get('city') || null,
      district: formData.get('district') || null,
      postal_code: formData.get('postal_code') || null,
      latitude: formData.get('latitude') || null,
      longitude: formData.get('longitude') || null,
      phone: formData.get('phone') || null,
      email: formData.get('email') || null,
      status: formData.get('status') || undefined,
      timezone: formData.get('timezone') || 'Asia/Colombo',
      cover_image_url: formData.get('cover_image_url') || null,
    };

    const parsed = updateVenueInputSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Please correct the highlighted form errors.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('venues')
      .update(parsed.data)
      .eq('id', venueId)
      .eq('organization_id', orgId); // Strict tenant check

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath('/owner/venues');
    revalidatePath(`/owner/venues/${venueId}`);
    revalidatePath(`/owner/venues/${venueId}/edit`);

    return { success: true, message: 'Venue updated successfully.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 4. Attach or Toggle Venue Sport
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function toggleVenueSportAction(
  venueId: string,
  sportId: string,
  isActive: boolean
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const supabase = await createSupabaseServerClient();

    // Verify venue belongs to active organization
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venueId)
      .eq('organization_id', orgId)
      .single();

    if (vErr || !venue) {
      return { success: false, error: 'Venue not found in current organization.' };
    }

    // Upsert venue_sport association
    const { error } = await supabase
      .from('venue_sports')
      .upsert(
        {
          venue_id: venueId,
          sport_id: sportId,
          is_active: isActive,
        },
        { onConflict: 'venue_id,sport_id' }
      );

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath(`/owner/venues/${venueId}`);
    revalidatePath(`/owner/venues/${venueId}/sports`);
    revalidatePath(`/owner/venues/${venueId}/facilities`);

    return { success: true, message: isActive ? 'Sport enabled for venue.' : 'Sport disabled for venue.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 5. Create Facility
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function createFacilityAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const rawData = {
      venue_id: formData.get('venue_id'),
      sport_id: formData.get('sport_id') || null,
      name: formData.get('name'),
      slug: formData.get('slug'),
      description: formData.get('description') || null,
      facility_type: formData.get('facility_type') || null,
      capacity: formData.get('capacity') || null,
      status: formData.get('status') || 'AVAILABLE',
      is_bookable: formData.get('is_bookable') !== 'false',
      default_duration_minutes: formData.get('default_duration_minutes') || 60,
      buffer_minutes: formData.get('buffer_minutes') || 0,
    };

    const parsed = createFacilityInputSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Please correct the highlighted form errors.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { venue_id, sport_id } = parsed.data;
    const supabase = await createSupabaseServerClient();

    // Verify venue belongs to active organization
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venue_id)
      .eq('organization_id', orgId)
      .single();

    if (vErr || !venue) {
      return { success: false, error: 'Venue not found in current organization.' };
    }

    // If sport is selected, verify it is assigned to this venue
    if (sport_id) {
      const { data: vs, error: vsErr } = await supabase
        .from('venue_sports')
        .select('id')
        .eq('venue_id', venue_id)
        .eq('sport_id', sport_id)
        .eq('is_active', true)
        .maybeSingle();

      if (vsErr || !vs) {
        return {
          success: false,
          error: 'The selected sport is not active for this venue. Please configure it under Venue Sports first.',
        };
      }
    }

    const { error } = await supabase.from('facilities').insert(parsed.data);

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath('/owner');
    revalidatePath('/owner/venues');
    revalidatePath(`/owner/venues/${venue_id}`);
    revalidatePath(`/owner/venues/${venue_id}/facilities`);

    return { success: true, message: 'Facility created successfully.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 6. Update Facility
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function updateFacilityAction(
  facilityId: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const rawData = {
      venue_id: formData.get('venue_id'),
      sport_id: formData.get('sport_id') || null,
      name: formData.get('name'),
      slug: formData.get('slug'),
      description: formData.get('description') || null,
      facility_type: formData.get('facility_type') || null,
      capacity: formData.get('capacity') || null,
      status: formData.get('status') || 'AVAILABLE',
      is_bookable: formData.get('is_bookable') !== 'false',
      default_duration_minutes: formData.get('default_duration_minutes') || 60,
      buffer_minutes: formData.get('buffer_minutes') || 0,
    };

    const parsed = updateFacilityInputSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Please correct the highlighted form errors.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { venue_id, sport_id } = parsed.data;
    const supabase = await createSupabaseServerClient();

    // Verify venue belongs to active organization
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venue_id)
      .eq('organization_id', orgId)
      .single();

    if (vErr || !venue) {
      return { success: false, error: 'Venue not found in current organization.' };
    }

    // Verify sport belongs to venue if provided
    if (sport_id) {
      const { data: vs, error: vsErr } = await supabase
        .from('venue_sports')
        .select('id')
        .eq('venue_id', venue_id)
        .eq('sport_id', sport_id)
        .eq('is_active', true)
        .maybeSingle();

      if (vsErr || !vs) {
        return {
          success: false,
          error: 'The selected sport is not active for this venue. Please configure it under Venue Sports first.',
        };
      }
    }

    const { error } = await supabase
      .from('facilities')
      .update(parsed.data)
      .eq('id', facilityId)
      .eq('venue_id', venue_id);

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath(`/owner/venues/${venue_id}`);
    revalidatePath(`/owner/venues/${venue_id}/facilities`);

    return { success: true, message: 'Facility updated successfully.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 7. Update Weekly Operating Hours
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function updateOperatingHoursAction(
  venueId: string,
  schedule: DailyOperatingHourInputSchema[]
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const parsed = updateOperatingHoursInputSchema.safeParse({ venue_id: venueId, schedule });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid operating hours configuration.',
      };
    }

    const supabase = await createSupabaseServerClient();

    // Verify venue belongs to active organization
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venueId)
      .eq('organization_id', orgId)
      .single();

    if (vErr || !venue) {
      return { success: false, error: 'Venue not found in current organization.' };
    }

    // Upsert all 7 days
    const rowsToUpsert = schedule.map((item) => ({
      venue_id: venueId,
      day_of_week: item.day_of_week,
      open_time: item.is_closed ? null : item.open_time,
      close_time: item.is_closed ? null : item.close_time,
      is_closed: item.is_closed,
    }));

    const { error } = await supabase
      .from('venue_operating_hours')
      .upsert(rowsToUpsert, { onConflict: 'venue_id,day_of_week' });

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath(`/owner/venues/${venueId}`);
    revalidatePath(`/owner/venues/${venueId}/hours`);

    return { success: true, message: 'Operating hours schedule updated successfully.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 8. Create Pricing Rule
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function createPricingRuleAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const rawData = {
      venue_id: formData.get('venue_id'),
      facility_id: formData.get('facility_id') || null,
      name: formData.get('name'),
      pricing_type: formData.get('pricing_type'),
      day_of_week: formData.get('day_of_week') || null,
      start_time: formData.get('start_time') || null,
      end_time: formData.get('end_time') || null,
      price_per_hour: formData.get('price_per_hour'),
      member_price: formData.get('member_price') || null,
      priority: formData.get('priority') || 0,
      valid_from: formData.get('valid_from') || null,
      valid_until: formData.get('valid_until') || null,
      is_active: formData.get('is_active') !== 'false',
    };

    const parsed = createPricingRuleInputSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Please correct the pricing rule errors.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { venue_id, facility_id } = parsed.data;
    const supabase = await createSupabaseServerClient();

    // Verify venue belongs to active organization
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venue_id)
      .eq('organization_id', orgId)
      .single();

    if (vErr || !venue) {
      return { success: false, error: 'Venue not found in current organization.' };
    }

    // If facility is specified, verify it belongs to this venue
    if (facility_id) {
      const { data: facility, error: fErr } = await supabase
        .from('facilities')
        .select('id')
        .eq('id', facility_id)
        .eq('venue_id', venue_id)
        .single();

      if (fErr || !facility) {
        return { success: false, error: 'Facility not found in current venue.' };
      }
    }

    const { error } = await supabase.from('pricing_rules').insert({
      ...parsed.data,
      organization_id: orgId,
    });

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath(`/owner/venues/${venue_id}`);
    revalidatePath(`/owner/venues/${venue_id}/pricing`);

    return { success: true, message: 'Pricing rule created successfully.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 9. Delete Pricing Rule
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function deletePricingRuleAction(
  ruleId: string,
  venueId: string
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', ruleId)
      .eq('organization_id', orgId)
      .eq('venue_id', venueId);

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath(`/owner/venues/${venueId}`);
    revalidatePath(`/owner/venues/${venueId}/pricing`);

    return { success: true, message: 'Pricing rule removed.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 10. Create Maintenance Block
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function createMaintenanceBlockAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;
  const userId = context.user.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const rawData = {
      venue_id: formData.get('venue_id'),
      facility_id: formData.get('facility_id'),
      start_at: formData.get('start_at'),
      end_at: formData.get('end_at'),
      reason: formData.get('reason') || null,
      status: formData.get('status') || 'ACTIVE',
    };

    const parsed = createMaintenanceBlockInputSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Please correct the maintenance schedule errors.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { venue_id, facility_id } = parsed.data;
    const supabase = await createSupabaseServerClient();

    // Verify venue belongs to active organization
    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venue_id)
      .eq('organization_id', orgId)
      .single();

    if (vErr || !venue) {
      return { success: false, error: 'Venue not found in current organization.' };
    }

    // Verify facility belongs to venue
    const { data: facility, error: fErr } = await supabase
      .from('facilities')
      .select('id')
      .eq('id', facility_id)
      .eq('venue_id', venue_id)
      .single();

    if (fErr || !facility) {
      return { success: false, error: 'Facility not found in current venue.' };
    }

    const { error } = await supabase.from('maintenance_blocks').insert({
      ...parsed.data,
      organization_id: orgId,
      created_by: userId,
    });

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath('/owner');
    revalidatePath(`/owner/venues/${venue_id}`);
    revalidatePath(`/owner/venues/${venue_id}/maintenance`);

    return { success: true, message: 'Maintenance block scheduled successfully.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

/**
 * 11. Cancel Maintenance Block
 * Allowed roles: OWNER, MANAGER, SUPER_ADMIN
 */
export async function cancelMaintenanceBlockAction(
  blockId: string,
  venueId: string
): Promise<ActionState> {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    return { success: false, error: 'No active organization selected.' };
  }

  const orgId = context.activeOrganization.id;

  try {
    await requireOrganizationRole(orgId, ['OWNER', 'MANAGER', 'SUPER_ADMIN']);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('maintenance_blocks')
      .update({ status: 'CANCELLED' })
      .eq('id', blockId)
      .eq('organization_id', orgId)
      .eq('venue_id', venueId);

    if (error) {
      return { success: false, error: formatAuthError(error) };
    }

    revalidatePath('/owner');
    revalidatePath(`/owner/venues/${venueId}`);
    revalidatePath(`/owner/venues/${venueId}/maintenance`);

    return { success: true, message: 'Maintenance block cancelled.' };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}
