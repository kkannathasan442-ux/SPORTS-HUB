import type {
  PaymentProvider,
  PaymentSessionParams,
  PaymentSessionResult,
  PaymentVerificationParams,
  PaymentVerificationResult,
  PaymentRefundParams,
  PaymentRefundResult,
} from './provider-interface';

/**
 * Sandbox Payment Provider Adapter
 * Provides deterministic simulation of payment gateways without external network dependencies.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'SANDBOX';

  async createPaymentSession(params: PaymentSessionParams): Promise<PaymentSessionResult> {
    const providerTransactionId = `sbx_sess_${params.transactionId.replace(/-/g, '').slice(0, 16)}`;
    const clientSecret = `sbx_sec_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    const checkoutUrl = `/customer/payments/checkout?session=${providerTransactionId}`;

    return {
      providerTransactionId,
      clientSecret,
      checkoutUrl,
      rawResponse: {
        provider: 'SANDBOX',
        sessionId: providerTransactionId,
        amount: params.amount,
        currency: params.currency,
        bookingReference: params.bookingReference,
      },
    };
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult> {
    const token = params.verificationToken || '';

    // Deterministic failure trigger for testing and edge-case simulation
    if (token.includes('fail') || token.includes('declined') || token === 'tok_error') {
      return {
        success: false,
        providerReference: `sbx_ref_failed_${Date.now()}`,
        failureCode: 'CARD_DECLINED',
        failureMessage: 'The payment transaction was declined by the simulated card issuer.',
        rawResponse: {
          status: 'failed',
          token,
        },
      };
    }

    // Default successful verification
    const providerReference = `SBX-REF-${params.transactionId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    return {
      success: true,
      providerReference,
      rawResponse: {
        status: 'succeeded',
        providerReference,
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  async refundPayment(params: PaymentRefundParams): Promise<PaymentRefundResult> {
    if (params.reason === 'SIMULATE_REFUND_FAILURE') {
      return {
        success: false,
        providerRefundId: `sbx_rfd_failed_${Date.now()}`,
        failureCode: 'REFUND_REJECTED',
        failureMessage: 'Simulated refund rejection by payment provider.',
        rawResponse: { status: 'failed' },
      };
    }

    const providerRefundId = `sbx_rfd_${params.transactionId.replace(/-/g, '').slice(0, 12)}_${Date.now()}`;

    return {
      success: true,
      providerRefundId,
      rawResponse: {
        status: 'refunded',
        refundId: providerRefundId,
        amount: params.refundAmount,
        currency: params.currency,
        refundedAt: new Date().toISOString(),
      },
    };
  }
}

export const defaultPaymentProvider = new SandboxPaymentProvider();
