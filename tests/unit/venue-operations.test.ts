import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkInBooking, markBookingNoShow, completeBooking, createWalkInBooking } from '../../apps/web/src/lib/bookings/operations';
import { BOOKING_ERRORS } from '../../apps/web/src/lib/bookings/types';
import * as createHold from '../../apps/web/src/lib/bookings/create-hold';
import * as confirm from '../../apps/web/src/lib/bookings/confirm-booking';

describe('Venue Operations (STEP 13)', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'staff-1' } }, error: null }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      delete: vi.fn().mockReturnThis(),
    };
  });

  describe('Check-In Validation', () => {
    it('successfully checks in a CONFIRMED booking', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'b1', status: 'CONFIRMED', checked_in_at: null },
        error: null,
      });

      mockSupabase.eq.mockReturnThis();

      const result = await checkInBooking(mockSupabase, 'b1');
      expect(result.success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        checked_in_by: 'staff-1',
        checked_in_at: expect.any(String)
      }));
    });

    it('rejects check-in for non-CONFIRMED booking', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'b1', status: 'HOLD', checked_in_at: null },
        error: null,
      });

      await expect(checkInBooking(mockSupabase, 'b1')).rejects.toThrow('Only CONFIRMED bookings can be checked in');
    });

    it('rejects check-in if already checked in', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'b1', status: 'CONFIRMED', checked_in_at: '2026-10-04T10:00:00Z' },
        error: null,
      });

      await expect(checkInBooking(mockSupabase, 'b1')).rejects.toThrow('Booking is already checked in');
    });
  });

  describe('No-Show Validation', () => {
    it('successfully marks NO_SHOW for CONFIRMED booking', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'b1', status: 'CONFIRMED' },
        error: null,
      });

      const result = await markBookingNoShow(mockSupabase, 'b1');
      expect(result.success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'NO_SHOW' });
    });

    it('rejects NO_SHOW for non-CONFIRMED booking', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'b1', status: 'COMPLETED' },
        error: null,
      });

      await expect(markBookingNoShow(mockSupabase, 'b1')).rejects.toThrow('Only CONFIRMED bookings can be marked as NO_SHOW');
    });
  });

  describe('Completion Validation', () => {
    it('successfully marks COMPLETED for CONFIRMED booking', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'b1', status: 'CONFIRMED', checked_in_at: '2026-10-04T10:00:00Z' },
        error: null,
      });

      const result = await completeBooking(mockSupabase, 'b1');
      expect(result.success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'COMPLETED' });
    });
  });

  describe('Walk-In Booking', () => {
    it('creates and confirms a walk-in booking', async () => {
      vi.spyOn(createHold, 'createBookingHold').mockResolvedValueOnce({
        success: true,
        booking: { id: 'w1' } as any,
      });
      vi.spyOn(confirm, 'confirmBooking').mockResolvedValueOnce({
        success: true,
        booking: { id: 'w1' } as any,
      });

      const input = {
        facilityId: 'f1',
        date: '2026-10-04',
        startTime: '10:00',
        durationMinutes: 60,
        walkInCustomerName: 'Walk In User',
      };

      const result = await createWalkInBooking(mockSupabase, input);
      expect(result.success).toBe(true);
      expect(result.bookingId).toBe('w1');
      
      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_walk_in: true,
        walk_in_customer_name: 'Walk In User',
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'w1');
    });
  });
});
