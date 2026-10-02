import { SupabaseClient } from '@supabase/supabase-js';
import { createPaymentSchema, type CreatePaymentSchema } from '@sportshub/validation';
import type { Booking, CreatePaymentResult, PaymentTransaction } from '@sportshub/types';
import { PAYMENT_ERRORS } from './types';
import { defaultPaymentProvider } from './sandbox-provider';
import type { PaymentProvider } from './provider-interface';

/**
 * Initiates a secure payment transaction for a customer's booking.
 * 
 * SECURITY INVARIANTS:
 * - Payment amount is STRICTLY derived server-side from booking.total_amount.
 * - Client-supplied amount is NEVER accepted or trusted.
 * - Customer ownership of booking is verified.
 * - Organization isolation is strictly enforced.
 * - Idempotency key prevents duplicate transaction creation.
 */
export async function createPaymentTransaction(
  supabase: SupabaseClient,
  input: CreatePaymentSchema,
  provider: PaymentProvider = defaultPaymentProvider
): Promise<CreatePaymentResult> {
  const validated = createPaymentSchema.parse(input);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.UNAUTHORIZED,
        message: 'You must be signed in to make a payment',
      },
    };
  }

  // 1. Fetch authoritative booking record
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', validated.bookingId)
    .single();

  if (bookingError || !bookingData) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.BOOKING_NOT_FOUND,
        message: 'Booking not found',
      },
    };
  }

  const booking = bookingData as Booking;

  // 2. Verify booking ownership
  if (booking.customer_user_id !== user.id) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.UNAUTHORIZED,
        message: 'You are not authorized to pay for this booking',
      },
    };
  }

  // 3. Verify booking is in a payable state
  const nowIso = new Date().toISOString();

  if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED' || booking.status === 'NO_SHOW') {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.BOOKING_NOT_PAYABLE,
        message: `This booking is ${booking.status.toLowerCase()} and cannot be paid.`,
      },
    };
  }

  if (booking.status === 'HOLD' && booking.hold_expires_at && booking.hold_expires_at <= nowIso) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.BOOKING_NOT_PAYABLE,
        message: 'The booking hold has expired. Please select a new slot.',
      },
    };
  }

  // 4. Check if an active successful transaction already exists for this booking
  const { data: existingSuccess } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('status', 'SUCCESS')
    .maybeSingle();

  if (existingSuccess) {
    return {
      success: true,
      transaction: existingSuccess as PaymentTransaction,
    };
  }

  // 5. Check Idempotency Key
  const idempotencyKey = validated.idempotencyKey || `pay_idem_${user.id}_${booking.id}_${Date.now()}`;

  const { data: existingByKey } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingByKey) {
    return {
      success: true,
      transaction: existingByKey as PaymentTransaction,
      checkoutUrl: `/customer/payments/checkout?session=${existingByKey.id}`,
    };
  }

  // 6. AUTHORITATIVE PRICE DERIVATION
  // Total amount and currency MUST come from server-side booking snapshot
  const authoritativeAmount = Number(booking.total_amount);
  const authoritativeCurrency = booking.currency || 'LKR';

  if (isNaN(authoritativeAmount) || authoritativeAmount <= 0) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.INVALID_PAYMENT_AMOUNT,
        message: 'Authoritative booking price is invalid.',
      },
    };
  }

  // Generate unique transaction ID
  const newTransactionId = crypto.randomUUID();

  // 7. Initialize payment session with provider abstraction
  let sessionResult;
  try {
    sessionResult = await provider.createPaymentSession({
      transactionId: newTransactionId,
      amount: authoritativeAmount,
      currency: authoritativeCurrency,
      bookingReference: booking.booking_reference,
      customerEmail: user.email,
      customerName: user.user_metadata?.full_name || 'Customer',
      returnUrl: validated.returnUrl,
      metadata: validated.metadata,
    });
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.PROVIDER_ERROR,
        message: err?.message || 'Payment provider session initialization failed',
      },
    };
  }

  // 8. Insert payment transaction into database
  const insertPayload = {
    id: newTransactionId,
    booking_id: booking.id,
    organization_id: booking.organization_id,
    customer_user_id: user.id,
    provider: provider.name,
    provider_transaction_id: sessionResult.providerTransactionId,
    idempotency_key: idempotencyKey,
    amount: authoritativeAmount,
    currency: authoritativeCurrency,
    status: 'PENDING',
    payment_method: validated.paymentMethod || 'CARD',
    provider_reference: null,
    failure_code: null,
    failure_message: null,
    metadata: {
      ...(validated.metadata || {}),
      booking_reference: booking.booking_reference,
      provider_raw: sessionResult.rawResponse,
    },
    refunded_amount: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: createdTx, error: insertError } = await supabase
    .from('payment_transactions')
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    // If concurrent insert occurred with same idempotency key, retrieve it safely
    if (insertError.code === '23505') {
      const { data: racedTx } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (racedTx) {
        return {
          success: true,
          transaction: racedTx as PaymentTransaction,
        };
      }
    }

    return {
      success: false,
      error: {
        code: PAYMENT_ERRORS.PAYMENT_FAILED,
        message: `Failed to create payment transaction record: ${insertError.message}`,
      },
    };
  }

  return {
    success: true,
    transaction: createdTx as PaymentTransaction,
    clientSecret: sessionResult.clientSecret,
    checkoutUrl: sessionResult.checkoutUrl,
  };
}
