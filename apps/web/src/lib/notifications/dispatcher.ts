import { SupabaseClient } from '@supabase/supabase-js';
import { createNotification, getUserPreferences } from './notification-service';
import { defaultEmailProvider } from './sandbox-email-provider';
import type { EmailProvider } from './provider-interface';
import {
  renderBookingConfirmationEmail,
  renderBookingCancellationEmail,
  renderPaymentSuccessEmail,
  renderPaymentFailureEmail,
  renderRefundProcessedEmail,
  renderBookingHoldExpiringEmail,
} from './email-templates';
import type { BookingWithDetails, PaymentTransaction, RefundRecord } from '@sportshub/types';
import { formatCurrency } from '@sportshub/shared';

/**
 * Event Dispatcher for Centralized Notification Delivery
 * 
 * DESIGN INVARIANTS:
 * - Asynchronous & Fault-Isolated: Failure to deliver a notification or email NEVER breaks the underlying business transaction.
 * - Idempotent: Every dispatch generates a deterministic idempotency key to prevent duplicate notifications.
 * - Multi-Channel: Creates IN_APP notification and dispatches formatted EMAIL according to user preferences.
 */
export class NotificationDispatcher {
  constructor(private emailProvider: EmailProvider = defaultEmailProvider) {}

  /**
   * 1. Booking Hold Created Dispatch
   */
  async dispatchBookingHoldCreated(
    supabase: SupabaseClient,
    booking: BookingWithDetails
  ): Promise<void> {
    try {
      const idempotencyKey = `hold_created_${booking.id}_${booking.customer_user_id}_inapp`;
      const facilityName = booking.facility?.name || 'Facility';
      const venueName = booking.venue?.name || 'Venue';

      await createNotification(supabase, {
        organizationId: booking.organization_id,
        recipientUserId: booking.customer_user_id,
        notificationType: 'BOOKING_HOLD_CREATED',
        title: 'Court Hold Reserved (10 Mins)',
        message: `Your hold for ${facilityName} at ${venueName} on ${booking.booking_date} (${booking.start_time.slice(0, 5)}) is active. Complete checkout before it expires.`,
        relatedEntityType: 'booking',
        relatedEntityId: booking.id,
        channel: 'IN_APP',
        idempotencyKey,
        metadata: {
          bookingReference: booking.booking_reference,
          holdExpiresAt: booking.hold_expires_at,
        },
      });
    } catch (err) {
      console.warn('Notification dispatch error (Hold Created):', err);
    }
  }

  /**
   * 2. Booking Confirmed Dispatch (Customer + Email)
   */
  async dispatchBookingConfirmed(
    supabase: SupabaseClient,
    booking: BookingWithDetails,
    recipientEmail?: string
  ): Promise<void> {
    try {
      const idempotencyKey = `booking_confirmed_${booking.id}_${booking.customer_user_id}`;
      const facilityName = booking.facility?.name || 'Sports Facility';
      const venueName = booking.venue?.name || 'SportsHub Venue';
      const formattedAmount = formatCurrency(booking.total_amount, booking.currency);

      // In-App Notification
      await createNotification(supabase, {
        organizationId: booking.organization_id,
        recipientUserId: booking.customer_user_id,
        notificationType: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed!',
        message: `Your reservation at ${venueName} (${facilityName}) on ${booking.booking_date} from ${booking.start_time.slice(0, 5)} to ${booking.end_time.slice(0, 5)} is confirmed. Ref: ${booking.booking_reference}.`,
        relatedEntityType: 'booking',
        relatedEntityId: booking.id,
        channel: 'IN_APP',
        idempotencyKey: `${idempotencyKey}_inapp`,
        metadata: {
          bookingReference: booking.booking_reference,
          totalAmount: booking.total_amount,
          currency: booking.currency,
        },
      });

      // Check Preferences & Send Email
      const prefs = await getUserPreferences(supabase, booking.customer_user_id);
      if (prefs.email_booking_confirmations && recipientEmail) {
        const customerName = booking.customer?.full_name || 'Customer';
        const template = renderBookingConfirmationEmail({
          customerName,
          bookingReference: booking.booking_reference,
          venueName,
          facilityName,
          bookingDate: booking.booking_date,
          startTime: booking.start_time.slice(0, 5),
          endTime: booking.end_time.slice(0, 5),
          durationMinutes: booking.duration_minutes,
          totalAmount: booking.total_amount,
          currency: booking.currency,
        });

        await this.emailProvider.sendEmail({
          to: recipientEmail,
          toName: customerName,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          idempotencyKey: `${idempotencyKey}_email`,
          metadata: { bookingId: booking.id },
        });
      }
    } catch (err) {
      console.warn('Notification dispatch error (Booking Confirmed):', err);
    }
  }

