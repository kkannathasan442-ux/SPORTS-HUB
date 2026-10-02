/**
 * SportsHub Customer Account & Experience Service — STEP 11
 *
 * Provides customer-scoped profile management, stats aggregation,
 * booking history filtering, and tamper-proof printable receipt generation.
 */

import { createSupabaseServerClient } from '../supabase/server';
import { createAuditLog } from '../audit/audit-service';
import type {
  CustomerAccountProfile,
  CustomerAccountStats,
  CustomerBookingHistoryItem,
  CustomerReceipt,
} from '@sportshub/types';
import type { UpdateCustomerProfileSchema } from '@sportshub/validation';

/**
 * Fetch customer account profile with joined player metadata
 */
export async function getCustomerAccountProfile(
  userId: string
): Promise<CustomerAccountProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileErr || !profile) {
    return null;
  }

  const { data: customerProfile } = await supabase
    .from('customer_profiles')
    .select('emergency_contact_name, emergency_contact_phone, notes')
    .eq('user_id', userId)
    .maybeSingle();

  // Get user auth email
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    id: profile.id,
    email: user?.email || '',
    full_name: profile.full_name,
    display_name: profile.display_name || null,
    phone: profile.phone || null,
    avatar_url: profile.avatar_url || null,
    date_of_birth: profile.date_of_birth || null,
    gender: profile.gender || null,
    country_code: profile.country_code || '+94',
    preferred_language: profile.preferred_language || 'en',
    timezone: profile.timezone || 'Asia/Colombo',
    is_active: profile.is_active,
    emergency_contact_name: customerProfile?.emergency_contact_name || null,
    emergency_contact_phone: customerProfile?.emergency_contact_phone || null,
    notes: customerProfile?.notes || null,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

/**
 * Update customer profile details and write immutable audit log
 */
export async function updateCustomerAccountProfile(
  userId: string,
  input: UpdateCustomerProfileSchema
): Promise<{ success: boolean; profile?: CustomerAccountProfile; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const current = await getCustomerAccountProfile(userId);
  if (!current) {
    return { success: false, error: 'User profile not found.' };
  }

  // Update public.profiles
  const profileUpdates: Record<string, unknown> = {};
  if (input.full_name !== undefined) profileUpdates.full_name = input.full_name;
  if (input.display_name !== undefined) profileUpdates.display_name = input.display_name || null;
  if (input.phone !== undefined) profileUpdates.phone = input.phone || null;
  if (input.avatar_url !== undefined) profileUpdates.avatar_url = input.avatar_url || null;
  if (input.date_of_birth !== undefined) profileUpdates.date_of_birth = input.date_of_birth || null;
  if (input.gender !== undefined) profileUpdates.gender = input.gender || null;
  if (input.country_code !== undefined) profileUpdates.country_code = input.country_code;
  if (input.preferred_language !== undefined) profileUpdates.preferred_language = input.preferred_language;
  if (input.timezone !== undefined) profileUpdates.timezone = input.timezone;

  if (Object.keys(profileUpdates).length > 0) {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
  }

  // Upsert customer_profiles
  const customerUpdates: Record<string, unknown> = {
    user_id: userId,
  };
  if (input.emergency_contact_name !== undefined) {
    customerUpdates.emergency_contact_name = input.emergency_contact_name || null;
  }
  if (input.emergency_contact_phone !== undefined) {
    customerUpdates.emergency_contact_phone = input.emergency_contact_phone || null;
  }
  if (input.notes !== undefined) {
    customerUpdates.notes = input.notes || null;
  }

  if (Object.keys(customerUpdates).length > 1) {
    await supabase.from('customer_profiles').upsert(customerUpdates, { onConflict: 'user_id' });
  }

  const updated = await getCustomerAccountProfile(userId);

  // Write audit log
  await createAuditLog({
    actorUserId: userId,
    action: 'CUSTOMER_PROFILE_UPDATED',
    entityType: 'profiles',
    entityId: userId,
    beforeData: {
      full_name: current.full_name,
      display_name: current.display_name,
      phone: current.phone,
      timezone: current.timezone,
      preferred_language: current.preferred_language,
    },
    afterData: {
      full_name: updated?.full_name,
      display_name: updated?.display_name,
      phone: updated?.phone,
      timezone: updated?.timezone,
      preferred_language: updated?.preferred_language,
    },
    metadata: {
      source: 'customer_portal',
    },
  });

  return { success: true, profile: updated || undefined };
}

/**
 * Compute real-time server-side statistics for a customer
 */
export async function getCustomerAccountStats(
  userId: string
): Promise<CustomerAccountStats> {
  const supabase = await createSupabaseServerClient();

  // Fetch all bookings for user
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, booking_date, total_price, currency')
    .eq('customer_user_id', userId);

  const todayStr = new Date().toISOString().split('T')[0];

  let totalBookings = 0;
  let completedBookings = 0;
  let upcomingBookings = 0;
  let cancelledBookings = 0;
  let activeHolds = 0;

  for (const b of bookings || []) {
    totalBookings++;
    if (b.status === 'HOLD') {
      activeHolds++;
      if (b.booking_date >= todayStr) upcomingBookings++;
    } else if (b.status === 'CONFIRMED') {
      if (b.booking_date >= todayStr) {
        upcomingBookings++;
      } else {
        completedBookings++;
      }
    } else if (b.status === 'COMPLETED') {
      completedBookings++;
    } else if (b.status === 'CANCELLED' || b.status === 'EXPIRED' || b.status === 'NO_SHOW') {
      cancelledBookings++;
    }
  }

  // Fetch successful payments total
  const { data: payments } = await supabase
    .from('payment_transactions')
    .select('amount, status')
    .eq('customer_user_id', userId)
    .in('status', ['SUCCESS', 'PARTIALLY_REFUNDED']);

  let totalAmountPaid = 0;
  for (const p of payments || []) {
    totalAmountPaid += Number(p.amount) || 0;
  }

  return {
    totalBookings,
    completedBookings,
    upcomingBookings,
    cancelledBookings,
    activeHolds,
    totalAmountPaid,
    currency: 'LKR',
  };
}

