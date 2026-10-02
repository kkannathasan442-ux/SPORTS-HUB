import type {
  VenueOperatingHours,
  MaintenanceBlock,
  Booking,
  PricingRule,
  FacilitySlot,
} from '@sportshub/types';
import { BOOKING_CONFIG } from '@sportshub/config';
import { calculateBookingPriceSnapshot } from './pricing';

export interface GenerateFacilitySlotsParams {
  date: string; // YYYY-MM-DD
  operatingHours: VenueOperatingHours | null;
  facility: {
    id: string;
    buffer_minutes: number;
    default_duration_minutes: number;
    is_bookable: boolean;
    status: string;
  };
  durationMinutes?: number;
  intervalMinutes?: number;
  maintenanceBlocks?: MaintenanceBlock[];
  existingBookings?: Booking[];
  pricingRules?: PricingRule[];
  currency?: string;
  now?: Date;
}

/**
 * Generates discrete time slots across the operating day and evaluates availability.
 */
export function generateFacilitySlots({
  date,
  operatingHours,
  facility,
  durationMinutes = 60,
  intervalMinutes = BOOKING_CONFIG.DEFAULT_SLOT_INTERVAL_MINUTES,
  maintenanceBlocks = [],
  existingBookings = [],
  pricingRules = [],
  currency = BOOKING_CONFIG.DEFAULT_CURRENCY,
  now = new Date(),
}: GenerateFacilitySlotsParams): FacilitySlot[] {
  // If facility is not bookable or not available, return empty or all unavailable
  if (!facility.is_bookable || facility.status !== 'AVAILABLE') {
    return [];
  }

  // If operating hours not configured or closed on this day
  if (!operatingHours || operatingHours.is_closed || !operatingHours.open_time || !operatingHours.close_time) {
    return [];
  }

  const openTime = operatingHours.open_time.substring(0, 5); // 'HH:MM'
  const closeTime = operatingHours.close_time.substring(0, 5); // 'HH:MM'

  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);

  const dayOpenMinutes = openHour * 60 + openMin;
  const dayCloseMinutes = closeHour * 60 + closeMin;

  const slots: FacilitySlot[] = [];
  const bufferMins = facility.buffer_minutes || 0;

  // Filter active maintenance blocks for this date and facility
  const relevantMaintenance = maintenanceBlocks.filter((mb) => {
    if (mb.status !== 'ACTIVE') return false;
    if (mb.facility_id !== facility.id) return false;
    const mbStart = new Date(mb.start_at);
    const mbEnd = new Date(mb.end_at);
    const dayStart = new Date(`${date}T00:00:00+05:30`);
    const dayEnd = new Date(`${date}T23:59:59+05:30`);
    return mbStart <= dayEnd && mbEnd >= dayStart;
  });

  // Filter active bookings (CONFIRMED or unexpired HOLD) for this date and facility
  const activeBookings = existingBookings.filter((b) => {
    if (b.facility_id !== facility.id) return false;
    if (b.booking_date !== date) return false;

    if (b.status === 'CONFIRMED') return true;
    if (b.status === 'HOLD') {
      if (!b.hold_expires_at) return false;
      return new Date(b.hold_expires_at) > now;
    }
    return false;
  });

  // Check if requested date is today in current timezone (+05:30)
  const nowIso = now.toISOString();
  const currentDateStr = nowIso.split('T')[0];
  const isToday = date === currentDateStr;

  // Generate slots in steps of intervalMinutes
  for (let currentStart = dayOpenMinutes; currentStart + durationMinutes <= dayCloseMinutes; currentStart += intervalMinutes) {
    const startHour = Math.floor(currentStart / 60);
    const startMin = currentStart % 60;
    const startTimeStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

    const currentEnd = currentStart + durationMinutes;
    const endHour = Math.floor(currentEnd / 60);
    const endMin = currentEnd % 60;
    const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    const slotStartDateTime = new Date(`${date}T${startTimeStr}:00+05:30`);
    const slotEndDateTime = new Date(`${date}T${endTimeStr}:00+05:30`);
    const slotBufferedEndDateTime = new Date(slotEndDateTime.getTime() + bufferMins * 60000);

    let isAvailable = true;
    let unavailableReason: FacilitySlot['unavailableReason'] = undefined;

    // 1. Check if past time
    if (isToday && slotStartDateTime <= now) {
      isAvailable = false;
      unavailableReason = 'PAST';
    }

    // 2. Check maintenance blocks
    if (isAvailable && relevantMaintenance.length > 0) {
      const hasMaintenanceOverlap = relevantMaintenance.some((mb) => {
        const mbStart = new Date(mb.start_at);
        const mbEnd = new Date(mb.end_at);
        return slotStartDateTime < mbEnd && slotBufferedEndDateTime > mbStart;
      });

      if (hasMaintenanceOverlap) {
        isAvailable = false;
        unavailableReason = 'MAINTENANCE';
      }
    }

    // 3. Check existing bookings
    if (isAvailable && activeBookings.length > 0) {
      const hasBookingOverlap = activeBookings.some((b) => {
        const bStart = new Date(`${date}T${b.start_time.substring(0, 5)}:00+05:30`);
        const bEnd = new Date(`${date}T${b.end_time.substring(0, 5)}:00+05:30`);
        const bBufferedEnd = new Date(bEnd.getTime() + bufferMins * 60000);
        return slotStartDateTime < bBufferedEnd && slotBufferedEndDateTime > bStart;
      });

      if (hasBookingOverlap) {
        isAvailable = false;
        unavailableReason = 'BOOKED';
      }
    }

    // 4. Calculate price snapshot
    const priceSnapshot = calculateBookingPriceSnapshot(
      pricingRules,
      facility.id,
      date,
      startTimeStr,
      durationMinutes,
      currency
    );

    slots.push({
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes,
      isAvailable,
      price: priceSnapshot ? priceSnapshot.subtotal : null,
      currency: priceSnapshot ? priceSnapshot.currency : currency,
      unavailableReason,
    });
  }

  return slots;
}