  /**
   * 3. Booking Cancelled Dispatch
   */
  async dispatchBookingCancelled(
    supabase: SupabaseClient,
    booking: BookingWithDetails,
    recipientEmail?: string
  ): Promise<void> {
    try {
      const idempotencyKey = `booking_cancelled_${booking.id}_${booking.customer_user_id}`;
      const facilityName = booking.facility?.name || 'Facility';
      const venueName = booking.venue?.name || 'Venue';

      await createNotification(supabase, {
        organizationId: booking.organization_id,
        recipientUserId: booking.customer_user_id,
        notificationType: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message: `Your booking (${booking.booking_reference}) for ${facilityName} on ${booking.booking_date} has been cancelled.`,
        relatedEntityType: 'booking',
        relatedEntityId: booking.id,
        channel: 'IN_APP',
        idempotencyKey: `${idempotencyKey}_inapp`,
        metadata: {
          bookingReference: booking.booking_reference,
          cancellationReason: booking.cancellation_reason,
        },
      });

      const prefs = await getUserPreferences(supabase, booking.customer_user_id);
      if (prefs.email_cancellations && recipientEmail) {
        const customerName = booking.customer?.full_name || 'Customer';
        const template = renderBookingCancellationEmail({
          customerName,
          bookingReference: booking.booking_reference,
          venueName,
          facilityName,
          bookingDate: booking.booking_date,
          reason: booking.cancellation_reason,
        });

        await this.emailProvider.sendEmail({
          to: recipientEmail,
          toName: customerName,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          idempotencyKey: `${idempotencyKey}_email`,
        });
      }
    } catch (err) {
      console.warn('Notification dispatch error (Booking Cancelled):', err);
    }
  }

  /**
   * 4. Walk-In Booking Created Dispatch
   */
  async dispatchWalkInBookingCreated(
    supabase: SupabaseClient,
    booking: BookingWithDetails,
    creatorUserId: string
  ): Promise<void> {
    try {
      const idempotencyKey = `walkin_${booking.id}_${creatorUserId}_inapp`;
      await createNotification(supabase, {
        organizationId: booking.organization_id,
        recipientUserId: creatorUserId,
        notificationType: 'WALK_IN_BOOKING_CREATED',
        title: 'Walk-In Booking Registered',
        message: `Front-desk walk-in registered for ${booking.facility?.name || 'Court'} (${booking.booking_reference}).`,
        relatedEntityType: 'booking',
        relatedEntityId: booking.id,
        channel: 'IN_APP',
        idempotencyKey,
        metadata: {
          bookingReference: booking.booking_reference,
          bookingDate: booking.booking_date,
        },
      });
    } catch (err) {
      console.warn('Notification dispatch error (Walk-In Created):', err);
    }
  }

