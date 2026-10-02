/**
 * Payment Provider Abstraction Interface
 */

export interface PaymentSessionParams {
  transactionId: string;
  amount: number;
  currency: string;
  bookingReference: string;
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentSessionResult {
  providerTransactionId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  rawResponse?: any;
}

export interface PaymentVerificationParams {
  transactionId: string;
  providerTransactionId?: string;
  verificationToken?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerificationResult {
  success: boolean;
  providerReference: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse?: any;
}

export interface PaymentRefundParams {
  transactionId: string;
  providerTransactionId: string;
  refundAmount: number;
  currency: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentRefundResult {
  success: boolean;
  providerRefundId: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse?: any;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentSession(params: PaymentSessionParams): Promise<PaymentSessionResult>;
  verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult>;
  refundPayment(params: PaymentRefundParams): Promise<PaymentRefundResult>;
}
