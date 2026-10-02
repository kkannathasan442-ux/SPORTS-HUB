/**
 * @sportshub/web - Payment Engine Types & Constants
 */

export {
  paymentStatusSchema,
  paymentMethodSchema,
  refundStatusSchema,
  createPaymentSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  paymentQuerySchema,
  type PaymentStatusSchema,
  type PaymentMethodSchema,
  type RefundStatusSchema,
  type CreatePaymentSchema,
  type VerifyPaymentSchema,
  type RefundPaymentSchema,
  type PaymentQuerySchema,
} from '@sportshub/validation';

export type {
  PaymentStatus,
  PaymentMethod,
  RefundStatus,
  PaymentTransaction,
  RefundRecord,
  PaymentWithDetails,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  OwnerFinancialSummary,
  PaymentFilterParams,
} from '@sportshub/types';

export const PAYMENT_ERRORS = {
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_NOT_PAYABLE: 'BOOKING_NOT_PAYABLE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_PAYMENT_AMOUNT: 'INVALID_PAYMENT_AMOUNT',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  REFUND_EXCEEDS_AMOUNT: 'REFUND_EXCEEDS_AMOUNT',
  ALREADY_REFUNDED: 'ALREADY_REFUNDED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  PRICE_TAMPERING_DETECTED: 'PRICE_TAMPERING_DETECTED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
} as const;
