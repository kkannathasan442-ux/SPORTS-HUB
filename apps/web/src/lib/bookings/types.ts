/**
 * @sportshub/web - Booking Engine Types & Constants
 */

export {
  bookingStatusSchema,
  createBookingHoldSchema,
  confirmBookingSchema,
  cancelBookingSchema,
  facilitySlotQuerySchema,
  walkInBookingSchema,
  type BookingStatusSchema,
  type CreateBookingHoldSchema,
  type ConfirmBookingSchema,
  type CancelBookingSchema,
  type FacilitySlotQuerySchema,
  type WalkInBookingSchema,
} from '@sportshub/validation';

export type {
  Booking,
  BookingStatus,
  BookingPriceSnapshot,
  BookingWithDetails,
  FacilitySlot,
  CreateBookingHoldInput,
  CreateBookingHoldResult,
  ConfirmBookingInput,
  ConfirmBookingResult,
  CancelBookingInput,
  CancelBookingResult,
  WalkInBookingInput,
} from '@sportshub/types';

export const BOOKING_ERRORS = {
  FACILITY_NOT_FOUND: 'FACILITY_NOT_FOUND',
  FACILITY_NOT_BOOKABLE: 'FACILITY_NOT_BOOKABLE',
  VENUE_CLOSED: 'VENUE_CLOSED',
  OUTSIDE_OPERATING_HOURS: 'OUTSIDE_OPERATING_HOURS',
  PAST_TIME_SLOT: 'PAST_TIME_SLOT',
  MAINTENANCE_CONFLICT: 'MAINTENANCE_CONFLICT',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  DOUBLE_BOOKED: 'DOUBLE_BOOKED',
  HOLD_EXPIRED: 'HOLD_EXPIRED',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  PRICE_CALCULATION_FAILED: 'PRICE_CALCULATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  BOOKING_FAILED: 'BOOKING_FAILED',
} as const;
