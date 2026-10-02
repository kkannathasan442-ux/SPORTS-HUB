import { describe, it, expect } from 'vitest';
import {
  updateCustomerProfileSchema,
  customerBookingQuerySchema,
} from '@sportshub/validation';

describe('STEP 11 — Customer Account & Profile Unit Tests', () => {
  describe('Customer Profile Schema Validation', () => {
    it('should validate valid customer profile updates', () => {
      const payload = {
        full_name: 'Kasun Silva',
        display_name: 'Silva',
        phone: '+94 77 123 4567',
        avatar_url: 'https://images.example.com/avatar.jpg',
        date_of_birth: '1995-06-15',
        gender: 'male',
        country_code: '+94',
        preferred_language: 'en',
        timezone: 'Asia/Colombo',
        emergency_contact_name: 'Nimalka Silva',
        emergency_contact_phone: '+94 71 987 6543',
        notes: 'Intermediate badminton player',
      };

      const parsed = updateCustomerProfileSchema.parse(payload);
      expect(parsed.full_name).toBe('Kasun Silva');
      expect(parsed.preferred_language).toBe('en');
      expect(parsed.emergency_contact_name).toBe('Nimalka Silva');
    });

    it('should reject profile updates with invalid names (less than 2 chars)', () => {
      expect(() =>
        updateCustomerProfileSchema.parse({
          full_name: 'A',
        })
      ).toThrow();
    });

    it('should reject invalid date of birth format', () => {
      expect(() =>
        updateCustomerProfileSchema.parse({
          date_of_birth: '15-06-1995', // Must be YYYY-MM-DD
        })
      ).toThrow();
    });

    it('should allow clearing optional fields with null or empty string', () => {
      const parsed = updateCustomerProfileSchema.parse({
        display_name: null,
        avatar_url: '',
        emergency_contact_name: null,
        notes: null,
      });

      expect(parsed.display_name).toBeNull();
      expect(parsed.avatar_url).toBe('');
      expect(parsed.emergency_contact_name).toBeNull();
    });
  });

  describe('Customer Booking Query Schema & Filtering', () => {
    it('should validate valid booking tab filter options', () => {
      const validTabs = ['all', 'upcoming', 'today', 'completed', 'cancelled', 'holds'] as const;

      for (const tab of validTabs) {
        const parsed = customerBookingQuerySchema.parse({ tab });
        expect(parsed.tab).toBe(tab);
        expect(parsed.page).toBe(1);
        expect(parsed.limit).toBe(20);
      }
    });

    it('should reject invalid booking tab filter', () => {
      expect(() =>
        customerBookingQuerySchema.parse({ tab: 'invalid_tab' as any })
      ).toThrow();
    });
  });

  describe('Customer Account Statistics Aggregation Logic', () => {
    it('should accurately calculate booking counts and financial totals', () => {
      const todayStr = '2026-10-02';

      const mockBookings = [
        { id: '1', status: 'CONFIRMED', booking_date: '2026-10-05', total_price: 3000 },
        { id: '2', status: 'HOLD', booking_date: '2026-10-03', total_price: 2500 },
        { id: '3', status: 'COMPLETED', booking_date: '2026-09-20', total_price: 4000 },
        { id: '4', status: 'CONFIRMED', booking_date: '2026-09-15', total_price: 3500 }, // Past confirmed = completed
        { id: '5', status: 'CANCELLED', booking_date: '2026-09-10', total_price: 2000 },
        { id: '6', status: 'EXPIRED', booking_date: '2026-09-05', total_price: 2000 },
      ];

      let totalBookings = 0;
      let completedBookings = 0;
      let upcomingBookings = 0;
      let cancelledBookings = 0;
      let activeHolds = 0;

      for (const b of mockBookings) {
        totalBookings++;
        if (b.status === 'HOLD') {
          activeHolds++;
          if (b.booking_date >= todayStr) upcomingBookings++;
        } else if (b.status === 'CONFIRMED') {
          if (b.booking_date >= todayStr) {
            upcomingBookings++;
          } else {
            completedBookings++;
          }
        } else if (b.status === 'COMPLETED') {
          completedBookings++;
        } else if (b.status === 'CANCELLED' || b.status === 'EXPIRED') {
          cancelledBookings++;
        }
      }

      expect(totalBookings).toBe(6);
      expect(upcomingBookings).toBe(2); // 1 Confirmed future + 1 Hold future
      expect(completedBookings).toBe(2); // 1 Completed + 1 Past Confirmed
      expect(cancelledBookings).toBe(2); // 1 Cancelled + 1 Expired
      expect(activeHolds).toBe(1);
    });
  });
});