  /**
   * 5. Payment Success Dispatch
   */
  async dispatchPaymentSuccess(
    supabase: SupabaseClient,
    transaction: PaymentTransaction,
    bookingReference: string,
    recipientEmail?: string,
    customerName?: string
  ): Promise<void> {
    try {
      const idempotencyKey = `pay_success_${transaction.id}_${transaction.customer_user_id}`;
      const formattedAmount = formatCurrency(transaction.amount, transaction.currency);

      await createNotification(supabase, {
        organizationId: transaction.organization_id,
        recipientUserId: transaction.customer_user_id,
        notificationType: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Your payment of ${formattedAmount} for booking ${bookingReference} has been verified. Ref: ${transaction.provider_reference || transaction.id.slice(0, 8).toUpperCase()}.`,
        relatedEntityType: 'payment',
        relatedEntityId: transaction.id,
        channel: 'IN_APP',
        idempotencyKey: `${idempotencyKey}_inapp`,
        metadata: {
          amount: transaction.amount,
          currency: transaction.currency,
          bookingReference,
          providerReference: transaction.provider_reference,
        },
      });

      const prefs = await getUserPreferences(supabase, transaction.customer_user_id);
      if (prefs.email_payment_receipts && recipientEmail) {
        const name = customerName || 'Customer';
        const template = renderPaymentSuccessEmail({
          customerName: name,
          transactionReference: transaction.provider_reference || transaction.id.slice(0, 8).toUpperCase(),
          bookingReference,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.payment_method,
        });

        await this.emailProvider.sendEmail({
          to: recipientEmail,
          toName: name,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          idempotencyKey: `${idempotencyKey}_email`,
        });
      }
    } catch (err) {
      console.warn('Notification dispatch error (Payment Success):', err);
    }
  }

  /**
   * 6. Payment Failed Dispatch
   */
  async dispatchPaymentFailed(
    supabase: SupabaseClient,
    transaction: PaymentTransaction,
    bookingReference: string,
    recipientEmail?: string,
    customerName?: string
  ): Promise<void> {
    try {
      const idempotencyKey = `pay_failed_${transaction.id}_${transaction.customer_user_id}`;
      const formattedAmount = formatCurrency(transaction.amount, transaction.currency);

      await createNotification(supabase, {
        organizationId: transaction.organization_id,
        recipientUserId: transaction.customer_user_id,
        notificationType: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Your payment of ${formattedAmount} for booking ${bookingReference} could not be processed. ${transaction.failure_message || 'Please retry with another payment card.'}`,
        relatedEntityType: 'payment',
        relatedEntityId: transaction.id,
        channel: 'IN_APP',
        idempotencyKey: `${idempotencyKey}_inapp`,
        metadata: {
          amount: transaction.amount,
          currency: transaction.currency,
          failureCode: transaction.failure_code,
          failureMessage: transaction.failure_message,
        },
      });

      if (recipientEmail) {
        const name = customerName || 'Customer';
        const template = renderPaymentFailureEmail({
          customerName: name,
          bookingReference,
          amount: transaction.amount,
          currency: transaction.currency,
          failureMessage: transaction.failure_message,
        });

        await this.emailProvider.sendEmail({
          to: recipientEmail,
          toName: name,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          idempotencyKey: `${idempotencyKey}_email`,
        });
      }
    } catch (err) {
      console.warn('Notification dispatch error (Payment Failed):', err);
    }
  }

  /**
   * 7. Refund Processed Dispatch
   */
  async dispatchRefundProcessed(
    supabase: SupabaseClient,
    refund: RefundRecord,
    bookingReference: string,
    recipientEmail?: string,
    customerName?: string
  ): Promise<void> {
    try {
      // Retrieve transaction to find customer
      const { data: tx } = await supabase
        .from('payment_transactions')
        .select('customer_user_id')
        .eq('id', refund.payment_transaction_id)
        .single();

      if (!tx || !tx.customer_user_id) return;

      const idempotencyKey = `refund_processed_${refund.id}_${tx.customer_user_id}`;
      const formattedAmount = formatCurrency(refund.amount, refund.currency);

      await createNotification(supabase, {
        organizationId: refund.organization_id,
        recipientUserId: tx.customer_user_id,
        notificationType: 'REFUND_PROCESSED',
        title: 'Refund Processed',
        message: `A refund of ${formattedAmount} has been processed for booking ${bookingReference}.`,
        relatedEntityType: 'refund',
        relatedEntityId: refund.id,
        channel: 'IN_APP',
        idempotencyKey: `${idempotencyKey}_inapp`,
        metadata: {
          refundAmount: refund.amount,
          currency: refund.currency,
          reason: refund.reason,
          providerRefundId: refund.provider_refund_id,
        },
      });

      if (recipientEmail) {
        const name = customerName || 'Customer';
        const template = renderRefundProcessedEmail({
          customerName: name,
          refundReference: refund.provider_refund_id || refund.id.slice(0, 8).toUpperCase(),
          bookingReference,
          refundAmount: refund.amount,
          currency: refund.currency,
          reason: refund.reason,
        });

        await this.emailProvider.sendEmail({
          to: recipientEmail,
          toName: name,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          idempotencyKey: `${idempotencyKey}_email`,
        });
      }
    } catch (err) {
      console.warn('Notification dispatch error (Refund Processed):', err);
    }
  }

