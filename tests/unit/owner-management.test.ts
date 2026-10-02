import { describe, it, expect } from 'vitest';
import {
  updateOrganizationSchema,
  createVenueInputSchema,
  updateVenueInputSchema,
  assignVenueSportSchema,
  createFacilityInputSchema,
  updateFacilityInputSchema,
  dailyOperatingHourSchema,
  updateOperatingHoursInputSchema,
  createPricingRuleInputSchema,
  updatePricingRuleInputSchema,
  createMaintenanceBlockInputSchema,
  updateMaintenanceBlockInputSchema,
} from '@sportshub/validation';

describe('STEP 4 — Owner Organization & Venue Management Unit Validation Tests', () => {
  // 1. Organization Validation
  describe('Organization Validation Schemas', () => {
    it('accepts valid organization updates', () => {
      const validOrg = {
        name: 'Royal Sports Complex',
        description: 'Premier indoor and outdoor sports facility in Colombo',
        logo_url: 'https://images.example.com/logo.png',
        phone: '+94 11 234 5678',
        email: 'info@royalsports.lk',
        website: 'https://royalsports.lk',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
      };

      const result = updateOrganizationSchema.safeParse(validOrg);
      expect(result.success).toBe(true);
    });

    it('rejects empty organization name', () => {
      const invalid = {
        name: '',
      };
      const result = updateOrganizationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid email formats', () => {
      const invalid = {
        name: 'Test Org',
        email: 'not-a-valid-email',
      };
      const result = updateOrganizationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid website URLs', () => {
      const invalid = {
        name: 'Test Org',
        website: 'ht!tp://invalid url',
      };
      const result = updateOrganizationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // 2. Venue Validation
  describe('Venue Validation Schemas', () => {
    it('accepts valid venue creation payload', () => {
      const validVenue = {
        name: 'Royal Indoor Badminton Arena',
        slug: 'royal-indoor-badminton-arena',
        description: 'Air-conditioned wooden flooring courts',
        address_line_1: 'No. 123, Stadium Walk',
        city: 'Colombo',
        district: 'Colombo District',
        postal_code: '00700',
        latitude: 6.927079,
        longitude: 79.861244,
        phone: '+94 11 987 6543',
        email: 'arena@royalsports.lk',
        status: 'DRAFT',
        timezone: 'Asia/Colombo',
      };

      const result = createVenueInputSchema.safeParse(validVenue);
      expect(result.success).toBe(true);
    });

    it('rejects venue slug with invalid characters or capital letters', () => {
      const invalid = {
        name: 'Badminton Arena',
        slug: 'Badminton Arena with Spaces & CAPS!',
      };
      const result = createVenueInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates latitude and longitude boundaries', () => {
      const invalidLat = {
        name: 'Test Arena',
        slug: 'test-arena',
        latitude: 95.5, // > 90
        longitude: 79.8,
      };
      expect(createVenueInputSchema.safeParse(invalidLat).success).toBe(false);

      const invalidLong = {
        name: 'Test Arena',
        slug: 'test-arena',
        latitude: 6.9,
        longitude: -195.0, // < -180
      };
      expect(createVenueInputSchema.safeParse(invalidLong).success).toBe(false);
    });
  });

  // 3. Sports Assignment
  describe('Venue Sports Assignment Schema', () => {
    it('accepts valid venue sport toggle', () => {
      const valid = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        sport_id: 'e4c07384-d113-466c-946f-5778a8767702',
        is_active: true,
      };
      const result = assignVenueSportSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid uuid in sport assignment', () => {
      const invalid = {
        venue_id: 'invalid-id',
        sport_id: 'invalid-sport-id',
        is_active: true,
      };
      const result = assignVenueSportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // 4. Facilities Validation
  describe('Facility Validation Schemas', () => {
    it('accepts valid facility creation payload', () => {
      const valid = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Badminton Court 01',
        slug: 'badminton-court-01',
        facility_type: 'Yonex Synthetic Mat',
        capacity: 4,
        status: 'AVAILABLE',
        is_bookable: true,
        default_duration_minutes: 60,
        buffer_minutes: 10,
      };
      const result = createFacilityInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects zero or negative capacity', () => {
      const invalid = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Court 1',
        slug: 'court-1',
        capacity: 0,
      };
      expect(createFacilityInputSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects negative buffer minutes', () => {
      const invalid = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Court 1',
        slug: 'court-1',
        buffer_minutes: -5,
      };
      expect(createFacilityInputSchema.safeParse(invalid).success).toBe(false);
    });
  });

  // 5. Operating Hours Validation
  describe('Operating Hours Schemas', () => {
    it('accepts valid open operating schedule with open < close', () => {
      const validDay = {
        day_of_week: 1,
        open_time: '06:00:00',
        close_time: '22:00:00',
        is_closed: false,
      };
      expect(dailyOperatingHourSchema.safeParse(validDay).success).toBe(true);
    });

    it('accepts closed day with null times', () => {
      const closedDay = {
        day_of_week: 0,
        open_time: null,
        close_time: null,
        is_closed: true,
      };
      expect(dailyOperatingHourSchema.safeParse(closedDay).success).toBe(true);
    });

    it('rejects open >= close on active operating day', () => {
      const invalidDay = {
        day_of_week: 2,
        open_time: '22:00:00',
        close_time: '06:00:00', // Overnight not supported in MVP
        is_closed: false,
      };
      expect(dailyOperatingHourSchema.safeParse(invalidDay).success).toBe(false);

      const equalTimes = {
        day_of_week: 3,
        open_time: '10:00:00',
        close_time: '10:00:00',
        is_closed: false,
      };
      expect(dailyOperatingHourSchema.safeParse(equalTimes).success).toBe(false);
    });

    it('validates 7-day schedule array', () => {
      const schedule = Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        open_time: '06:00:00',
        close_time: '22:00:00',
        is_closed: false,
      }));

      const result = updateOperatingHoursInputSchema.safeParse({
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        schedule,
      });

      expect(result.success).toBe(true);
    });
  });

  // 6. Pricing Rules Validation
  describe('Pricing Rules Schemas', () => {
    it('accepts valid base and peak pricing rules', () => {
      const valid = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Peak Hour Badminton',
        pricing_type: 'PEAK',
        day_of_week: 5,
        start_time: '18:00:00',
        end_time: '22:00:00',
        price_per_hour: 2500,
        member_price: 2000,
        priority: 10,
        is_active: true,
      };
      const result = createPricingRuleInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects negative hourly price or negative member price', () => {
      const negativePrice = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Discount',
        pricing_type: 'BASE',
        price_per_hour: -100,
      };
      expect(createPricingRuleInputSchema.safeParse(negativePrice).success).toBe(false);

      const negativeMember = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Discount',
        pricing_type: 'BASE',
        price_per_hour: 1500,
        member_price: -50,
      };
      expect(createPricingRuleInputSchema.safeParse(negativeMember).success).toBe(false);
    });

    it('rejects start_time >= end_time on pricing rule window', () => {
      const invalidWindow = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Evening Special',
        pricing_type: 'PEAK',
        start_time: '20:00:00',
        end_time: '18:00:00',
        price_per_hour: 2000,
      };
      expect(createPricingRuleInputSchema.safeParse(invalidWindow).success).toBe(false);
    });

    it('rejects valid_from > valid_until date ranges', () => {
      const invalidDates = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        name: 'Holiday Tier',
        pricing_type: 'HOLIDAY',
        price_per_hour: 3000,
        valid_from: '2026-12-31',
        valid_until: '2026-01-01',
      };
      expect(createPricingRuleInputSchema.safeParse(invalidDates).success).toBe(false);
    });
  });

  // 7. Maintenance Blocks Validation
  describe('Maintenance Blocks Schemas', () => {
    it('accepts valid maintenance downtime block', () => {
      const valid = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        facility_id: 'e4c07384-d113-466c-946f-5778a8767702',
        start_at: '2026-10-10T08:00:00Z',
        end_at: '2026-10-10T14:00:00Z',
        reason: 'Synthetic turf replacement',
        status: 'ACTIVE',
      };
      const result = createMaintenanceBlockInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects start_at >= end_at for maintenance intervals', () => {
      const invalid = {
        venue_id: 'd3b07384-d113-466c-946f-5778a8767701',
        facility_id: 'e4c07384-d113-466c-946f-5778a8767702',
        start_at: '2026-10-10T14:00:00Z',
        end_at: '2026-10-10T08:00:00Z',
      };
      expect(createMaintenanceBlockInputSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
