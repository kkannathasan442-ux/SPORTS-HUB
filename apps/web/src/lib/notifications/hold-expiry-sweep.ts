import { SupabaseClient } from '@supabase/supabase-js';
import { defaultNotificationDispatcher, NotificationDispatcher } from './dispatcher';
import type { BookingWithDetails } from '@sportshub/types';

export interface SweepHoldExpiryOptions {
  windowMinutes?: number; // Minutes before expiry to trigger reminder (default: 3 mins)
  dispatcher?: NotificationDispatcher;
}

export interface SweepHoldExpiryResult {
  checkedCount: number;
  remindersDispatched: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Sweeps active booking holds and dispatches hold expiring reminders.
 * 
 * DESIGN INVARIANTS:
 * - Deterministic & Idempotent: Database UNIQUE constraint on `idempotency_key` ensures repeated sweeps NEVER generate duplicate notifications.
 * - Strict Status Guards: Only bookings with `status = 'HOLD'` and `hold_expires_at > now()` within the reminder window are processed.
 * - Expired, Confirmed, or Cancelled bookings are strictly ignored.
 * - Background Scheduler Note: When running in serverless/stateless environments, this can be triggered via scheduled edge functions or API sweeps.
 */
export async function sweepExpiringHolds(
  supabase: SupabaseClient,
  options: SweepHoldExpiryOptions = {}
): Promise<SweepHoldExpiryResult> {
  const windowMinutes = options.windowMinutes ?? 3;
  const dispatcher = options.dispatcher ?? defaultNotificationDispatcher;
  const result: SweepHoldExpiryResult = {
    checkedCount: 0,
    remindersDispatched: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const windowMaxIso = new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString();

    // Query active holds that expire between now and now + windowMinutes
    const { data: activeHolds, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        customer_user_id,
        organization_id,
        venue_id,
        facility_id,
        sport_id,
        booking_date,
        start_time,
        end_time,
        duration_minutes,
        status,
        subtotal,
        total_amount,
        currency,
        hold_expires_at,
        venue:venues(name),
        facility:facilities(name),
        customer:customer_profiles(full_name, phone)
      `)
      .eq('status', 'HOLD')
      .gt('hold_expires_at', nowIso)
      .lte('hold_expires_at', windowMaxIso);

    if (error) {
      result.errors.push(`Failed to query expiring holds: ${error.message}`);
      return result;
    }

    if (!activeHolds || activeHolds.length === 0) {
      return result;
    }

    result.checkedCount = activeHolds.length;

    for (const hold of activeHolds) {
      try {
        // Calculate remaining minutes
        const expiresAt = new Date(hold.hold_expires_at!).getTime();
        const diffMs = expiresAt - now.getTime();
        const minutesRemaining = Math.max(1, Math.ceil(diffMs / (60 * 1000)));

        await dispatcher.dispatchHoldExpiring(
          supabase,
          hold as unknown as BookingWithDetails,
          minutesRemaining
        );

        result.remindersDispatched += 1;
      } catch (err: any) {
        result.errors.push(`Error processing hold ${hold.id}: ${err?.message || err}`);
        result.skippedCount += 1;
      }
    }

    return result;
  } catch (globalErr: any) {
    result.errors.push(`Global sweep error: ${globalErr?.message || globalErr}`);
    return result;
  }
}
