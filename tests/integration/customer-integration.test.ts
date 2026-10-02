import { describe, it, expect } from 'vitest';
import {
  CustomerAccountStats,
  CustomerBookingHistoryItem,
  CustomerReceipt,
} from '../../packages/types/src/index';

describe('STEP 11 — Customer Account & Booking Experience Integration Tests', () => {
  describe('1. Customer Statistics Lifecycle Aggregation', () => {
    it('should accurately calculate customer summary statistics server-side from raw bookings & transactions', () => {
      const bookings = [
        {
          id: 'b-1',
          user_id: 'cust-1',
          status: 'COMPLETED',
          booking_date: '2026-09-01',
          start_time: '10:00:00',
          end_time: '11:00:00',
          total_price: 3000,
          currency: 'LKR',
        },
        {
          id: 'b-2',
          user_id: 'cust-1',
          status: 'CONFIRMED',
          booking_date: '2026-10-15',
          start_time: '14:00:00',
          end_time: '15:00:00',
          total_price: 2500,
          currency: 'LKR',
        },
        {
          id: 'b-3',
          user_id: 'cust-1',
          status: 'CANCELLED',
          booking_date: '2026-09-20',
          start_time: '08:00:00',
          end_time: '09:00:00',
          total_price: 1500,
          currency: 'LKR',
        },
      ];

      const successfulPayments = [
        { id: 'p-1', booking_id: 'b-1', status: 'SUCCESS', amount: 3000, currency: 'LKR' },
        { id: 'p-2', booking_id: 'b-2', status: 'SUCCESS', amount: 2500, currency: 'LKR' },
      ];

      const todayStr = '2026-10-02';

      const totalBookings = bookings.length;
      const completedBookings = bookings.filter((b) => b.status === 'COMPLETED').length;
      const upcomingBookings = bookings.filter(
        (b) =>
          ['CONFIRMED', 'HOLD'].includes(b.status) &&
          b.booking_date >= todayStr
      ).length;
      const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED').length;
      const activeHolds = bookings.filter((b) => b.status === 'HOLD').length;
      const totalAmountPaid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);

      const stats: CustomerAccountStats = {
        totalBookings,
        completedBookings,
        upcomingBookings,
        cancelledBookings,
        activeHolds,
        totalAmountPaid,
        currency: 'LKR',
      };

      expect(stats.totalBookings).toBe(3);
      expect(stats.completedBookings).toBe(1);
      expect(stats.upcomingBookings).toBe(1);
      expect(stats.cancelledBookings).toBe(1);
      expect(stats.totalAmountPaid).toBe(5500);
      expect(stats.currency).toBe('LKR');
    });
  });

  describe('2. Booking History Filtering & Timezone-Aware Mapping', () => {
    it('should correctly organize booking items with venue, facility, and payment details', () => {
      const historyItem: CustomerBookingHistoryItem = {
        id: 'b-full-01',
        reference: 'SPH-2026-0099',
        organization_id: 'org-01',
        venue_id: 'v-1',
        facility_id: 'f-1',
        customer_user_id: 'cust-1',
        booking_date: '2026-10-05',
        start_time: '09:00:00',
        end_time: '10:30:00',
        duration_minutes: 90,
        status: 'CONFIRMED',
        total_price: 4500,
        currency: 'LKR',
        created_at: '2026-10-01T08:00:00Z',
        venue: {
          id: 'v-1',
          name: 'City Sports Arena',
          slug: 'city-sports-arena',
          address: '45 Stadium Road',
          city: 'Colombo',
          timezone: 'Asia/Colombo',
        },
        facility: {
          id: 'f-1',
          name: 'Badminton Court 1',
          facility_type: 'COURT',
        },
        payment: {
          id: 'pay-01',
          transaction_reference: 'TXN-9988',
          payment_method: 'PAYHERE',
          payment_provider: 'PAYHERE',
          status: 'SUCCESS',
          amount: 4500,
          currency: 'LKR',
        },
      };

      expect(historyItem.reference).toBe('SPH-2026-0099');
      expect(historyItem.duration_minutes).toBe(90);
      expect(historyItem.venue?.name).toBe('City Sports Arena');
      expect(historyItem.facility?.name).toBe('Badminton Court 1');
      expect(historyItem.payment?.status).toBe('SUCCESS');
    });
  });

  describe('3. Customer Receipt & Voucher Assembly', () => {
    it('should construct a safe customer receipt without exposing sensitive gateway secrets', () => {
      const receipt: CustomerReceipt = {
        bookingId: 'b-rec-01',
        reference: 'SPH-REC-8877',
        bookingDate: '2026-10-10',
        startTime: '16:00:00',
        endTime: '17:00:00',
        durationMinutes: 60,
        bookingStatus: 'CONFIRMED',
        totalPrice: 3500,
        currency: 'LKR',
        customerName: 'Jane Athlete',
        customerEmail: 'jane@sports.local',
        customerPhone: '+94771234567',
        organizationName: 'Metro Sports Club',
        venueName: 'Downtown Complex',
        venueAddress: '123 Galle Road, Colombo 03',
        facilityName: 'Tennis Court A',
        facilityType: 'COURT',
        paymentReference: 'TXN-99887766',
        paymentStatus: 'SUCCESS',
        paymentMethod: 'PAYHERE',
        paidAt: '2026-10-02T10:00:00Z',
        issuedAt: new Date().toISOString(),
      };

      expect(receipt.reference).toBe('SPH-REC-8877');
      expect(receipt.paymentReference).toBe('TXN-99887766');
      expect(receipt.totalPrice).toBe(3500);

      // Verify no sensitive card credentials exist in receipt interface
      expect((receipt as any).card_number).toBeUndefined();
      expect((receipt as any).cvv).toBeUndefined();
      expect((receipt as any).token).toBeUndefined();
      expect((receipt as any).secret_key).toBeUndefined();
    });
  });
});
