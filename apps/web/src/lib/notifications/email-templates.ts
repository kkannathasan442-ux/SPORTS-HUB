import { formatCurrency } from '@sportshub/shared';

export interface EmailTemplateResult {
  subject: string;
  htmlContent: string;
  textContent: string;
}

/**
 * 1. Booking Confirmation Email Template
 */
export function renderBookingConfirmationEmail(data: {
  customerName: string;
  bookingReference: string;
  venueName: string;
  facilityName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalAmount: number;
  currency: string;
}): EmailTemplateResult {
  const subject = `Booking Confirmed — ${data.bookingReference} at ${data.venueName}`;
  const formattedAmount = formatCurrency(data.totalAmount, data.currency);

  const textContent = `
Hello ${data.customerName},

Your court reservation at ${data.venueName} has been confirmed!

Booking Reference: ${data.bookingReference}
Facility: ${data.facilityName}
Date: ${data.bookingDate}
Time: ${data.startTime} - ${data.endTime} (${data.durationMinutes} mins)
Total Amount: ${formattedAmount}
Status: CONFIRMED

Please arrive 10 minutes prior to your scheduled time.
View your reservation ticket at: https://sportshub.local/customer/bookings

Thank you for choosing SportsHub!
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; padding: 32px; color: #ffffff;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.05em; margin-bottom: 8px;">SportsHub Official Reservation</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff;">Booking Confirmed!</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Reference: <strong style="font-family: monospace; color: #38bdf8;">${data.bookingReference}</strong></p>
    </div>
    <div style="padding: 32px;">
      <p style="margin-top: 0; font-size: 14px; color: #475569;">Hello <strong>${data.customerName}</strong>,</p>
      <p style="font-size: 14px; color: #475569;">Your sports court reservation has been locked and confirmed. Here is your official booking receipt:</p>
      
      <div style="background-color: #f1f5f9; border-radius: 16px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Venue</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0f172a;">${data.venueName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Facility</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0f172a;">${data.facilityName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Date</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0f172a;">${data.bookingDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Time Slot</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0f172a; font-family: monospace;">${data.startTime} - ${data.endTime}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Duration</td>
            <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0f172a;">${data.durationMinutes} Minutes</td>
          </tr>
          <tr style="border-top: 1px solid #cbd5e1;">
            <td style="padding: 12px 0 0 0; font-weight: 800; color: #0f172a;">Total Paid</td>
            <td style="padding: 12px 0 0 0; font-weight: 900; text-align: right; color: #059669; font-size: 16px;">${formattedAmount}</td>
          </tr>
        </table>
      </div>
      
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Please present your booking reference code at the front desk when arriving at the venue.</p>
    </div>
  </div>
 </body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}

/**
 * 2. Booking Cancellation Email Template
 */
export function renderBookingCancellationEmail(data: {
  customerName: string;
  bookingReference: string;
  venueName: string;
  facilityName: string;
  bookingDate: string;
  reason?: string | null;
}): EmailTemplateResult {
  const subject = `Booking Cancelled — ${data.bookingReference} at ${data.venueName}`;

  const textContent = `
Hello ${data.customerName},

Your booking (${data.bookingReference}) at ${data.venueName} - ${data.facilityName} scheduled for ${data.bookingDate} has been cancelled.
Reason: ${data.reason || 'Requested cancellation'}

If this was a paid reservation, your refund will be processed according to the cancellation policy.
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background-color: #e11d48; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 900;">Booking Cancelled</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Ref: ${data.bookingReference}</p>
    </div>
    <div style="padding: 32px; font-size: 14px; color: #475569;">
      <p>Hello <strong>${data.customerName}</strong>,</p>
      <p>Your reservation for <strong>${data.facilityName}</strong> at <strong>${data.venueName}</strong> on <strong>${data.bookingDate}</strong> has been cancelled.</p>
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}

/**
 * 3. Payment Success Email Template
 */
