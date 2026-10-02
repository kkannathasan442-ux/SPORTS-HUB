import { SupabaseClient } from '@supabase/supabase-js';
import { refundPaymentSchema, type RefundPaymentSchema } from '@sportshub/validation';
import type { PaymentTransaction, RefundPaymentResult, RefundRecord } from '@sportshub/types';
import { PAYMENT_ERRORS } from './types';
import { defaultPaymentProvider } from './sandbox-provider';
import type { PaymentProvider } from './provider-interface';
import { defaultNotificationDispatcher } from '../notifications/dispatcher';

/**
 * Processes a safe, validated payment refund.
 * 
 * SECURITY & FINANCIAL INVARIANTS:
 * - Only authorized organization staff (Owners, Managers, Admins) can trigger refunds.
 * - Total refunded amount cannot exceed original successful payment (refund_amount <= amount - refunded_amount).
 * - Only SUCCESS or PARTIALLY_REFUNDED transactions can be refunded.
 * - Every refund creates a permanent immutable record in public.refund_records.
 */
export async function processPaymentRefund(
  supabase: SupabaseClient,
  input: RefundPaymentSchema,
  provider: PaymentProvider = defaultPaymentProvider
): Promise<RefundPaymentResult> {
  const validated = refundPaymentSchema.parse(input);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.UNAUTHORIZED,
        message: 'You must be signed in to issue a refund',
      },
    };
  }

  // 1. Fetch transaction
  const { data: txData, error: txError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', validated.paymentTransactionId)
    .single();

  if (txError || !txData) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.TRANSACTION_NOT_FOUND,
        message: 'Payment transaction record not found',
      },
    };
  }

  const transaction = txData as PaymentTransaction;

  // 2. Authorize staff membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', transaction.organization_id)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const isStaff = membership && ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(membership.role);

  if (!isStaff) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.FORBIDDEN,
        message: 'You do not have permission to refund payments for this organization',
      },
    };
  }

  // 3. Status invariant: only SUCCESS or PARTIALLY_REFUNDED can be refunded
  if (transaction.status !== 'SUCCESS' && transaction.status !== 'PARTIALLY_REFUNDED') {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.INVALID_STATUS_TRANSITION,
        message: `Cannot refund a transaction with status: ${transaction.status}`,
      },
    };
  }

  // 4. Invariant: Calculate available refundable balance
  const currentRefunded = Number(transaction.refunded_amount || 0);
  const totalAmount = Number(transaction.amount);
  const availableRefundableAmount = Math.max(0, totalAmount - currentRefunded);

  if (availableRefundableAmount <= 0) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.ALREADY_REFUNDED,
        message: 'This transaction has already been fully refunded',
      },
    };
  }

  // 5. Authoritative refund amount check
  const requestedRefundAmount = validated.amount !== undefined ? Number(validated.amount) : availableRefundableAmount;

  if (isNaN(requestedRefundAmount) || requestedRefundAmount <= 0) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.INVALID_PAYMENT_AMOUNT,
        message: 'Refund amount must be a positive number',
      },
    };
  }

  if (requestedRefundAmount > availableRefundableAmount) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.REFUND_EXCEEDS_AMOUNT,
        message: `Refund amount (${requestedRefundAmount} ${transaction.currency}) exceeds available balance (${availableRefundableAmount} ${transaction.currency})`,
      },
    };
  }

  // 6. Invoke Provider Refund
  let providerResult;
  try {
    providerResult = await provider.refundPayment({
      transactionId: transaction.id,
      providerTransactionId: transaction.provider_transaction_id || transaction.id,
      refundAmount: requestedRefundAmount,
      currency: transaction.currency,
      reason: validated.reason || undefined,
    });
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.PROVIDER_ERROR,
        message: err?.message || 'Payment provider refund request failed',
      },
    };
  }

  if (!providerResult.success) {
    return {
      success: false,
      error: {
        code: providerResult.failureCode || PAYMENT_ERRORS.PROVIDER_ERROR,
        message: providerResult.failureMessage || 'Payment provider declined the refund',
      },
    };
  }

  const nowIso = new Date().toISOString();
  const newRefundedTotal = currentRefunded + requestedRefundAmount;
  const newStatus = newRefundedTotal >= totalAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  const refundId = crypto.randomUUID();

  // 7. Record refund in public.refund_records
  const { data: createdRefund, error: refundRecordError } = await supabase
    .from('refund_records')
    .insert({
      id: refundId,
      payment_transaction_id: transaction.id,
      booking_id: transaction.booking_id,
      organization_id: transaction.organization_id,
      amount: requestedRefundAmount,
      currency: transaction.currency,
      reason: validated.reason || null,
      status: 'SUCCESS',
      provider_refund_id: providerResult.providerRefundId,
      created_by: user.id,
      metadata: {
        provider_raw: providerResult.rawResponse,
        idempotency_key: validated.idempotencyKey || null,
      },
      created_at: nowIso,
      completed_at: nowIso,
    })
    .select()
    .single();

  if (refundRecordError) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.PAYMENT_FAILED,
        message: `Failed to record refund log: ${refundRecordError.message}`,
      },
    };
  }

  // 8. Update payment transaction record
  const { data: updatedTx, error: txUpdateError } = await supabase
    .from('payment_transactions')
    .update({
      refunded_amount: newRefundedTotal,
      status: newStatus,
      updated_at: nowIso,
    })
    .eq('id', transaction.id)
    .select()
    .single();

  if (txUpdateError) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.PAYMENT_FAILED,
        message: `Failed to update transaction status: ${txUpdateError.message}`,
      },
    };
  }

  // Safe isolated notification trigger
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_reference')
      .eq('id', transaction.booking_id)
      .single();
    const bookingRef = booking?.booking_reference || transaction.id.slice(0, 8);

    defaultNotificationDispatcher
      .dispatchRefundProcessed(
        supabase,
        createdRefund as RefundRecord,
        bookingRef,
        user.email
      )
      .catch((e: any) => console.warn('Failed to dispatch refund notification:', e));
  } catch (e: any) {
    console.warn('Notification trigger error:', e);
  }

  return {
    success: true,
    refund: createdRefund as RefundRecord,
    transaction: updatedTx as PaymentTransaction,
  };
}


