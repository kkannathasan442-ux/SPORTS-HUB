import { SupabaseClient } from '@supabase/supabase-js';
import type { ReportFilterParams } from '@sportshub/types';

export interface RawBookingReportItem {
  id: string;
  booking_reference: string;
  customer_user_id: string;
  organization_id: string;
  venue_id: string;
  facility_id: string;
  sport_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  subtotal: number;
  total_amount: number;
  currency: string;
  created_at: string;
  venue?: { name: string; city?: string };
  facility?: { name: string; sport?: { name: string } };
  customer?: { full_name: string; phone?: string };
}

export interface RawPaymentReportItem {
  id: string;
  organization_id: string;
  booking_id: string;
  customer_user_id: string;
  amount: number;
  refunded_amount: number;
  currency: string;
  payment_method: string;
  status: string;
  created_at: string;
  provider_reference?: string;
  booking?: {
    booking_reference: string;
    venue?: { name: string };
    facility?: { name: string };
  };
}

export interface RawRefundReportItem {
  id: string;
  organization_id: string;
  payment_transaction_id: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  created_at: string;
}

export interface RawVenueFacilityItem {
  id: string;
  name: string;
  city?: string;
  facilities: Array<{
    id: string;
    name: string;
    venue_id: string;
    is_bookable: boolean;
    default_duration_minutes: number;
    sport?: { name: string };
  }>;
  operating_hours?: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>;
}

/**
 * Fetches organization bookings filtered by date range, venue, facility, status.
 */
export async function fetchOrganizationBookings(
  supabase: SupabaseClient,
  organizationId: string,
  startDate: string,
  endDate: string,
  filters?: Partial<ReportFilterParams>
): Promise<RawBookingReportItem[]> {
  let query = supabase
    .from('bookings')
    .select(`
      id,
      booking_reference,
      customer_user_id,
      organization_id,
      venue_id,
      facility_id,
      sport_id,
      booking_date,
      start_time,
      end_time,
      duration_minutes,
      status,
      subtotal,
      total_amount,
      currency,
      created_at,
      venue:venues(name, city),
      facility:facilities(name, sport:sports(name)),
      customer:customer_profiles(full_name, phone)
    `)
    .eq('organization_id', organizationId)
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .order('booking_date', { ascending: true });

  if (filters?.venueId) {
    query = query.eq('venue_id', filters.venueId);
  }
  if (filters?.facilityId) {
    query = query.eq('facility_id', filters.facilityId);
  }
  if (filters?.bookingStatus) {
    query = query.eq('status', filters.bookingStatus);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data as unknown as RawBookingReportItem[];
}

/**
 * Fetches organization payment transactions within the given date range.
 */
export async function fetchOrganizationPayments(
  supabase: SupabaseClient,
  organizationId: string,
  startDate: string,
  endDate: string,
  filters?: Partial<ReportFilterParams>
): Promise<RawPaymentReportItem[]> {
  // Use ISO boundaries for created_at
  const startIso = `${startDate}T00:00:00.000Z`;
  const endIso = `${endDate}T23:59:59.999Z`;

  let query = supabase
    .from('payment_transactions')
    .select(`
      id,
      organization_id,
      booking_id,
      customer_user_id,
      amount,
      refunded_amount,
      currency,
      payment_method,
      status,
      created_at,
      provider_reference,
      booking:bookings(
        booking_reference,
        venue:venues(name),
        facility:facilities(name)
      )
    `)
    .eq('organization_id', organizationId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: true });

  if (filters?.paymentStatus) {
    query = query.eq('status', filters.paymentStatus);
  }
  if (filters?.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data as unknown as RawPaymentReportItem[];
}

/**
 * Fetches organization refunds within the date range.
 */
export async function fetchOrganizationRefunds(
  supabase: SupabaseClient,
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<RawRefundReportItem[]> {
  const startIso = `${startDate}T00:00:00.000Z`;
  const endIso = `${endDate}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from('refund_records')
    .select(`
      id,
      organization_id,
      payment_transaction_id,
      amount,
      currency,
      status,
      reason,
      created_at
    `)
    .eq('organization_id', organizationId)
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error || !data) {
    return [];
  }

  return data as unknown as RawRefundReportItem[];
}

/**
 * Fetches venue and facility structure for organization.
 */
export async function fetchOrganizationVenuesAndFacilities(
  supabase: SupabaseClient,
  organizationId: string
): Promise<RawVenueFacilityItem[]> {
  const { data, error } = await supabase
    .from('venues')
    .select(`
      id,
      name,
      city,
      facilities(
        id,
        name,
        venue_id,
        is_bookable,
        default_duration_minutes,
        sport:sports(name)
      ),
      operating_hours:venue_operating_hours(
        day_of_week,
        open_time,
        close_time,
        is_closed
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE');

  if (error || !data) {
    return [];
  }

  return data as unknown as RawVenueFacilityItem[];
}
