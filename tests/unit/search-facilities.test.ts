import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchFacilities } from '../../apps/web/src/lib/discovery/search-facilities';
import { createSupabaseServerClient } from '../../apps/web/src/lib/supabase/server';

vi.mock('../../apps/web/src/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('../../apps/web/src/lib/supabase/env', () => ({
  isSupabaseConfigured: vi.fn(() => true),
}));

describe('STEP 12 — Smart Sports Discovery, Availability Search & Booking Comparison Unit/Integration Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      in: vi.fn(() => mockSupabase),
      or: vi.fn(() => mockSupabase),
    };
    (createSupabaseServerClient as any).mockResolvedValue(mockSupabase);
  });

  it('1. Sport filtering: correctly filters by sport', async () => {
    mockSupabase.eq.mockResolvedValueOnce({
      data: [{
        id: 'v1', status: 'ACTIVE',
        facilities: [{ id: 'f1', sport_id: 's1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { id: 's1', is_active: true } },
                     { id: 'f2', sport_id: 's2', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { id: 's2', is_active: true } }]
      }],
      error: null
    });

    const res = await searchFacilities({ sportId: 's1' });
    expect(res.items.length).toBe(1);
    expect(res.items[0].id).toBe('f1');
  });

  it('2. Date & start-time filtering & duration: calculates specific slot availability', async () => {
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
      data: [{
        id: 'v1', status: 'ACTIVE',
        venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '20:00:00', is_closed: false }],
        facilities: [{ id: 'f1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { is_active: true } }]
      }],
      error: null
    }));
    mockSupabase.in.mockReturnValueOnce(Promise.resolve({
      data: [], // no bookings
      error: null
    }));

    const res = await searchFacilities({ date: '2030-10-04', startTime: '10:00' });
    expect(res.items.length).toBe(1);
    expect(res.items[0].availability?.is_available).toBe(true);
    expect(res.items[0].availability?.slot_start).toBe('10:00');
  });

  it('3. Duration handling: supports 30, 60, 90, 120 minutes', async () => {
    // 90 minutes starting from 08:00 generates 08:00, 09:30, 11:00. So we need to query for a matching slot.
    // Let's use durationMinutes and startTime that align for each.
    const tests = [
      { dur: 30, time: '10:00' },
      { dur: 60, time: '10:00' },
      { dur: 90, time: '09:30' },
      { dur: 120, time: '10:00' },
    ];
    for (const { dur, time } of tests) {
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: [{
          id: 'v1', status: 'ACTIVE',
          venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '20:00:00', is_closed: false }],
          facilities: [{ id: 'f1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: dur, sport: { is_active: true } }]
        }],
        error: null
      }));
      mockSupabase.in.mockReturnValueOnce(Promise.resolve({
        data: [], // no bookings
        error: null
      }));

      const res = await searchFacilities({ date: '2030-10-04', startTime: time, durationMinutes: dur });
      expect(res.items.length).toBe(1);
      expect(res.items[0].availability?.is_available).toBe(true);
    }
  });

  it('4. Price sorting: sorts facilities by starting price', async () => {
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
      data: [
        {
          id: 'v1', status: 'ACTIVE',
          venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '20:00:00', is_closed: false }],
          facilities: [{ id: 'f1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { is_active: true } }],
          pricing_rules: [{ price_per_hour: 1000, is_active: true, day_of_week: null, start_time: null, facility_id: null }]
        },
        {
          id: 'v2', status: 'ACTIVE',
          venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '20:00:00', is_closed: false }],
          facilities: [{ id: 'f2', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { is_active: true } }],
          pricing_rules: [{ price_per_hour: 800, is_active: true, day_of_week: null, start_time: null, facility_id: null }]
        }
      ],
      error: null
    }));
    mockSupabase.in.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

    const res = await searchFacilities({ date: '2030-10-04', startTime: '10:00', sort: 'price' });
    expect(res.items[0].id).toBe('f2'); // f2 has price 800
    expect(res.items[1].id).toBe('f1'); // f1 has price 1000
  });

  it('5. Unavailable slot detection: detects active HOLD conflict', async () => {
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
      data: [{
        id: 'v1', status: 'ACTIVE',
        venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '20:00:00', is_closed: false }],
        facilities: [{ id: 'f1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { is_active: true } }]
      }],
      error: null
    }));

    // Mock an active HOLD booking overlap
    mockSupabase.in.mockReturnValueOnce(Promise.resolve({
      data: [{
        facility_id: 'f1',
        booking_date: '2030-10-04',
        start_time: '10:00:00',
        end_time: '11:00:00',
        status: 'HOLD',
        hold_expires_at: new Date(Date.now() + 600000).toISOString() // 10 mins future
      }],
      error: null
    }));

    const res = await searchFacilities({ date: '2030-10-04', startTime: '10:00', availability: 'available' });
    expect(res.items.length).toBe(0); // Filters out unavailable when availability=available

    // Let's check with availability=all
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
      data: [{
        id: 'v1', status: 'ACTIVE',
        venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '20:00:00', is_closed: false }],
        facilities: [{ id: 'f1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { is_active: true } }]
      }],
      error: null
    }));
    mockSupabase.in.mockReturnValueOnce(Promise.resolve({
      data: [{
        facility_id: 'f1',
        booking_date: '2030-10-04',
        start_time: '10:00:00',
        end_time: '11:00:00',
        status: 'HOLD',
        hold_expires_at: new Date(Date.now() + 600000).toISOString() // 10 mins future
      }],
      error: null
    }));
    const resAll = await searchFacilities({ date: '2030-10-04', startTime: '10:00', availability: 'all' });
    expect(resAll.items.length).toBe(1);
    expect(resAll.items[0].availability?.is_available).toBe(false);
    expect(resAll.items[0].availability?.reason).toBe('BOOKED');
  });

  it('6. Maintenance conflict: correctly marks as unavailable', async () => {
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
      data: [{
        id: 'v1', status: 'ACTIVE',
        venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '20:00:00', is_closed: false }],
        facilities: [{ id: 'f1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { is_active: true } }],
        maintenance_blocks: [{ facility_id: 'f1', status: 'ACTIVE', start_at: '2030-10-04T08:00:00+05:30', end_at: '2030-10-04T12:00:00+05:30' }]
      }],
      error: null
    }));
    mockSupabase.in.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

    const res = await searchFacilities({ date: '2030-10-04', startTime: '10:00', availability: 'all' });
    expect(res.items[0].availability?.is_available).toBe(false);
    expect(res.items[0].availability?.reason).toBe('MAINTENANCE');
  });

  it('7. Operating-hours conflict: correctly marks as outside hours', async () => {
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
      data: [{
        id: 'v1', status: 'ACTIVE',
        venue_operating_hours: [{ day_of_week: new Date('2030-10-04T12:00:00Z').getUTCDay(), open_time: '08:00:00', close_time: '17:00:00', is_closed: false }],
        facilities: [{ id: 'f1', status: 'AVAILABLE', is_bookable: true, default_duration_minutes: 60, sport: { is_active: true } }]
      }],
      error: null
    }));
    mockSupabase.in.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

    const res = await searchFacilities({ date: '2030-10-04', startTime: '18:00', availability: 'all' });
    expect(res.items[0].availability?.is_available).toBe(false);
    expect(res.items[0].availability?.status).toBe('OUTSIDE_OPERATING_HOURS');
  });

  it('8. Empty result handling: returns 0 items', async () => {
    mockSupabase.eq.mockResolvedValue({ data: [], error: null });
    const res = await searchFacilities({ sportId: 's1' });
    expect(res.items.length).toBe(0);
    expect(res.totalCount).toBe(0);
  });
});
