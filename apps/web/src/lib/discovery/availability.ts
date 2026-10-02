/**
 * Facility Availability Algorithm
 *
 * Evaluates facility operational status, operating hours, and maintenance downtime windows.
 * Interprets dates and times using the platform business timezone (Asia/Colombo).
 * Note: Booking conflict detection will be integrated in the future Booking Engine step.
 */

import type {
  Facility,
  VenueOperatingHours,
  MaintenanceBlock,
  FacilityAvailabilityResult,
  FacilityAvailabilityStatus,
  PricingRule,
} from '@sportshub/types';
import { calculateStartingPrice } from './pricing';

export interface CheckAvailabilityParams {
  facility: Facility;
  venueOperatingHours: VenueOperatingHours[];
  maintenanceBlocks: MaintenanceBlock[];
  pricingRules?: PricingRule[];
  currency?: string;
  dateStr?: string; // YYYY-MM-DD
  timeStr?: string; // HH:mm or HH:mm:ss
  durationMinutes?: number; // default 60
}

/**
 * Calculates day of week (0=Sun, 1=Mon, ..., 6=Sat) for a YYYY-MM-DD string in Asia/Colombo.
 */
export function getDayOfWeekForDate(dateStr: string): number {
  // Parse date parts directly to avoid UTC shift
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.getDay();
}

/**
 * Adds minutes to a time string 'HH:mm' or 'HH:mm:ss' and returns 'HH:mm:ss'.
 */
export function addMinutesToTime(timeStr: string, minutes: number): string {
  const parts = timeStr.split(':').map(Number);
  const totalMins = parts[0] * 60 + parts[1] + minutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMinutes = totalMins % 60;

  const hh = String(newHours).padStart(2, '0');
  const mm = String(newMinutes).padStart(2, '0');
  const ss = parts[2] !== undefined ? String(parts[2]).padStart(2, '0') : '00';

  return `${hh}:${mm}:${ss}`;
}

/**
 * Converts a time string 'HH:mm' or 'HH:mm:ss' to total minutes from 00:00.
 */
export function timeStrToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Normalizes a time string to HH:mm:ss.
 */
