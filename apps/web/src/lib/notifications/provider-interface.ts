/**
 * Email Provider Abstraction Interface
 */

export interface EmailMessageParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  from?: string;
  replyTo?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING';
  error?: {
    code: string;
    message: string;
  };
  failureReason?: string;
  rawResponse?: any;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(params: EmailMessageParams): Promise<EmailSendResult>;
  validateRecipient(email: string): boolean;
}
