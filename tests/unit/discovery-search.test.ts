import { describe, it, expect } from 'vitest';
import {
  venueSearchParamsSchema,
  locationSearchParamsSchema,
  availabilitySearchParamsSchema,
} from '@sportshub/validation';
import { calculateHaversineDistance } from '../../apps/web/src/lib/discovery/distance';
import { calculateStartingPrice } from '../../apps/web/src/lib/discovery/pricing';
import { checkFacilityAvailability } from '../../apps/web/src/lib/discovery/availability';
import type {
  Facility,
  VenueOperatingHours,
  MaintenanceBlock,
  PricingRule,
} from '@sportshub/types';

describe('STEP 5 — Customer Discovery & Availability Foundation Unit Tests', () => {
  // 1. Zod Validation Schemas
  describe('Search Params Validation', () => {
    it('accepts valid search parameters', () => {
      const validParams = {
        sportId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2026-10-15',
        startTime: '19:00',
        durationMinutes: 60,
        latitude: 9.6615,
        longitude: 80.0255,
        locationText: 'Nallur, Jaffna',
        radiusKm: 5,
        minPrice: 1000,
        maxPrice: 5000,
        availability: 'available',
        facilityType: 'Court',
        sort: 'distance',
        page: 1,
        pageSize: 12,
      };

      const result = venueSearchParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.radiusKm).toBe(5);
        expect(result.data.sort).toBe('distance');
      }
    });

    it('coerces string numbers and handles defaults', () => {
      const stringParams = {
        radiusKm: '10',
        page: '2',
        pageSize: '24',
        minPrice: '500',
        maxPrice: '3000',
      };

      const result = venueSearchParamsSchema.safeParse(stringParams);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.radiusKm).toBe(10);
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(24);
      }
    });

    it('rejects invalid date formats', () => {
      const invalid = { date: 'invalid-date' };
      const result = venueSearchParamsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid time formats', () => {
      const invalid = { startTime: '7pm' };
      const result = venueSearchParamsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid latitude and longitude ranges', () => {
      expect(venueSearchParamsSchema.safeParse({ latitude: 95 }).success).toBe(false);
      expect(venueSearchParamsSchema.safeParse({ longitude: 190 }).success).toBe(false);
    });
  });

  // 2. Haversine Distance Calculation
  describe('Haversine Distance Calculation', () => {
    it('calculates accurate distance between Jaffna and Nallur (~2.5 km)', () => {
      // Jaffna Railway Station: 9.6636, 80.0210
      // Nallur Kandaswamy Kovil: 9.6744, 80.0298
      const distance = calculateHaversineDistance(9.6636, 80.021, 9.6744, 80.0298);
      expect(distance).toBeGreaterThan(1.0);
      expect(distance).toBeLessThan(2.0);
    });

    it('calculates distance between Colombo and Jaffna (~300-350 km)', () => {
      // Colombo: 6.9271, 79.8612
      // Jaffna: 9.6615, 80.0255
      const distance = calculateHaversineDistance(6.9271, 79.8612, 9.6615, 80.0255);
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(350);
    });

    it('returns 0 for identical coordinates', () => {
      const distance = calculateHaversineDistance(6.9271, 79.8612, 6.9271, 79.8612);
      expect(distance).toBe(0);
    });
  });

  // 3. Pricing Calculation
  describe('Starting Price Calculation', () => {
    const mockPricingRules: PricingRule[] = [
      {
        id: 'rule-1',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: null,
        name: 'Venue Standard Rate',
        pricing_type: 'BASE',
        day_of_week: null,
        start_time: null,
        end_time: null,
        price_per_hour: 2000,
        member_price: 1800,
        priority: 0,
        valid_from: null,
        valid_until: null,
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'rule-2',
        organization_id: 'org-1',
        venue_id: 'venue-1',
        facility_id: 'fac-1',
        name: 'Court 1 Peak Evening Rate',
        pricing_type: 'PEAK',
        day_of_week: 5, // Friday
        start_time: '18:00:00',
        end_time: '22:00:00',
        price_per_hour: 2500,
        member_price: null,
        priority: 10,
        valid_from: null,
        valid_until: null,
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    it('returns lowest facility price when no specific time is provided', () => {
      const price = calculateStartingPrice(mockPricingRules, 'fac-1');
      expect(price).toBe(2000);
    });

    it('returns peak price when matching day and time window', () => {
      const price = calculateStartingPrice(mockPricingRules, 'fac-1', 5, '19:00');
      expect(price).toBe(2500);
    });

    it('returns null if no pricing rules exist (no fake fallback)', () => {
      const price = calculateStartingPrice([], 'fac-999');
      expect(price).toBeNull();
    });
  });

  // 4. Availability Algorithm
  describe('Facility Availability Algorithm', () => {
    const mockFacility: Facility = {
      id: 'fac-badminton-1',
      venue_id: 'venue-1',
      sport_id: 'sport-badminton',
      name: 'Badminton Court 01',
      slug: 'badminton-court-01',
      description: 'Wooden sprung badminton court',
      facility_type: 'Indoor Court',
      capacity: 4,
      status: 'AVAILABLE',
      is_bookable: true,
      default_duration_minutes: 60,
      buffer_minutes: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    const mockOperatingHours: VenueOperatingHours[] = [
      // Monday to Sunday: 06:00 to 22:00
      {
        id: 'oh-1',
        venue_id: 'venue-1',
        day_of_week: 1, // Monday
        open_time: '06:00:00',
        close_time: '22:00:00',
        is_closed: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'oh-2',
        venue_id: 'venue-1',
        day_of_week: 2, // Tuesday
        open_time: '06:00:00',
        close_time: '22:00:00',
        is_closed: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'oh-0',
        venue_id: 'venue-1',
        day_of_week: 0, // Sunday - closed
        open_time: null,
        close_time: null,
        is_closed: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    it('returns AVAILABLE when within operating hours and no maintenance blocks exist', () => {
      // 2026-10-05 is a Monday
      const result = checkFacilityAvailability({
        facility: mockFacility,
        venueOperatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        pricingRules: [],
        currency: 'LKR',
        dateStr: '2026-10-05',
        timeStr: '19:00',
        durationMinutes: 60,
      });

      expect(result.status).toBe('AVAILABLE');
      expect(result.is_available).toBe(true);
    });

    it('returns OUTSIDE_OPERATING_HOURS when requested time is after closing time', () => {
      // 2026-10-05 Monday at 23:00 (closes at 22:00)
      const result = checkFacilityAvailability({
        facility: mockFacility,
        venueOperatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        pricingRules: [],
        currency: 'LKR',
        dateStr: '2026-10-05',
        timeStr: '23:00',
        durationMinutes: 60,
      });

      expect(result.status).toBe('OUTSIDE_OPERATING_HOURS');
      expect(result.is_available).toBe(false);
    });

    it('returns OUTSIDE_OPERATING_HOURS when venue is closed on that day', () => {
      // 2026-10-04 is a Sunday (is_closed = true)
      const result = checkFacilityAvailability({
        facility: mockFacility,
        venueOperatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        pricingRules: [],
        currency: 'LKR',
        dateStr: '2026-10-04',
        timeStr: '10:00',
        durationMinutes: 60,
      });

      expect(result.status).toBe('OUTSIDE_OPERATING_HOURS');
      expect(result.is_available).toBe(false);
    });

    it('returns MAINTENANCE when requested slot overlaps an active maintenance block', () => {
      const maintenanceBlocks: MaintenanceBlock[] = [
        {
          id: 'maint-1',
          organization_id: 'org-1',
          venue_id: 'venue-1',
          facility_id: 'fac-badminton-1',
          start_at: '2026-10-05T18:00:00+05:30',
          end_at: '2026-10-05T20:00:00+05:30',
          status: 'ACTIVE',
          reason: 'Court repainting',
          created_by: 'user-1',
          created_at: '2026-10-01',
          updated_at: '2026-10-01',
        },
      ];

      // Requested: 19:00 - 20:00 (overlaps with 18:00 - 20:00)
      const result = checkFacilityAvailability({
        facility: mockFacility,
        venueOperatingHours: mockOperatingHours,
        maintenanceBlocks,
        pricingRules: [],
        currency: 'LKR',
        dateStr: '2026-10-05',
        timeStr: '19:00',
        durationMinutes: 60,
      });

      expect(result.status).toBe('MAINTENANCE');
      expect(result.is_available).toBe(false);
    });

    it('returns AVAILABLE when maintenance is at a different time', () => {
      const maintenanceBlocks: MaintenanceBlock[] = [
        {
          id: 'maint-1',
          organization_id: 'org-1',
          venue_id: 'venue-1',
          facility_id: 'fac-badminton-1',
          start_at: '2026-10-05T08:00:00+05:30',
          end_at: '2026-10-05T10:00:00+05:30',
          status: 'ACTIVE',
          reason: 'Morning cleaning',
          created_by: 'user-1',
          created_at: '2026-10-01',
          updated_at: '2026-10-01',
        },
      ];

      // Requested: 19:00 - 20:00 (no overlap)
      const result = checkFacilityAvailability({
        facility: mockFacility,
        venueOperatingHours: mockOperatingHours,
        maintenanceBlocks,
        pricingRules: [],
        currency: 'LKR',
        dateStr: '2026-10-05',
        timeStr: '19:00',
        durationMinutes: 60,
      });

      expect(result.status).toBe('AVAILABLE');
      expect(result.is_available).toBe(true);
    });

    it('returns NOT_BOOKABLE if facility is_bookable is false', () => {
      const nonBookableFac = { ...mockFacility, is_bookable: false };

      const result = checkFacilityAvailability({
        facility: nonBookableFac,
        venueOperatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        pricingRules: [],
        currency: 'LKR',
        dateStr: '2026-10-05',
        timeStr: '19:00',
        durationMinutes: 60,
      });

      expect(result.status).toBe('NOT_BOOKABLE');
      expect(result.is_available).toBe(false);
    });

    it('returns UNAVAILABLE if facility status is CLOSED or ARCHIVED', () => {
      const closedFac = { ...mockFacility, status: 'CLOSED' as const };

      const result = checkFacilityAvailability({
        facility: closedFac,
        venueOperatingHours: mockOperatingHours,
        maintenanceBlocks: [],
        pricingRules: [],
        currency: 'LKR',
        dateStr: '2026-10-05',
        timeStr: '19:00',
        durationMinutes: 60,
      });

      expect(result.status).toBe('UNAVAILABLE');
      expect(result.is_available).toBe(false);
    });
  });
});