/**
 * Fetch filtered customer booking history
 */
export async function getCustomerBookingHistory(
  userId: string,
  tab = 'all',
  page = 1,
  limit = 20
): Promise<{ bookings: CustomerBookingHistoryItem[]; total: number; totalPages: number }> {
  const supabase = await createSupabaseServerClient();
  const offset = (page - 1) * limit;

  let query = supabase
    .from('bookings')
    .select(
      `
      id,
      reference,
      organization_id,
      venue_id,
      facility_id,
      customer_user_id,
      booking_date,
      start_time,
      end_time,
      duration_minutes,
      status,
      total_price,
      currency,
      notes,
      hold_expires_at,
      created_at,
      venue:venues(id, name, slug, address, city, timezone, phone),
      facility:facilities(id, name, facility_type),
      payments:payment_transactions(id, transaction_reference, payment_method, payment_provider, status, amount, currency, paid_at)
    `,
      { count: 'exact' }
    )
    .eq('customer_user_id', userId)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false });

  const todayStr = new Date().toISOString().split('T')[0];

  if (tab === 'upcoming') {
    query = query
      .gte('booking_date', todayStr)
      .in('status', ['CONFIRMED', 'HOLD']);
  } else if (tab === 'today') {
    query = query.eq('booking_date', todayStr);
  } else if (tab === 'completed') {
    query = query.or(`status.eq.COMPLETED,and(status.eq.CONFIRMED,booking_date.lt.${todayStr})`);
  } else if (tab === 'cancelled') {
    query = query.in('status', ['CANCELLED', 'EXPIRED', 'NO_SHOW']);
  } else if (tab === 'holds') {
    query = query.eq('status', 'HOLD');
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching customer booking history:', error);
    return { bookings: [], total: 0, totalPages: 0 };
  }

  const items: CustomerBookingHistoryItem[] = (data || []).map((b: any) => {
    const latestPayment = Array.isArray(b.payments) && b.payments.length > 0 ? b.payments[0] : null;

    return {
      id: b.id,
      reference: b.reference,
      organization_id: b.organization_id,
      venue_id: b.venue_id,
      facility_id: b.facility_id,
      customer_user_id: b.customer_user_id,
      booking_date: b.booking_date,
      start_time: b.start_time,
      end_time: b.end_time,
      duration_minutes: b.duration_minutes,
      status: b.status,
      total_price: b.total_price,
      currency: b.currency,
      notes: b.notes,
      hold_expires_at: b.hold_expires_at,
      created_at: b.created_at,
      venue: b.venue || null,
      facility: b.facility || null,
      payment: latestPayment || null,
    };
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return { bookings: items, total, totalPages };
}

/**
 * Generate printable receipt details for a customer booking
 */
export async function getCustomerBookingReceipt(
  userId: string,
  bookingId: string
): Promise<CustomerReceipt | null> {
  const supabase = await createSupabaseServerClient();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      reference,
      booking_date,
      start_time,
      end_time,
      duration_minutes,
      status,
      total_price,
      currency,
      customer_user_id,
      created_at,
      organization:organizations(name, email, phone),
      venue:venues(name, address, city),
      facility:facilities(name, facility_type),
      customer:profiles!customer_user_id(full_name, phone)
    `
    )
    .eq('id', bookingId)
    .eq('customer_user_id', userId)
    .single();

  if (error || !booking) {
    return null;
  }

  // Fetch payment transaction
  const { data: payment } = await supabase
    .from('payment_transactions')
    .select('transaction_reference, status, payment_method, paid_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const org = (booking as any).organization || {};
  const ven = (booking as any).venue || {};
  const fac = (booking as any).facility || {};
  const cus = (booking as any).customer || {};

  return {
    bookingId: booking.id,
    reference: booking.reference,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    durationMinutes: booking.duration_minutes,
    bookingStatus: booking.status,
    totalPrice: booking.total_price,
    currency: booking.currency,
    customerName: cus.full_name || 'Valued Athlete',
    customerEmail: user?.email || '',
    customerPhone: cus.phone || null,
    organizationName: org.name || 'SportsHub Facility',
    organizationEmail: org.email || null,
    organizationPhone: org.phone || null,
    venueName: ven.name || 'Sports Arena',
    venueAddress: `${ven.address || ''}${ven.city ? `, ${ven.city}` : ''}`,
    facilityName: fac.name || 'Court',
    facilityType: fac.facility_type || 'Court',
    paymentReference: payment?.transaction_reference || null,
    paymentStatus: payment?.status || (booking.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING'),
    paymentMethod: payment?.payment_method || null,
    paidAt: payment?.paid_at || null,
    issuedAt: new Date().toISOString(),
  };
}
