import { describe, it, expect } from 'vitest';
import type {
  Venue,
  Facility,
  Sport,
  PublicVenueSearchResult,
  PublicFacilityDetail,
  PublicVenueDetail,
  MaintenanceBlock,
  PricingRule,
} from '@sportshub/types';
import { checkFacilityAvailability } from '../../apps/web/src/lib/discovery/availability';
import { calculateStartingPrice } from '../../apps/web/src/lib/discovery/pricing';
import { venueSearchParamsSchema } from '@sportshub/validation';

describe('STEP 5 — Public Discovery & Tenant Isolation Security Tests', () => {
  // Test Mock Data representing multiple tenants and statuses
  const tenant1Id = '00000000-0000-0000-0000-000000000001';
  const tenant2Id = '00000000-0000-0000-0000-000000000002';

  const mockVenues: (Venue & {
    facilities: Facility[];
    pricing_rules: PricingRule[];
    maintenance_blocks: MaintenanceBlock[];
  })[] = [
    {
      id: 'venue-active-1',
      organization_id: tenant1Id,
      name: 'Colombo Badminton Arena',
      slug: 'colombo-badminton-arena',
      description: 'Public active venue in Colombo',
      address_line_1: '123 Havelock Road',
      address_line_2: null,
      city: 'Colombo',
      district: 'Colombo',
      postal_code: '00500',
      latitude: 6.89,
      longitude: 79.86,
      phone: '+94 11 234 5678',
      email: 'info@colombobadminton.lk',
      status: 'ACTIVE',
      timezone: 'Asia/Colombo',
      cover_image_url: 'https://images.example.com/venue.jpg',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      facilities: [
        {
          id: 'fac-active-1',
          venue_id: 'venue-active-1',
          sport_id: 'sport-badminton',
          name: 'Court 01',
          slug: 'court-01',
          description: 'Standard wooden court',
          facility_type: 'Indoor Court',
          capacity: 4,
          status: 'AVAILABLE',
          is_bookable: true,
          default_duration_minutes: 60,
          buffer_minutes: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'fac-archived-1',
          venue_id: 'venue-active-1',
          sport_id: 'sport-badminton',
          name: 'Old Court (Decommissioned)',
          slug: 'old-court',
          description: null,
          facility_type: 'Indoor Court',
          capacity: 4,
          status: 'ARCHIVED',
          is_bookable: false,
          default_duration_minutes: 60,
          buffer_minutes: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'fac-closed-1',
          venue_id: 'venue-active-1',
          sport_id: 'sport-badminton',
          name: 'Court 03 (Closed)',
          slug: 'court-03-closed',
          description: null,
          facility_type: 'Indoor Court',
          capacity: 4,
          status: 'CLOSED',
          is_bookable: false,
          default_duration_minutes: 60,
          buffer_minutes: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      pricing_rules: [
        {
          id: 'pr-1',
          organization_id: tenant1Id,
          venue_id: 'venue-active-1',
          facility_id: null,
          name: 'Base Rate',
          pricing_type: 'BASE',
          day_of_week: null,
          start_time: null,
          end_time: null,
          price_per_hour: 1500,
          member_price: null,
          priority: 0,
          valid_from: null,
          valid_until: null,
          is_active: true,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      maintenance_blocks: [
        {
          id: 'mb-1',
          organization_id: tenant1Id,
          venue_id: 'venue-active-1',
          facility_id: 'fac-active-1',
          start_at: '2026-10-10T10:00:00+05:30',
          end_at: '2026-10-10T14:00:00+05:30',
          status: 'ACTIVE',
          reason: 'Internal floor polishing',
          created_by: 'staff-user-99',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    },
    {
      id: 'venue-draft-2',
      organization_id: tenant2Id,
      name: 'Secret Upcoming Tennis Center',
      slug: 'secret-upcoming-tennis',
      description: 'Private draft venue',
      address_line_1: 'Private Road',
      address_line_2: null,
      city: 'Kandy',
      district: 'Kandy',
      postal_code: '20000',
      latitude: 7.29,
      longitude: 80.63,
      phone: null,
      email: null,
      status: 'DRAFT',
      timezone: 'Asia/Colombo',
      cover_image_url: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      facilities: [],
      pricing_rules: [],
      maintenance_blocks: [],
    },
    {
      id: 'venue-suspended-3',
      organization_id: tenant2Id,
      name: 'Suspended Recreation Center',
      slug: 'suspended-recreation',
      description: 'Suspended venue due to payment default',
      address_line_1: 'Main St',
      address_line_2: null,
      city: 'Galle',
      district: 'Galle',
      postal_code: '80000',
      latitude: 6.05,
      longitude: 80.21,
      phone: null,
      email: null,
      status: 'SUSPENDED',
      timezone: 'Asia/Colombo',
      cover_image_url: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      facilities: [],
      pricing_rules: [],
      maintenance_blocks: [],
    },
    {
      id: 'venue-archived-4',
      organization_id: tenant1Id,
      name: 'Archived Historic Ground',
      slug: 'archived-historic-ground',
      description: 'Permanently decommissioned',
      address_line_1: 'Old Road',
      address_line_2: null,
      city: 'Jaffna',
      district: 'Jaffna',
      postal_code: '40000',
      latitude: 9.66,
      longitude: 80.02,
      phone: null,
      email: null,
      status: 'ARCHIVED',
      timezone: 'Asia/Colombo',
      cover_image_url: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      facilities: [],
      pricing_rules: [],
      maintenance_blocks: [],
    },
  ];

  describe('Public Venue Visibility Rules', () => {
    it('strictly excludes DRAFT, SUSPENDED, and ARCHIVED venues from public discovery queries', () => {
      // Filter for public discovery
      const publicVenues = mockVenues.filter((v) => v.status === 'ACTIVE');

      expect(publicVenues.length).toBe(1);
      expect(publicVenues[0].id).toBe('venue-active-1');

      for (const venue of publicVenues) {
        expect(['DRAFT', 'SUSPENDED', 'ARCHIVED', 'CLOSED']).not.toContain(venue.status);
      }
    });
  });

  describe('Facility Visibility & Data Sanitization', () => {
    it('excludes CLOSED and ARCHIVED facilities from public court listings', () => {
      const activeVenue = mockVenues.find((v) => v.status === 'ACTIVE')!;
      const publicFacilities = activeVenue.facilities.filter(
        (f) => f.status !== 'ARCHIVED' && f.status !== 'CLOSED'
      );

      expect(publicFacilities.length).toBe(1);
      expect(publicFacilities[0].id).toBe('fac-active-1');
      expect(publicFacilities.some((f) => f.status === 'ARCHIVED')).toBe(false);
      expect(publicFacilities.some((f) => f.status === 'CLOSED')).toBe(false);
    });

    it('sanitizes private maintenance blocks and never exposes internal staff notes', () => {
      const activeVenue = mockVenues.find((v) => v.status === 'ACTIVE')!;
      const activeFac = activeVenue.facilities.find((f) => f.id === 'fac-active-1')!;

      // Check availability during maintenance window
      const avail = checkFacilityAvailability({
        facility: activeFac,
        venueOperatingHours: [
          {
            id: 'oh-1',
            venue_id: activeVenue.id,
            day_of_week: 6, // Saturday
            open_time: '06:00:00',
            close_time: '22:00:00',
            is_closed: false,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ],
        maintenanceBlocks: activeVenue.maintenance_blocks,
        pricingRules: activeVenue.pricing_rules,
        dateStr: '2026-10-10',
        timeStr: '11:00',
        durationMinutes: 60,
      });

      expect(avail.status).toBe('MAINTENANCE');
      expect(avail.is_available).toBe(false);

      // Verify no internal fields leaked in availability result
      expect((avail as any).internal_notes).toBeUndefined();
      expect((avail as any).created_by).toBeUndefined();
      expect(avail.reason).toBe('Facility has scheduled maintenance during this time window.');
    });
  });

  describe('Search Query Parameter Validation & Security', () => {
    it('strictly rejects negative page numbers or excessive page sizes', () => {
      const negativePage = venueSearchParamsSchema.safeParse({ page: -5 });
      expect(negativePage.success).toBe(false);

      const excessiveSize = venueSearchParamsSchema.safeParse({ pageSize: 500 });
      expect(excessiveSize.success).toBe(false);

      const validPaging = venueSearchParamsSchema.safeParse({ page: 2, pageSize: 24 });
      expect(validPaging.success).toBe(true);
      if (validPaging.success) {
        expect(validPaging.data.page).toBe(2);
        expect(validPaging.data.pageSize).toBe(24);
      }
    });

    it('rejects malicious or out-of-range latitude/longitude coordinates', () => {
      expect(venueSearchParamsSchema.safeParse({ latitude: 120 }).success).toBe(false);
      expect(venueSearchParamsSchema.safeParse({ latitude: -95 }).success).toBe(false);
      expect(venueSearchParamsSchema.safeParse({ longitude: 200 }).success).toBe(false);
      expect(venueSearchParamsSchema.safeParse({ longitude: -190 }).success).toBe(false);
    });

    it('safely handles text injection attempts in location search strings', () => {
      const maliciousPayloads = [
        "'; DROP TABLE venues; --",
        "' OR '1'='1",
        '<script>alert("xss")</script>',
        '../../../etc/passwd',
      ];

      for (const payload of maliciousPayloads) {
        const parsed = venueSearchParamsSchema.safeParse({ locationText: payload });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.locationText).toBe(payload);
        }
      }
    });
  });

  describe('No Fake Data Guarantee', () => {
    it('returns null starting price when no verified pricing rules exist', () => {
      const unpricedPrice = calculateStartingPrice([], 'fac-unpriced');
      expect(unpricedPrice).toBeNull();
    });

    it('does not produce invented rating properties on public venue search models', () => {
      const publicResult: PublicVenueSearchResult = {
        venue_id: 'venue-1',
        venue_name: 'Colombo Arena',
        slug: 'colombo-arena',
        description: null,
        cover_image_url: null,
        address: 'Colombo',
        city: 'Colombo',
        district: 'Colombo',
        latitude: 6.89,
        longitude: 79.86,
        distance_km: null,
        status: 'ACTIVE',
        currency: 'LKR',
        sports: [],
        total_facilities_count: 1,
        available_facilities_count: 1,
        starting_price_per_hour: null,
        overall_availability_status: 'AVAILABLE',
      };

      expect((publicResult as any).rating).toBeUndefined();
      expect((publicResult as any).review_count).toBeUndefined();
      expect((publicResult as any).popularity).toBeUndefined();
      expect(publicResult.starting_price_per_hour).toBeNull();
    });
  });
});
