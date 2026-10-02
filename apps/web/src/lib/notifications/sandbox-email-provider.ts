import type {
  EmailProvider,
  EmailMessageParams,
  EmailSendResult,
} from './provider-interface';

/**
 * Sandbox Email Provider Adapter
 * Simulates email delivery deterministically in development and automated testing.
 */
export class SandboxEmailProvider implements EmailProvider {
  readonly name = 'SANDBOX';
  private outbox: EmailMessageParams[] = [];
  private simulateFailure = false;

  validateRecipient(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  setSimulateFailure(simulate: boolean): void {
    this.simulateFailure = simulate;
  }

  getOutbox(): EmailMessageParams[] {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox = [];
  }

  async sendEmail(params: EmailMessageParams): Promise<EmailSendResult> {
    if (this.simulateFailure) {
      return {
        success: false,
        status: 'FAILED',
        error: {
          code: 'SIMULATED_FAILURE',
          message: 'Simulated network delivery failure',
        },
        failureReason: 'Simulated network delivery failure',
      };
    }

    if (!this.validateRecipient(params.to)) {
      return {
        success: false,
        status: 'FAILED',
        error: {
          code: 'INVALID_RECIPIENT',
          message: `Invalid recipient email address '${params.to}'`,
        },
        failureReason: `Invalid recipient email address '${params.to}'`,
      };
    }

    // Deterministic simulation of provider failures for testing
    if (params.to.includes('fail') || params.to.includes('bounce') || params.subject.includes('SIMULATE_EMAIL_FAIL')) {
      return {
        success: false,
        status: 'FAILED',
        error: {
          code: 'MAIL_DELIVERY_FAILED',
          message: 'Simulated mailbox delivery rejection.',
        },
        failureReason: 'Simulated mailbox delivery rejection.',
        rawResponse: {
          simulated: true,
          reason: 'Simulated failure trigger',
        },
      };
    }

    const messageId = `sbx_email_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    this.outbox.push(params);

    return {
      success: true,
      messageId,
      status: 'SENT',
      rawResponse: {
        provider: 'SANDBOX',
        messageId,
        to: params.to,
        subject: params.subject,
        sentAt: new Date().toISOString(),
      },
    };
  }
}

export const defaultEmailProvider = new SandboxEmailProvider();
