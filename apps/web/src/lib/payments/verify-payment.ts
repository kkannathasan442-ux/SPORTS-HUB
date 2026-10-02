import { SupabaseClient } from '@supabase/supabase-js';
import { verifyPaymentSchema, type VerifyPaymentSchema } from '@sportshub/validation';
import type { PaymentTransaction, VerifyPaymentResult } from '@sportshub/types';
import { PAYMENT_ERRORS } from './types';
import { defaultPaymentProvider } from './sandbox-provider';
import type { PaymentProvider } from './provider-interface';
import { defaultNotificationDispatcher } from '../notifications/dispatcher';

/**
 * Verifies and finalizes a payment transaction through the payment provider.
 * 
 * SECURITY INVARIANTS:
 * - Direct client claims of payment success are NEVER trusted.
 * - Server authenticates with provider abstraction to verify true payment status.
 * - Successfully verified payments idempotently update transaction & sync booking state.
 * - Failed verifications record failure codes and prevent invalid state advancement.
 */
export async function verifyPaymentTransaction(
  supabase: SupabaseClient,
  input: VerifyPaymentSchema,
  provider: PaymentProvider = defaultPaymentProvider
): Promise<VerifyPaymentResult> {
  const validated = verifyPaymentSchema.parse(input);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      status: 'FAILED',
      error: {
        code: PAYMENT_ERRORS.UNAUTHORIZED,
        message: 'You must be signed in to verify a payment',
      },
    };
  }

  // 1. Fetch current transaction record
  const { data: txData, error: txError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', validated.paymentTransactionId)
    .single();

  if (txError || !txData) {
    return {
      success: false,
      status: 'FAILED',
      error: {
        code: PAYMENT_ERRORS.TRANSACTION_NOT_FOUND,
        message: 'Payment transaction record not found',
      },
    };
  }

  const transaction = txData as PaymentTransaction;

  // 2. Authorization check: Customer must own transaction OR staff has org access
  if (transaction.customer_user_id !== user.id) {
    // Check if staff/admin has permission for this org
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', transaction.organization_id)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!member) {
      return {
        success: false,
        status: 'FAILED',
        error: {
          code: PAYMENT_ERRORS.FORBIDDEN,
          message: 'You are not authorized to verify this transaction',
        },
      };
    }
  }

  // 3. Handle Idempotency: If already SUCCESS, return immediately
  if (transaction.status === 'SUCCESS') {
    return {
      success: true,
      status: 'SUCCESS',
      transaction,
    };
  }

  // 4. Invariant: Cannot verify cancelled or refunded payments
  if (transaction.status === 'CANCELLED' || transaction.status === 'REFUNDED') {
    return {
      success: false,
      status: transaction.status,
      error: {
        code: PAYMENT_ERRORS.INVALID_STATUS_TRANSITION,
        message: `Transaction is ${transaction.status.toLowerCase()} and cannot be verified.`,
      },
    };
  }

  // 5. Call Provider Abstraction to Verify
  let providerResult;
  try {
    providerResult = await provider.verifyPayment({
      transactionId: transaction.id,
      providerTransactionId: validated.providerTransactionId || transaction.provider_transaction_id || undefined,
      verificationToken: validated.verificationToken,
    });
  } catch (err: any) {
    return {
      success: false,
      status: 'FAILED',
      error: {
        code: PAYMENT_ERRORS.PROVIDER_ERROR,
        message: err?.message || 'Payment provider verification failed',
      },
    };
  }

  const nowIso = new Date().toISOString();

  // 6. Handle Verification Success
  if (providerResult.success) {
    const { data: updatedTx, error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'SUCCESS',
        provider_reference: providerResult.providerReference,
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', transaction.id)
      .select()
      .single();

    if (updateError || !updatedTx) {
      return {
        success: false,
        status: 'FAILED',
        error: {
          code: PAYMENT_ERRORS.PAYMENT_FAILED,
          message: `Failed to update transaction status: ${updateError?.message}`,
        },
      };
    }

    // Synchronize booking state: If booking was on HOLD, transition to CONFIRMED
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, booking_reference')
      .eq('id', transaction.booking_id)
      .single();

    if (booking && booking.status === 'HOLD') {
      await supabase
        .from('bookings')
        .update({
          status: 'CONFIRMED',
          confirmed_at: nowIso,
        })
        .eq('id', booking.id);
    }

    // Safe isolated notification trigger
    try {
      const bookingRef = booking?.booking_reference || transaction.id.slice(0, 8);
      defaultNotificationDispatcher
        .dispatchPaymentSuccess(supabase, updatedTx as PaymentTransaction, bookingRef, user.email)
        .catch((e: any) => console.warn('Failed to dispatch payment success notification:', e));
    } catch (e: any) {
      console.warn('Notification trigger error:', e);
    }

    return {
      success: true,
      status: 'SUCCESS',
      transaction: updatedTx as PaymentTransaction,
    };
  }

  // 7. Handle Verification Failure
  const { data: failedTx } = await supabase
    .from('payment_transactions')
    .update({
      status: 'FAILED',
      failure_code: providerResult.failureCode || 'VERIFICATION_FAILED',
      failure_message: providerResult.failureMessage || 'Provider verification was unsuccessful',
      updated_at: nowIso,
    })
    .eq('id', transaction.id)
    .select()
    .single();

  // Safe isolated failure notification trigger
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_reference')
      .eq('id', transaction.booking_id)
      .single();
    const bookingRef = booking?.booking_reference || transaction.id.slice(0, 8);

    defaultNotificationDispatcher
      .dispatchPaymentFailed(
        supabase,
        (failedTx as PaymentTransaction) || transaction,
        bookingRef,
        user.email
      )
      .catch((e: any) => console.warn('Failed to dispatch payment failed notification:', e));
  } catch (e: any) {
    console.warn('Notification trigger error:', e);
  }

  return {
    success: false,
    status: 'FAILED',
    transaction: (failedTx as PaymentTransaction) || transaction,
    error: {
      code: providerResult.failureCode || PAYMENT_ERRORS.VERIFICATION_FAILED,
      message: providerResult.failureMessage || 'Payment verification failed',
    },
  };
}