export function normalizeTime(timeStr: string): string {
  if (!timeStr) return '00:00:00';
  const parts = timeStr.split(':');
  const hh = String(parts[0]).padStart(2, '0');
  const mm = String(parts[1] || '00').padStart(2, '0');
  const ss = String(parts[2] || '00').padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Evaluates facility availability for a given date and time window.
 */
export function checkFacilityAvailability({
  facility,
  venueOperatingHours,
  maintenanceBlocks,
  pricingRules = [],
  currency = 'LKR',
  dateStr,
  timeStr,
  durationMinutes = 60,
}: CheckAvailabilityParams): FacilityAvailabilityResult {
  // 1. Facility basic operational status check
  if (facility.status === 'ARCHIVED' || facility.status === 'CLOSED') {
    return {
      facility_id: facility.id,
      facility_name: facility.name,
      status: 'UNAVAILABLE',
      is_available: false,
      reason: 'Facility is currently closed.',
    };
  }

  if (facility.status === 'BLOCKED') {
    return {
      facility_id: facility.id,
      facility_name: facility.name,
      status: 'UNAVAILABLE',
      is_available: false,
      reason: 'Facility is temporarily blocked.',
    };
  }

  if (facility.status === 'MAINTENANCE') {
    return {
      facility_id: facility.id,
      facility_name: facility.name,
      status: 'MAINTENANCE',
      is_available: false,
      reason: 'Facility is currently undergoing maintenance.',
    };
  }

  if (!facility.is_bookable) {
    return {
      facility_id: facility.id,
      facility_name: facility.name,
      status: 'NOT_BOOKABLE',
      is_available: false,
      reason: 'Facility is reserved for internal walk-ins or member programs.',
    };
  }

  // 2. If no specific date is requested, return operational baseline
  if (!dateStr) {
    const calculatedRate = calculateStartingPrice(pricingRules, facility.id);

    return {
      facility_id: facility.id,
      facility_name: facility.name,
      status: 'AVAILABLE',
      is_available: true,
      calculated_price: calculatedRate
        ? { price_per_hour: calculatedRate, pricing_type: 'BASE', currency }
        : null,
    };
  }

  // 3. Operating hours schedule check
  const dayOfWeek = getDayOfWeekForDate(dateStr);
  const dayHours = venueOperatingHours.find((h) => h.day_of_week === dayOfWeek);

  if (dayHours && dayHours.is_closed) {
    return {
      facility_id: facility.id,
      facility_name: facility.name,
      status: 'OUTSIDE_OPERATING_HOURS',
      is_available: false,
      reason: 'Venue is closed on this day of the week.',
      operating_hours: {
        open_time: null,
        close_time: null,
        is_closed: true,
      },
    };
  }

  // 4. Time window check within operating hours
  if (timeStr && dayHours) {
    if (dayHours.open_time && dayHours.close_time) {
      const startMins = timeStrToMinutes(timeStr);
      const endMins = startMins + durationMinutes;
      const openMins = timeStrToMinutes(dayHours.open_time);
      const closeMins = timeStrToMinutes(dayHours.close_time);

      const isOutside =
        startMins < openMins ||
        startMins >= closeMins ||
        endMins > closeMins;

      if (isOutside) {
        const openTimeNorm = normalizeTime(dayHours.open_time);
        const closeTimeNorm = normalizeTime(dayHours.close_time);
        return {
          facility_id: facility.id,
          facility_name: facility.name,
          status: 'OUTSIDE_OPERATING_HOURS',
          is_available: false,
          reason: `Requested time is outside venue operating hours (${openTimeNorm.slice(0, 5)} - ${closeTimeNorm.slice(0, 5)}).`,
          operating_hours: {
            open_time: dayHours.open_time,
            close_time: dayHours.close_time,
            is_closed: false,
          },
        };
      }
    }
  }

  // 5. Maintenance downtime conflict check
  if (dateStr && timeStr) {
    const startTimeNorm = normalizeTime(timeStr);
    const endTimeNorm = addMinutesToTime(startTimeNorm, durationMinutes);

    // Construct ISO timestamps in Asia/Colombo (+05:30)
    const reqStartMs = new Date(`${dateStr}T${startTimeNorm}+05:30`).getTime();
    const reqEndMs = new Date(`${dateStr}T${endTimeNorm}+05:30`).getTime();

    const activeBlocks = maintenanceBlocks.filter(
      (b) => b.facility_id === facility.id && b.status === 'ACTIVE'
    );

    for (const block of activeBlocks) {
      const blockStartMs = new Date(block.start_at).getTime();
      const blockEndMs = new Date(block.end_at).getTime();

      // Interval overlap check: reqStart < blockEnd && reqEnd > blockStart
      if (reqStartMs < blockEndMs && reqEndMs > blockStartMs) {
        return {
          facility_id: facility.id,
          facility_name: facility.name,
          status: 'MAINTENANCE',
          is_available: false,
          reason: 'Facility has scheduled maintenance during this time window.',
        };
      }
    }
  }

  // 6. Calculate verified rate for requested date and time
  const calculatedRate = calculateStartingPrice(
    pricingRules,
    facility.id,
    dayOfWeek,
    timeStr
  );

  return {
    facility_id: facility.id,
    facility_name: facility.name,
    status: 'AVAILABLE',
    is_available: true,
    operating_hours: dayHours
      ? {
          open_time: dayHours.open_time,
          close_time: dayHours.close_time,
          is_closed: dayHours.is_closed,
        }
      : undefined,
    calculated_price: calculatedRate
      ? { price_per_hour: calculatedRate, pricing_type: 'BASE', currency }
      : null,
  };
}
