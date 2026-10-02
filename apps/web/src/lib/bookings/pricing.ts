import type { PricingRule, BookingPriceSnapshot } from '@sportshub/types';
import { BOOKING_CONFIG } from '@sportshub/config';

/**
 * Calculates verified booking price snapshot based on venue & facility pricing rules.
 * ZERO fake data: returns null if no valid pricing rule applies.
 */
export function calculateBookingPriceSnapshot(
  pricingRules: PricingRule[],
  facilityId: string,
  dateStr: string, // YYYY-MM-DD
  startTimeStr: string, // HH:MM
  durationMinutes: number,
  currency: string = BOOKING_CONFIG.DEFAULT_CURRENCY
): BookingPriceSnapshot | null {
  if (!pricingRules || pricingRules.length === 0) {
    return null;
  }

  // Parse day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dateObj = new Date(`${dateStr}T12:00:00Z`);
  const dayOfWeek = dateObj.getUTCDay();

  // Normalize time for comparison
  const formattedStartTime = startTimeStr.length === 5 ? `${startTimeStr}:00` : startTimeStr;

  // Filter active rules applicable to this facility or venue-wide (facility_id is null)
  const applicableRules = pricingRules.filter((r) => {
    if (!r.is_active) return false;
    if (r.facility_id !== null && r.facility_id !== facilityId) return false;

    // Date range validity
    if (r.valid_from && r.valid_from > dateStr) return false;
    if (r.valid_until && r.valid_until < dateStr) return false;

    // Day of week match
    if (r.day_of_week !== null && r.day_of_week !== dayOfWeek) return false;

    // Time window match
    if (r.start_time !== null && r.end_time !== null) {
      if (formattedStartTime < r.start_time || formattedStartTime >= r.end_time) {
        return false;
      }
    }

    return true;
  });

  if (applicableRules.length === 0) {
    // Fallback: look for general base rule with no time/day constraints
    const baseRule = pricingRules.find(
      (r) =>
        r.is_active &&
        (r.facility_id === null || r.facility_id === facilityId) &&
        r.day_of_week === null &&
        r.start_time === null
    );

    if (!baseRule) return null;

    const ratePerHour = Number(baseRule.price_per_hour);
    const subtotal = Math.round((ratePerHour * (durationMinutes / 60)) * 100) / 100;

    return {
      baseRatePerHour: ratePerHour,
      appliedRatePerHour: ratePerHour,
      pricingRuleId: baseRule.id,
      pricingRuleName: baseRule.name,
      pricingType: baseRule.pricing_type,
      durationMinutes,
      subtotal,
      currency,
      calculatedAt: new Date().toISOString(),
    };
  }

  // Sort by priority DESC (facility-specific first, highest priority first)
  applicableRules.sort((a, b) => {
    if (a.facility_id && !b.facility_id) return -1;
    if (!a.facility_id && b.facility_id) return 1;
    return (b.priority || 0) - (a.priority || 0);
  });

  const selectedRule = applicableRules[0];
  const ratePerHour = Number(selectedRule.price_per_hour);
  const subtotal = Math.round((ratePerHour * (durationMinutes / 60)) * 100) / 100;

  // Find baseline rate for comparison
  const baseRule = pricingRules.find(
    (r) =>
      r.is_active &&
      (r.facility_id === null || r.facility_id === facilityId) &&
      r.day_of_week === null &&
      r.start_time === null
  );
  const baseRatePerHour = baseRule ? Number(baseRule.price_per_hour) : ratePerHour;

  return {
    baseRatePerHour,
    appliedRatePerHour: ratePerHour,
    pricingRuleId: selectedRule.id,
    pricingRuleName: selectedRule.name,
    pricingType: selectedRule.pricing_type,
    durationMinutes,
    subtotal,
    currency,
    calculatedAt: new Date().toISOString(),
  };
}
