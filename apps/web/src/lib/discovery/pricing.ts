/**
 * Discovery Display Pricing Calculator
 *
 * Evaluates active pricing rules to determine verified preliminary starting rates.
 * Does not invent fake prices or calculate checkout totals (reserved for future Booking Engine).
 */

import type { PricingRule, PricingType } from '@sportshub/types';

export interface CalculatedPricingDisplay {
  price_per_hour: number;
  pricing_type: PricingType;
  currency: string;
}

/**
 * Calculates the starting hourly rate for a venue or specific facility based on configured pricing rules.
 */
export function calculateStartingPrice(
  rules: PricingRule[],
  facilityId?: string | null,
  dayOfWeek?: number | null,
  timeStr?: string | null
): number | null {
  if (!rules || rules.length === 0) {
    return null;
  }

  // Filter to active rules
  const activeRules = rules.filter((r) => r.is_active);
  if (activeRules.length === 0) {
    return null;
  }

  // Filter by facility if specified (rules for specific facility OR venue-wide fallback)
  let applicable = activeRules;
  if (facilityId) {
    applicable = activeRules.filter(
      (r) => r.facility_id === facilityId || r.facility_id === null
    );
  }

  if (applicable.length === 0) {
    return null;
  }

  // If general starting price is requested (no specific day/time filter), return lowest applicable base rate
  if ((dayOfWeek === undefined || dayOfWeek === null) && !timeStr) {
    const prices = applicable
      .map((r) => Number(r.price_per_hour))
      .filter((p) => !isNaN(p) && p >= 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }

  // When a specific slot is queried (day and/or time):
  // 1. If facility-specific rules exist, prefer them over venue-wide rules
  if (facilityId) {
    const facilitySpecific = applicable.filter((r) => r.facility_id === facilityId);
    if (facilitySpecific.length > 0) {
      applicable = facilitySpecific;
    }
  }

  // 2. If specific day of week is requested, prefer specific day matches
  if (dayOfWeek !== undefined && dayOfWeek !== null) {
    const specificDayMatches = applicable.filter((r) => r.day_of_week === dayOfWeek);
    if (specificDayMatches.length > 0) {
      applicable = specificDayMatches;
    } else {
      applicable = applicable.filter((r) => r.day_of_week === null);
    }
  }

  // 3. If time is requested, check matching time windows
  if (timeStr) {
    const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    const specificTimeMatches = applicable.filter((r) => {
      if (!r.start_time || !r.end_time) return false;
      return normalizedTime >= r.start_time && normalizedTime < r.end_time;
    });

    if (specificTimeMatches.length > 0) {
      applicable = specificTimeMatches;
    } else {
      applicable = applicable.filter((r) => !r.start_time || !r.end_time);
    }
  }

  // Sort by priority (highest priority first)
  applicable.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const prices = applicable
    .map((r) => Number(r.price_per_hour))
    .filter((p) => !isNaN(p) && p >= 0);

  if (prices.length === 0) {
    return null;
  }

  // Return highest priority matching rule for the specific slot
  return prices[0];
}
