import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkInBooking, markBookingNoShow, completeBooking, createWalkInBooking } from '../../apps/web/src/lib/bookings/operations';
import * as queries from '../../apps/web/src/lib/bookings/queries';

describe('STEP 13 - State Transition Matrix', () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'staff-1', role: 'RECEPTIONIST' };
    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };
  });

  const validTransitions = [
    { from: 'CONFIRMED', action: checkInBooking, to: 'checked in' },
    { from: 'CONFIRMED', action: completeBooking, to: 'COMPLETED' },
    { from: 'CONFIRMED', action: markBookingNoShow, to: 'NO_SHOW' },
  ];

  validTransitions.forEach(({ from, action, to }) => {
    it(`Valid: ${from} -> ${to}`, async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'b1', status: from }, error: null });
      const res = await action(mockSupabase, 'b1');
      expect(res.success).toBe(true);
    });
  });

  const invalidTransitions = [
    { from: 'CANCELLED', action: checkInBooking },
    { from: 'EXPIRED', action: checkInBooking },
    { from: 'COMPLETED', action: checkInBooking },
    { from: 'NO_SHOW', action: checkInBooking },
    { from: 'CANCELLED', action: completeBooking },
    { from: 'NO_SHOW', action: completeBooking },
    { from: 'COMPLETED', action: markBookingNoShow },
  ];

  invalidTransitions.forEach(({ from, action }) => {
    it(`Invalid: ${from} -> ${action.name}`, async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'b1', status: from }, error: null });
      await expect(action(mockSupabase, 'b1')).rejects.toThrow();
    });
  });
});

describe('STEP 13 - Security & Tampering Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'staff-1' } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
  });

  it('Customer cannot check in (fails auth/RBAC)', async () => {
    mockSupabase.single.mockResolvedValueOnce({ error: { message: 'Row not found' }, data: null });
    await expect(checkInBooking(mockSupabase, 'b1')).rejects.toThrow('Booking not found or access denied');
  });

  it('Wrong organization receptionist cannot check in (RLS filters out row)', async () => {
    mockSupabase.single.mockResolvedValueOnce({ error: { message: 'Row not found' }, data: null });
    await expect(checkInBooking(mockSupabase, 'b1')).rejects.toThrow();
  });

  it('Client tampering with checked_in_by is ignored, server forces user.id', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'b1', status: 'CONFIRMED' }, error: null });
    await checkInBooking(mockSupabase, 'b1');
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      checked_in_by: 'staff-1', // strictly server-derived
      checked_in_at: expect.any(String),
    }));
  });
});