  /**
   * 8. Hold Expiring Reminder Dispatch
   */
  async dispatchHoldExpiring(
    supabase: SupabaseClient,
    booking: BookingWithDetails,
    minutesRemaining: number = 2,
    recipientEmail?: string
  ): Promise<void> {
    try {
      const idempotencyKey = `hold_expiring_${booking.id}_${booking.customer_user_id}_inapp`;
      const facilityName = booking.facility?.name || 'Facility';

      await createNotification(supabase, {
        organizationId: booking.organization_id,
        recipientUserId: booking.customer_user_id,
        notificationType: 'BOOKING_HOLD_EXPIRING',
        title: 'Hold Expiring Soon!',
        message: `Your court hold on ${facilityName} (${booking.booking_reference}) expires in ${minutesRemaining} minutes. Complete checkout to secure your slot.`,
        relatedEntityType: 'booking',
        relatedEntityId: booking.id,
        channel: 'IN_APP',
        idempotencyKey,
        metadata: {
          bookingReference: booking.booking_reference,
          minutesRemaining,
        },
      });

      const prefs = await getUserPreferences(supabase, booking.customer_user_id);
      if (prefs.email_hold_reminders && recipientEmail) {
        const customerName = booking.customer?.full_name || 'Customer';
        const template = renderBookingHoldExpiringEmail({
          customerName,
          bookingReference: booking.booking_reference,
          facilityName,
          minutesRemaining,
        });

        await this.emailProvider.sendEmail({
          to: recipientEmail,
          toName: customerName,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          idempotencyKey: `${idempotencyKey}_email`,
        });
      }
    } catch (err) {
      console.warn('Notification dispatch error (Hold Expiring):', err);
    }
  }

  async dispatchTeamMemberInvited(
    supabase: SupabaseClient,
    invite: { id: string; team_id: string; invited_email: string; organization_id?: string | null },
    teamName: string,
    inviterName: string,
    recipientUserId?: string | null
  ): Promise<void> {
    try {
      if (!recipientUserId) return; // Only dispatch in-app if the user exists
      const idempotencyKey = `team_invite_${invite.id}_inapp`;
      await createNotification(supabase, {
        organizationId: invite.organization_id || null,
        recipientUserId: recipientUserId,
        notificationType: 'TEAM_MEMBER_INVITED' as any,
        title: `Team Invitation: ${teamName}`,
        message: `${inviterName} has invited you to join ${teamName}. Check your invitations to accept.`,
        relatedEntityType: 'team_invitation',
        relatedEntityId: invite.id,
        channel: 'IN_APP',
        idempotencyKey,
      });
    } catch (err) {
      console.warn('Notification dispatch error (Team Invited):', err);
    }
  }

  async dispatchTeamMemberJoined(
    supabase: SupabaseClient,
    teamId: string,
    userId: string,
    teamName: string,
    joinedUserName: string,
    captainUserId: string,
    organizationId?: string | null
  ): Promise<void> {
    try {
      const idempotencyKey = `team_joined_${teamId}_${userId}_inapp`;
      await createNotification(supabase, {
        organizationId: organizationId || null,
        recipientUserId: captainUserId,
        notificationType: 'TEAM_MEMBER_JOINED' as any,
        title: `New Team Member`,
        message: `${joinedUserName} has accepted the invitation and joined ${teamName}.`,
        relatedEntityType: 'team',
        relatedEntityId: teamId,
        channel: 'IN_APP',
        idempotencyKey,
      });
    } catch (err) {
      console.warn('Notification dispatch error (Team Joined):', err);
    }
  }
}

export const defaultNotificationDispatcher = new NotificationDispatcher();