export function renderPaymentSuccessEmail(data: {
  customerName: string;
  transactionReference: string;
  bookingReference: string;
  amount: number;
  currency: string;
  paymentMethod: string;
}): EmailTemplateResult {
  const subject = `Payment Receipt — ${data.transactionReference} (${formatCurrency(data.amount, data.currency)})`;
  const formattedAmount = formatCurrency(data.amount, data.currency);

  const textContent = `
Hello ${data.customerName},

We have received your payment of ${formattedAmount}.

Transaction Reference: ${data.transactionReference}
Booking Reference: ${data.bookingReference}
Payment Method: ${data.paymentMethod}
Status: SUCCESS

Thank you for your business!
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background-color: #059669; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 900;">Payment Successful</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Transaction Ref: ${data.transactionReference}</p>
    </div>
    <div style="padding: 32px; font-size: 14px; color: #475569;">
      <p>Hello <strong>${data.customerName}</strong>,</p>
      <p>Your payment of <strong style="color: #059669; font-size: 16px;">${formattedAmount}</strong> has been verified.</p>
      <p>Associated Booking: <strong>${data.bookingReference}</strong><br>Method: <strong>${data.paymentMethod}</strong></p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}

/**
 * 4. Payment Failure Email Template
 */
export function renderPaymentFailureEmail(data: {
  customerName: string;
  bookingReference: string;
  amount: number;
  currency: string;
  failureMessage?: string | null;
}): EmailTemplateResult {
  const subject = `Payment Unsuccessful — Booking ${data.bookingReference}`;
  const formattedAmount = formatCurrency(data.amount, data.currency);

  const textContent = `
Hello ${data.customerName},

Your payment attempt of ${formattedAmount} for booking ${data.bookingReference} was unsuccessful.
Message: ${data.failureMessage || 'Card was declined or session expired.'}

Please check your card details and payment method.
You can retry your payment at: https://sportshub.local/customer/bookings
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background-color: #dc2626; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 900;">Payment Failed</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Booking Ref: ${data.bookingReference}</p>
    </div>
    <div style="padding: 32px; font-size: 14px; color: #475569;">
      <p>Hello <strong>${data.customerName}</strong>,</p>
      <p>Your payment attempt of <strong>${formattedAmount}</strong> could not be processed.</p>
      <p style="color: #dc2626;"><strong>Reason:</strong> ${data.failureMessage || 'Payment provider declined the transaction.'}</p>
      <p>Please check your card details and retry your reservation checkout.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}

/**
 * 5. Refund Processed Email Template
 */
export function renderRefundProcessedEmail(data: {
  customerName: string;
  refundReference: string;
  bookingReference: string;
  refundAmount: number;
  currency: string;
  reason?: string | null;
}): EmailTemplateResult {
  const formattedAmount = formatCurrency(data.refundAmount, data.currency);
  const subject = `Refund Processed — ${formattedAmount} for Booking ${data.bookingReference}`;

  const textContent = `
Hello ${data.customerName},

A refund of ${formattedAmount} has been processed for booking ${data.bookingReference}.
Refund Reference: ${data.refundReference}
Reason: ${data.reason || 'Approved refund'}

The funds should reflect in your account according to your bank's settlement window.
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background-color: #7c3aed; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 900;">Refund Processed</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Refund Ref: ${data.refundReference}</p>
    </div>
    <div style="padding: 32px; font-size: 14px; color: #475569;">
      <p>Hello <strong>${data.customerName}</strong>,</p>
      <p>A refund of <strong style="color: #7c3aed; font-size: 16px;">${formattedAmount}</strong> has been issued for booking <strong>${data.bookingReference}</strong>.</p>
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}

/**
 * 6. Hold Expiring Reminder Email Template
 */
export function renderBookingHoldExpiringEmail(data: {
  customerName: string;
  bookingReference: string;
  facilityName: string;
  minutesRemaining: number;
}): EmailTemplateResult {
  const subject = `Hold Expiring Soon — Court Hold in ${data.minutesRemaining} Minutes (${data.bookingReference})`;

  const textContent = `
Hello ${data.customerName},

Your temporary reservation hold on ${data.facilityName} (${data.bookingReference}) will expire in approximately ${data.minutesRemaining} minutes.
Please complete your payment or confirmation to secure the slot.
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background-color: #d97706; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 900;">Court Hold Expiring Soon</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">${data.minutesRemaining} Minutes Remaining</p>
    </div>
    <div style="padding: 32px; font-size: 14px; color: #475569;">
      <p>Hello <strong>${data.customerName}</strong>,</p>
      <p>Your hold on <strong>${data.facilityName}</strong> (Ref: <strong>${data.bookingReference}</strong>) is about to expire. Confirm or pay to lock your booking.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}
