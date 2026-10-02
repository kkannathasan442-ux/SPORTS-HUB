import { SupabaseClient } from '@supabase/supabase-js';
import type {
  PaymentFilterParams,
  PaymentWithDetails,
  PaymentTransaction,
  OwnerFinancialSummary,
} from '@sportshub/types';

/**
 * Fetches the payment history for the authenticated customer.
 */
export async function getCustomerPaymentHistory(
  supabase: SupabaseClient,
  params?: PaymentFilterParams
): Promise<{
  payments: PaymentWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { payments: [], totalCount: 0, page: 1, pageSize: 20 };
  }

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('payment_transactions')
    .select(
      `
      *,
      booking:bookings (
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        status,
        venue:venues (id, name, slug, address_line_1, city),
        facility:facilities (id, name, slug, facility_type),
        sport:sports (id, name)
      ),
      refunds:refund_records (*)
    `,
      { count: 'exact' }
    )
    .eq('customer_user_id', user.id)
    .order('created_at', { ascending: false });

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.paymentMethod) {
    query = query.eq('payment_method', params.paymentMethod);
  }
  if (params?.startDate) {
    query = query.gte('created_at', `${params.startDate}T00:00:00.000Z`);
  }
  if (params?.endDate) {
    query = query.lte('created_at', `${params.endDate}T23:59:59.999Z`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('Failed to query customer payment history:', error);
    return { payments: [], totalCount: 0, page, pageSize };
  }

  return {
    payments: (data as PaymentWithDetails[]) || [],
    totalCount: count || 0,
    page,
    pageSize,
  };
}

/**
 * Fetches a single payment transaction by ID with full details.
 */
export async function getPaymentById(
  supabase: SupabaseClient,
  paymentId: string
): Promise<PaymentWithDetails | null> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select(
      `
      *,
      booking:bookings (
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        status,
        total_amount,
        currency,
        venue:venues (id, name, slug, address_line_1, city, phone),
        facility:facilities (id, name, slug, facility_type),
        sport:sports (id, name)
      ),
      refunds:refund_records (*)
    `
    )
    .eq('id', paymentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as PaymentWithDetails;
}

/**
 * Fetches the organization payment ledger for owners and managers.
 */
export async function getOwnerPaymentLedger(
  supabase: SupabaseClient,
  organizationId: string,
  params?: PaymentFilterParams
): Promise<{
  payments: PaymentWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('payment_transactions')
    .select(
      `
      *,
      booking:bookings (
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        status,
        venue_id,
        venue:venues (id, name, slug),
        facility:facilities (id, name, slug)
      ),
      refunds:refund_records (*)
    `,
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.paymentMethod) {
    query = query.eq('payment_method', params.paymentMethod);
  }
  if (params?.startDate) {
    query = query.gte('created_at', `${params.startDate}T00:00:00.000Z`);
  }
  if (params?.endDate) {
    query = query.lte('created_at', `${params.endDate}T23:59:59.999Z`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('Failed to query owner payment ledger:', error);
    return { payments: [], totalCount: 0, page, pageSize };
  }

  // Filter by venue if requested and relations loaded
  let items = (data as PaymentWithDetails[]) || [];
  if (params?.venueId) {
    items = items.filter((p) => p.booking?.venue_id === params.venueId);
  }

  return {
    payments: items,
    totalCount: count || 0,
    page,
    pageSize,
  };
}

/**
 * Computes authoritative owner financial metrics directly from database records.
 */
export async function getOwnerFinancialSummary(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OwnerFinancialSummary> {
  const { data: transactions, error } = await supabase
    .from('payment_transactions')
    .select('amount, status, refunded_amount, currency')
    .eq('organization_id', organizationId);

  if (error || !transactions) {
    return {
      totalRevenue: 0,
      totalSuccessfulPayments: 0,
      totalPendingPayments: 0,
      totalFailedPayments: 0,
      totalRefundedAmount: 0,
      totalTransactionsCount: 0,
      currency: 'LKR',
    };
  }

  let totalSuccessfulPayments = 0;
  let totalPendingPayments = 0;
  let totalFailedPayments = 0;
  let totalRefundedAmount = 0;
  let grossSuccessfulAmount = 0;
  const currency = transactions[0]?.currency || 'LKR';

  for (const tx of transactions) {
    const amount = Number(tx.amount || 0);
    const refunded = Number(tx.refunded_amount || 0);
    totalRefundedAmount += refunded;

    if (tx.status === 'SUCCESS' || tx.status === 'PARTIALLY_REFUNDED') {
      totalSuccessfulPayments += 1;
      grossSuccessfulAmount += amount;
    } else if (tx.status === 'PENDING') {
      totalPendingPayments += 1;
    } else if (tx.status === 'FAILED') {
      totalFailedPayments += 1;
    } else if (tx.status === 'REFUNDED') {
      // Fully refunded
      grossSuccessfulAmount += amount;
    }
  }

  const netRevenue = Math.max(0, grossSuccessfulAmount - totalRefundedAmount);

  return {
    totalRevenue: netRevenue,
    totalSuccessfulPayments,
    totalPendingPayments,
    totalFailedPayments,
    totalRefundedAmount,
    totalTransactionsCount: transactions.length,
    currency,
  };
}
