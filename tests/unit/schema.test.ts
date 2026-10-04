import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  organizationSchema,
  venueSchema,
  sportSchema,
  facilitySchema,
  venueOperatingHoursSchema,
  pricingRuleSchema,
  maintenanceBlockSchema,
  profileSchema,
  customerProfileSchema,
} from '@sportshub/validation';

describe('Database Schema & Migration Validation — STEP 2', () => {
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  const seedFilePath = path.resolve(__dirname, '../../supabase/seed/seed.sql');

  const expectedMigrations = [
    '20261001000001_extensions.sql',
    '20261001000002_enums.sql',
    '20261001000003_profiles.sql',
    '20261001000004_organizations.sql',
    '20261001000005_organization_members.sql',
    '20261001000006_venues.sql',
    '20261001000007_sports.sql',
    '20261001000008_venue_sports.sql',
    '20261001000009_facilities.sql',
    '20261001000010_venue_operating_hours.sql',
    '20261001000011_pricing_rules.sql',
    '20261001000012_maintenance_blocks.sql',
    '20261001000013_customer_profiles.sql',
    '20261001000014_core_indexes.sql',
    '20261001000015_auth_profile_sync.sql',
    '20261001000016_rls_helpers_and_policies.sql',
    '20261001000017_bookings.sql',
    '20261001000018_booking_rpc.sql',
    '20261001000019_payments.sql',
    '20261001000020_notifications.sql',
    '20261001000021_reporting_indexes.sql',
    '20261001000022_organization_settings_and_audit_logs.sql',
    '20261001000023_booking_operations.sql',
    '20261001000024_teams_and_rosters.sql',
    '20261001000025_matches.sql',
  ];

  describe('Migration Files Structure & Ordering', () => {
    it('should have all 25 core migration files present in correct order', () => {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      expect(files).toEqual(expectedMigrations);
    });

    it('should verify all required tables are created in migrations', () => {
      const allMigrationsContent = expectedMigrations
        .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'))
        .join('\n');

      const requiredTables = [
        'profiles',
        'organizations',
        'organization_members',
        'venues',
        'sports',
        'venue_sports',
        'facilities',
        'venue_operating_hours',
        'pricing_rules',
        'maintenance_blocks',
        'customer_profiles',
        'teams',
        'team_members',
        'team_invitations',
      ];

      for (const table of requiredTables) {
        const regex = new RegExp(`CREATE\\s+TABLE\\s+public\\.${table}\\s*\\(`, 'i');
        expect(allMigrationsContent).toMatch(regex);
      }
    });

    it('should verify all required enums are created in migrations', () => {
      const enumsMigration = fs.readFileSync(
        path.join(migrationsDir, '20261001000002_enums.sql'),
        'utf-8'
      );
      const teamsMigration = fs.readFileSync(
        path.join(migrationsDir, '20261001000024_teams_and_rosters.sql'),
        'utf-8'
      );

      const requiredEnums = [
        'organization_status',
        'member_status',
        'app_role',
        'venue_status',
        'facility_status',
        'pricing_type',
        'maintenance_block_status',
      ];

      for (const enumName of requiredEnums) {
        expect(enumsMigration).toContain(`CREATE TYPE public.${enumName} AS ENUM`);
      }

      const teamEnums = ['team_role', 'team_invite_status'];
      for (const enumName of teamEnums) {
        expect(teamsMigration).toContain(`CREATE TYPE public.${enumName} AS ENUM`);
      }
    });

    it('should verify multi-tenant composite foreign keys exist for relational integrity', () => {
      const pricingMigration = fs.readFileSync(
        path.join(migrationsDir, '20261001000011_pricing_rules.sql'),
        'utf-8'
      );
      const maintenanceMigration = fs.readFileSync(
        path.join(migrationsDir, '20261001000012_maintenance_blocks.sql'),
        'utf-8'
      );

      // Verify composite FK linking venue_id and organization_id
      expect(pricingMigration).toContain('REFERENCES public.venues(id, organization_id)');
      expect(maintenanceMigration).toContain('REFERENCES public.venues(id, organization_id)');

      // Verify composite FK linking facility_id and venue_id
      expect(pricingMigration).toContain('REFERENCES public.facilities(id, venue_id)');
      expect(maintenanceMigration).toContain('REFERENCES public.facilities(id, venue_id)');
    });
  });

  describe('Seed File Structure', () => {
    it('should have seed.sql containing the initial 6 sports and demo organization', () => {
      expect(fs.existsSync(seedFilePath)).toBe(true);
      const seedContent = fs.readFileSync(seedFilePath, 'utf-8');

      // Check sports seed
      expect(seedContent).toContain('Cricket');
      expect(seedContent).toContain('Badminton');
      expect(seedContent).toContain('Basketball');
      expect(seedContent).toContain('Table Tennis');
      expect(seedContent).toContain('Chess');
      expect(seedContent).toContain('Carrom');

      // Check demo organization and venue
      expect(seedContent).toContain('Demo Sports Group');
      expect(seedContent).toContain('demo-sports-group');
      expect(seedContent).toContain('Demo Sports Arena');
      expect(seedContent).toContain('demo-sports-arena');

      // Check demo facilities
      expect(seedContent).toContain('Cricket Turf 01');
      expect(seedContent).toContain('Badminton Court 01');
      expect(seedContent).toContain('Badminton Court 02');
      expect(seedContent).toContain('Basketball Court 01');
      expect(seedContent).toContain('Table Tennis Table 01');
      expect(seedContent).toContain('Chess Room');
      expect(seedContent).toContain('Carrom Room');
    });
  });

  describe('Model Validation Schemas', () => {
    it('should validate organization data and reject invalid slugs', () => {
      const validOrg = {
        name: 'Colombo Sports Academy',
        slug: 'colombo-sports-academy',
        status: 'ACTIVE' as const,
        currency: 'LKR',
        timezone: 'Asia/Colombo',
      };
      expect(organizationSchema.safeParse(validOrg).success).toBe(true);

      const invalidSlugOrg = {
        name: 'Colombo Sports Academy',
        slug: 'INVALID SLUG WITH SPACES',
      };
      expect(organizationSchema.safeParse(invalidSlugOrg).success).toBe(false);
    });

    it('should validate venue coordinates and geographic limits', () => {
      const validVenue = {
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Royal Sports Arena',
        slug: 'royal-sports-arena',
        latitude: 6.9271,
        longitude: 79.8612,
        status: 'ACTIVE' as const,
      };
      expect(venueSchema.safeParse(validVenue).success).toBe(true);

      const invalidLatitudeVenue = {
        ...validVenue,
        latitude: 105.0, // Exceeds 90
      };
      expect(venueSchema.safeParse(invalidLatitudeVenue).success).toBe(false);
    });

    it('should validate facility duration and capacity rules', () => {
      const validFacility = {
        venue_id: 'b0000000-0000-0000-0000-000000000001',
        name: 'Court 1',
        slug: 'court-1',
        capacity: 4,
        default_duration_minutes: 60,
        buffer_minutes: 10,
        status: 'AVAILABLE' as const,
      };
      expect(facilitySchema.safeParse(validFacility).success).toBe(true);

      const invalidCapacity = {
        ...validFacility,
        capacity: -2,
      };
      expect(facilitySchema.safeParse(invalidCapacity).success).toBe(false);
    });

    it('should validate pricing rules with non-negative prices and time ranges', () => {
      const validRule = {
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        venue_id: 'b0000000-0000-0000-0000-000000000001',
        name: 'Peak Hour Rate',
        pricing_type: 'PEAK' as const,
        price_per_hour: 2500,
        member_price: 2000,
        start_time: '18:00:00',
        end_time: '22:00:00',
        priority: 1,
      };
      expect(pricingRuleSchema.safeParse(validRule).success).toBe(true);

      const negativePrice = {
        ...validRule,
        price_per_hour: -100,
      };
      expect(pricingRuleSchema.safeParse(negativePrice).success).toBe(false);
    });
  });
});
