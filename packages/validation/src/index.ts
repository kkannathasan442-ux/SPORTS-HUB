/**
 * @sportshub/validation
 * Shared Zod validation schemas for SportsHub platform
 */

import { z } from 'zod';

// Foundation Health & System Schemas
export const systemStatusSchema = z.enum(['OK', 'DEGRADED', 'MAINTENANCE']);

export const supabaseHealthSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  status: z.enum(['connected', 'not_configured', 'disconnected']),
  message: z.string(),
  latencyMs: z.number().optional(),
});

export const healthCheckSchema = z.object({
  status: systemStatusSchema,
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  service: z.string().min(1),
  environment: z.string().min(1),
  supabase: supabaseHealthSchema.optional(),
});

export const sportTypeSchema = z.enum([
  'cricket',
  'badminton',
  'basketball',
  'table_tennis',
  'chess',
  'carrom',
]);

// Backward-compatible user role schema
export const userRoleSchema = z.enum([
  'customer',
  'venue_owner',
  'manager',
  'receptionist',
  'scorer',
  'coach',
  'super_admin',
  'public_user',
]);

export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Environment Schemas
export const supabasePublicEnvSchema = z.object({
  url: z.string().url('Supabase URL must be a valid HTTP or HTTPS URL'),
  anonKey: z.string().min(1, 'Supabase anon/publishable key cannot be empty'),
});

export const supabaseServerEnvSchema = z.object({
  url: z.string().url('Supabase URL must be a valid HTTP or HTTPS URL'),
  serviceRoleKey: z.string().min(1, 'Supabase service-role key cannot be empty'),
});

// ============================================================================
// STEP 2 — Core Database Controlled Enums (Zod)
// ============================================================================

export const organizationStatusSchema = z.enum([
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
]);

export const memberStatusSchema = z.enum([
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'REMOVED',
]);

export const appRoleSchema = z.enum([
  'SUPER_ADMIN',
  'OWNER',
  'MANAGER',
  'RECEPTIONIST',
  'SCORER',
  'COACH',
  'CUSTOMER',
  'PLAYER',
]);

export const venueStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'ARCHIVED',
]);

export const facilityStatusSchema = z.enum([
  'AVAILABLE',
  'MAINTENANCE',
  'BLOCKED',
  'CLOSED',
  'ARCHIVED',
]);

export const pricingTypeSchema = z.enum([
  'BASE',
  'PEAK',
  'OFF_PEAK',
  'MEMBER',
  'WEEKEND',
  'HOLIDAY',
  'CUSTOM',
]);

export const maintenanceBlockStatusSchema = z.enum([
  'ACTIVE',
  'CANCELLED',
  'COMPLETED',
]);

// Regex for URL-friendly slugs
export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ============================================================================
// STEP 2 — Entity Validation Schemas
// ============================================================================

export const profileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1, 'Full name cannot be empty').trim(),
  display_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  country_code: z.string().default('+94'),
  preferred_language: z.string().default('en'),
  timezone: z.string().default('Asia/Colombo'),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const organizationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Organization name cannot be empty').trim(),
  slug: z.string().min(1).regex(slugRegex, 'Slug must be lower-case alphanumeric with hyphens'),
  description: z.string().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().url().nullable().optional(),
  status: organizationStatusSchema.default('PENDING'),
  currency: z.string().length(3).default('LKR'),
  timezone: z.string().default('Asia/Colombo'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const venueSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  name: z.string().min(1, 'Venue name cannot be empty').trim(),
  slug: z.string().min(1).regex(slugRegex, 'Slug must be lower-case alphanumeric with hyphens'),
  description: z.string().nullable().optional(),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  status: venueStatusSchema.default('DRAFT'),
  timezone: z.string().default('Asia/Colombo'),
  cover_image_url: z.string().url().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const sportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Sport name cannot be empty').trim(),
  slug: z.string().min(1).regex(slugRegex, 'Slug must be lower-case alphanumeric with hyphens'),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true),
  supports_booking: z.boolean().default(true),
  supports_team: z.boolean().default(true),
  supports_tournament: z.boolean().default(true),
  supports_live_scoring: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const facilitySchema = z.object({
  id: z.string().uuid().optional(),
  venue_id: z.string().uuid(),
  sport_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Facility name cannot be empty').trim(),
  slug: z.string().min(1).regex(slugRegex, 'Slug must be lower-case alphanumeric with hyphens'),
  description: z.string().nullable().optional(),
  facility_type: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: facilityStatusSchema.default('AVAILABLE'),
  is_bookable: z.boolean().default(true),
  default_duration_minutes: z.number().int().positive().default(60),
  buffer_minutes: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const venueOperatingHoursSchema = z.object({
  id: z.string().uuid().optional(),
  venue_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string().nullable().optional(),
  close_time: z.string().nullable().optional(),
  is_closed: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const pricingRuleSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  facility_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Pricing rule name cannot be empty').trim(),
  pricing_type: pricingTypeSchema,
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  price_per_hour: z.number().nonnegative(),
  member_price: z.number().nonnegative().nullable().optional(),
  priority: z.number().int().nonnegative().default(0),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const maintenanceBlockSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  facility_id: z.string().uuid(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  reason: z.string().nullable().optional(),
  status: maintenanceBlockStatusSchema.default('ACTIVE'),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const customerProfileSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

// ============================================================================
// STEP 3 — Authentication & Registration Schemas
// ============================================================================

export const loginSchema = z.object({
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.string().email('Please enter a valid email address')
  ),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const customerRegistrationSchema = z
  .object({
    fullName: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim() : val),
      z.string().min(1, 'Full name is required')
    ),
    email: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
      z.string().email('Please enter a valid email address')
    ),
    phone: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.string().optional()
    ),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const ownerRegistrationSchema = z
  .object({
    fullName: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim() : val),
      z.string().min(1, 'Full name is required')
    ),
    email: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
      z.string().email('Please enter a valid email address')
    ),
    phone: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.string().optional()
    ),
    organizationName: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim() : val),
      z.string().min(1, 'Organization name is required')
    ),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const activeOrgSelectionSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
});

// ============================================================================
// STEP 4 — Owner Organization & Venue Management Schemas
// ============================================================================

export const updateOrganizationSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, 'Organization name is required')
  ),
  description: z.string().nullable().optional(),
  logo_url: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
    z.string().url('Must be a valid URL').nullable().optional()
  ),
  phone: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
    z.string().nullable().optional()
  ),
  email: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim().toLowerCase() : null),
    z.string().email('Must be a valid email address').nullable().optional()
  ),
  website: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
    z.string().url('Must be a valid website URL').nullable().optional()
  ),
  currency: z.string().length(3, 'Currency must be a 3-letter code (e.g. LKR)').default('LKR'),
  timezone: z.string().min(1, 'Timezone is required').default('Asia/Colombo'),
});

export const createVenueInputSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, 'Venue name is required')
  ),
  slug: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.string().min(1, 'Slug is required').regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens')
  ),
  description: z.string().nullable().optional(),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  latitude: z.preprocess(
    (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : null),
    z.number().min(-90).max(90).nullable().optional()
  ),
  longitude: z.preprocess(
    (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : null),
    z.number().min(-180).max(180).nullable().optional()
  ),
  phone: z.string().nullable().optional(),
  email: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim().toLowerCase() : null),
    z.string().email('Must be a valid email').nullable().optional()
  ),
  status: venueStatusSchema.default('DRAFT'),
  timezone: z.string().default('Asia/Colombo'),
  cover_image_url: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
    z.string().url('Must be a valid image URL').nullable().optional()
  ),
});

export const updateVenueInputSchema = createVenueInputSchema.partial().extend({
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, 'Venue name is required')
  ),
});

export const assignVenueSportSchema = z.object({
  venue_id: z.string().uuid('Invalid venue ID'),
  sport_id: z.string().uuid('Invalid sport ID'),
  is_active: z.boolean().default(true),
});

export const createFacilityInputSchema = z.object({
  venue_id: z.string().uuid('Invalid venue ID'),
  sport_id: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
    z.string().uuid('Invalid sport ID').nullable().optional()
  ),
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, 'Facility name is required')
  ),
  slug: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.string().min(1, 'Slug is required').regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens')
  ),
  description: z.string().nullable().optional(),
  facility_type: z.string().nullable().optional(),
  capacity: z.preprocess(
    (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : null),
    z.number().int().positive('Capacity must be greater than 0').nullable().optional()
  ),
  status: facilityStatusSchema.default('AVAILABLE'),
  is_bookable: z.boolean().default(true),
  default_duration_minutes: z.preprocess(
    (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : 60),
    z.number().int().positive('Duration must be greater than 0').default(60)
  ),
  buffer_minutes: z.preprocess(
    (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : 0),
    z.number().int().nonnegative('Buffer minutes cannot be negative').default(0)
  ),
});

export const updateFacilityInputSchema = createFacilityInputSchema.partial().extend({
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, 'Facility name is required')
  ),
});

export const dailyOperatingHourSchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    open_time: z.string().nullable().optional(),
    close_time: z.string().nullable().optional(),
    is_closed: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.is_closed) return true;
      if (!data.open_time || !data.close_time) return false;
      return data.open_time < data.close_time;
    },
    {
      message: 'Opening time must be strictly before closing time on active days',
      path: ['close_time'],
    }
  );

export const updateOperatingHoursInputSchema = z.object({
  venue_id: z.string().uuid('Invalid venue ID'),
  schedule: z.array(dailyOperatingHourSchema).length(7, 'Schedule must contain all 7 days of the week'),
});

export const createPricingRuleInputSchema = z
  .object({
    venue_id: z.string().uuid('Invalid venue ID'),
    facility_id: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
      z.string().uuid('Invalid facility ID').nullable().optional()
    ),
    name: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim() : val),
      z.string().min(1, 'Pricing rule name is required')
    ),
    pricing_type: pricingTypeSchema,
    day_of_week: z.preprocess(
      (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : null),
      z.number().int().min(0).max(6).nullable().optional()
    ),
    start_time: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
      z.string().nullable().optional()
    ),
    end_time: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
      z.string().nullable().optional()
    ),
    price_per_hour: z.preprocess(
      (val) => Number(val),
      z.number().nonnegative('Price per hour cannot be negative')
    ),
    member_price: z.preprocess(
      (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : null),
      z.number().nonnegative('Member price cannot be negative').nullable().optional()
    ),
    priority: z.preprocess(
      (val) => (val !== null && val !== undefined && val !== '' ? Number(val) : 0),
      z.number().int().nonnegative().default(0)
    ),
    valid_from: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
      z.string().nullable().optional()
    ),
    valid_until: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : null),
      z.string().nullable().optional()
    ),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.start_time && data.end_time) {
        return data.start_time < data.end_time;
      }
      return true;
    },
    {
      message: 'Start time must be before end time',
      path: ['end_time'],
    }
  )
  .refine(
    (data) => {
      if (data.valid_from && data.valid_until) {
        return data.valid_from <= data.valid_until;
      }
      return true;
    },
    {
      message: 'Valid from date must be before or equal to valid until date',
      path: ['valid_until'],
    }
  );

export const updatePricingRuleInputSchema = createPricingRuleInputSchema;

export const createMaintenanceBlockInputSchema = z
  .object({
    venue_id: z.string().uuid('Invalid venue ID'),
    facility_id: z.string().uuid('Invalid facility ID'),
    start_at: z.string().datetime('Start time must be a valid ISO timestamp'),
    end_at: z.string().datetime('End time must be a valid ISO timestamp'),
    reason: z.string().nullable().optional(),
    status: maintenanceBlockStatusSchema.default('ACTIVE'),
  })
  .refine(
    (data) => {
      return new Date(data.start_at).getTime() < new Date(data.end_at).getTime();
    },
    {
      message: 'Maintenance start time must be strictly before end time',
      path: ['end_at'],
    }
  );

export const updateMaintenanceBlockInputSchema = createMaintenanceBlockInputSchema;

export type HealthCheckInput = z.infer<typeof healthCheckSchema>;
export type SupabasePublicEnv = z.infer<typeof supabasePublicEnvSchema>;
export type SupabaseServerEnv = z.infer<typeof supabaseServerEnvSchema>;
export type SupabaseHealth = z.infer<typeof supabaseHealthSchema>;
export type LoginInputSchema = z.infer<typeof loginSchema>;
export type CustomerRegistrationInputSchema = z.infer<typeof customerRegistrationSchema>;
export type OwnerRegistrationInputSchema = z.infer<typeof ownerRegistrationSchema>;
export type ActiveOrgSelectionInputSchema = z.infer<typeof activeOrgSelectionSchema>;
export type UpdateOrganizationInputSchema = z.infer<typeof updateOrganizationSchema>;
export type CreateVenueInputSchema = z.infer<typeof createVenueInputSchema>;
export type UpdateVenueInputSchema = z.infer<typeof updateVenueInputSchema>;
export type AssignVenueSportInputSchema = z.infer<typeof assignVenueSportSchema>;
export type CreateFacilityInputSchema = z.infer<typeof createFacilityInputSchema>;
export type UpdateFacilityInputSchema = z.infer<typeof updateFacilityInputSchema>;
export type DailyOperatingHourInputSchema = z.infer<typeof dailyOperatingHourSchema>;
export type UpdateOperatingHoursInputSchema = z.infer<typeof updateOperatingHoursInputSchema>;
export type CreatePricingRuleInputSchema = z.infer<typeof createPricingRuleInputSchema>;
export type UpdatePricingRuleInputSchema = z.infer<typeof updatePricingRuleInputSchema>;
export type CreateMaintenanceBlockInputSchema = z.infer<typeof createMaintenanceBlockInputSchema>;
export type UpdateMaintenanceBlockInputSchema = z.infer<typeof updateMaintenanceBlockInputSchema>;

// ============================================================================
// STEP 5 — Customer Discovery, Venue Search & Availability Schemas
// ============================================================================

export const facilityAvailabilityStatusSchema = z.enum([
  'AVAILABLE',
  'UNAVAILABLE',
  'OUTSIDE_OPERATING_HOURS',
  'MAINTENANCE',
  'NOT_BOOKABLE',
]);

export const venueSearchSortOptionSchema = z.enum([
  'distance',
  'price',
  'rating',
  'availability',
]);

export const venueSearchParamsSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const obj = { ...(raw as Record<string, any>) };
    if (obj.location && !obj.locationText) obj.locationText = obj.location;
    if (obj.sport && !obj.sportId) obj.sportId = obj.sport;
    if (obj.time && !obj.startTime) obj.startTime = obj.time;
    if (obj.radius && !obj.radiusKm) obj.radiusKm = obj.radius;
    return obj;
  },
  z.object({
    sportId: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.string().optional()
    ),
    date: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional()
    ),
    startTime: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/, 'Time must be formatted as HH:mm or HH:mm:ss').optional()
    ),
    durationMinutes: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 60),
      z.number().int().positive('Duration must be greater than 0').default(60)
    ),
    latitude: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
      z.number().min(-90).max(90).optional()
    ),
    longitude: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
      z.number().min(-180).max(180).optional()
    ),
    locationText: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.string().optional()
    ),
    radiusKm: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
      z.number().positive('Radius must be positive').max(500, 'Radius cannot exceed 500km').optional()
    ),
    minPrice: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
      z.number().nonnegative('Minimum price cannot be negative').optional()
    ),
    maxPrice: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
      z.number().nonnegative('Maximum price cannot be negative').optional()
    ),
    availability: z.enum(['available', 'all']).default('all'),
    facilityType: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.string().optional()
    ),
    sort: venueSearchSortOptionSchema.default('distance'),
    view: z.enum(['list', 'map']).default('list').optional(),
    page: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 1),
      z.number().int().positive().default(1)
    ),
    pageSize: z.preprocess(
      (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 12),
      z.number().int().positive().max(50).default(12)
    ),
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'Minimum price cannot be greater than maximum price',
      path: ['maxPrice'],
    }
  )
);

export const locationSearchParamsSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationText: z.string().trim().optional(),
  radiusKm: z.number().positive().max(500).default(10),
});

export const availabilitySearchParamsSchema = z.object({
  facilityId: z.string().uuid('Invalid facility ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/, 'Time must be HH:mm or HH:mm:ss'),
  durationMinutes: z.number().int().positive().default(60),
});

export type VenueSearchParamsSchema = z.infer<typeof venueSearchParamsSchema>;
export type LocationSearchParamsSchema = z.infer<typeof locationSearchParamsSchema>;
export type AvailabilitySearchParamsSchema = z.infer<typeof availabilitySearchParamsSchema>;

// ============================================================================
// STEP 6 — Booking Engine & Reservation Management Schemas
// ============================================================================

export const bookingStatusSchema = z.enum([
  'HOLD',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'COMPLETED',
  'NO_SHOW',
]);

export const createBookingHoldSchema = z.object({
  facilityId: z.string().uuid('Invalid facility ID format'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/, 'Time must be formatted as HH:MM or HH:MM:SS'),
  durationMinutes: z.preprocess(
    (val) => (val !== undefined && val !== null ? Number(val) : 60),
    z.number().int().min(30, 'Minimum booking duration is 30 minutes').max(480, 'Maximum duration is 8 hours')
  ),
  customerNote: z.string().max(500, 'Customer note cannot exceed 500 characters').optional().nullable(),
});

export const confirmBookingSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID format'),
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID format'),
  reason: z.string().max(500, 'Cancellation reason cannot exceed 500 characters').optional().nullable(),
});

export const facilitySlotQuerySchema = z.object({
  facilityId: z.string().uuid('Invalid facility ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  durationMinutes: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 60),
    z.number().int().min(30).max(480).default(60)
  ),
});

export const walkInBookingSchema = z.object({
  venueId: z.string().uuid('Invalid venue ID'),
  facilityId: z.string().uuid('Invalid facility ID'),
  sportId: z.string().uuid('Invalid sport ID').optional().nullable(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/, 'Time must be HH:MM'),
  durationMinutes: z.number().int().min(30).max(480),
  customerName: z.string().trim().min(2, 'Customer name is required'),
  customerPhone: z.string().trim().min(7, 'Customer phone number is required'),
  customerEmail: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  notes: z.string().max(500).optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'COMPLIMENTARY']).default('CASH'),
  amountPaid: z.number().min(0).optional(),
});

export type BookingStatusSchema = z.infer<typeof bookingStatusSchema>;
export type CreateBookingHoldSchema = z.infer<typeof createBookingHoldSchema>;
export type ConfirmBookingSchema = z.infer<typeof confirmBookingSchema>;
export type CancelBookingSchema = z.infer<typeof cancelBookingSchema>;
export type FacilitySlotQuerySchema = z.infer<typeof facilitySlotQuerySchema>;
export type WalkInBookingSchema = z.infer<typeof walkInBookingSchema>;

// ============================================================================
// STEP 7 — Payment & Transaction Management Schemas
// ============================================================================

export const paymentStatusSchema = z.enum([
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

export const paymentMethodSchema = z.enum([
  'CARD',
  'ONLINE_BANKING',
  'WALLET',
  'CASH',
  'BANK_TRANSFER',
  'COMPLIMENTARY',
]);

export const refundStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED']);

export const createPaymentSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID format'),
  paymentMethod: paymentMethodSchema.default('CARD'),
  idempotencyKey: z.string().min(1).max(255).optional(),
  returnUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export const verifyPaymentSchema = z.object({
  paymentTransactionId: z.string().uuid('Invalid payment transaction ID format'),
  providerTransactionId: z.string().min(1).optional(),
  verificationToken: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export const refundPaymentSchema = z.object({
  paymentTransactionId: z.string().uuid('Invalid payment transaction ID format'),
  amount: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
    z.number().positive('Refund amount must be greater than zero').optional()
  ),
  reason: z.string().max(500, 'Refund reason cannot exceed 500 characters').optional().nullable(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export const paymentQuerySchema = z.object({
  venueId: z.string().uuid('Invalid venue ID').optional(),
  status: paymentStatusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  page: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 1),
    z.number().int().positive().default(1)
  ),
  pageSize: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 20),
    z.number().int().positive().max(100).default(20)
  ),
});

export type PaymentStatusSchema = z.infer<typeof paymentStatusSchema>;
export type PaymentMethodSchema = z.infer<typeof paymentMethodSchema>;
export type RefundStatusSchema = z.infer<typeof refundStatusSchema>;
export type CreatePaymentSchema = z.input<typeof createPaymentSchema>;
export type VerifyPaymentSchema = z.input<typeof verifyPaymentSchema>;
export type RefundPaymentSchema = z.input<typeof refundPaymentSchema>;
export type PaymentQuerySchema = z.infer<typeof paymentQuerySchema>;

// ============================================================================
// STEP 8 — Notifications & Communication System Schemas
// ============================================================================

export const notificationTypeSchema = z.enum([
  'BOOKING_HOLD_CREATED',
  'BOOKING_HOLD_EXPIRING',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'WALK_IN_BOOKING_CREATED',
  'PAYMENT_PENDING',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'REFUND_PROCESSED',
  'SYSTEM_ALERT',
]);

export const notificationChannelSchema = z.enum(['IN_APP', 'EMAIL', 'SMS', 'PUSH']);

export const notificationStatusSchema = z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED']);

export const createNotificationSchema = z.object({
  organizationId: z.string().optional().nullable(),
  recipientUserId: z.string().min(1, 'Recipient user ID is required'),
  notificationType: notificationTypeSchema,
  title: z.string().min(1, 'Title cannot be empty').max(200),
  message: z.string().min(1, 'Message cannot be empty').max(2000),
  relatedEntityType: z.string().min(1).max(50),
  relatedEntityId: z.string().optional().nullable(),
  channel: notificationChannelSchema.default('IN_APP'),
  idempotencyKey: z.string().min(1).max(255).optional().nullable(),
  metadata: z.record(z.any()).default({}),
});

export const updateNotificationPreferencesSchema = z.object({
  emailBookingConfirmations: z.boolean().optional(),
  emailPaymentReceipts: z.boolean().optional(),
  emailHoldReminders: z.boolean().optional(),
  emailCancellations: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  promotionalEmails: z.boolean().optional(),
  email_booking_confirmations: z.boolean().optional(),
  email_payment_receipts: z.boolean().optional(),
  email_hold_reminders: z.boolean().optional(),
  email_cancellations: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  promotional_emails: z.boolean().optional(),
});

export const notificationQuerySchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID').optional(),
  unreadOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  notificationType: notificationTypeSchema.optional(),
  channel: notificationChannelSchema.optional(),
  page: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 1),
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
    z.number().int().positive().max(100).optional()
  ),
  pageSize: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : 20),
    z.number().int().positive().max(100).default(20)
  ),
});

export type NotificationTypeSchema = z.infer<typeof notificationTypeSchema>;
export type NotificationChannelSchema = z.infer<typeof notificationChannelSchema>;
export type NotificationStatusSchema = z.infer<typeof notificationStatusSchema>;
export type CreateNotificationSchema = z.input<typeof createNotificationSchema>;
export type UpdateNotificationPreferencesSchema = z.infer<typeof updateNotificationPreferencesSchema>;
export type NotificationQuerySchema = z.infer<typeof notificationQuerySchema>;

// ============================================================================
// STEP 9 — Reporting & Analytics Schemas
// ============================================================================

export const timeRangePresetSchema = z.enum([
  'today',
  'yesterday',
  'this_week',
  'this_month',
  'previous_month',
  'last_30_days',
  'last_90_days',
  'this_year',
  'custom',
]);

export const reportFilterSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID').optional(),
  timeRangePreset: timeRangePresetSchema.default('this_month'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  venueId: z.string().uuid('Invalid venue ID').optional(),
  facilityId: z.string().uuid('Invalid facility ID').optional(),
  bookingStatus: bookingStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  timezone: z.string().min(1).default('Asia/Colombo'),
});

export const reportExportSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID').optional(),
  format: z.enum(['csv', 'json']).default('csv'),
  reportType: z.enum(['overview', 'bookings', 'revenue', 'facilities', 'customers']).default('overview'),
  timeRangePreset: timeRangePresetSchema.default('this_month'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  venueId: z.string().uuid('Invalid venue ID').optional(),
  facilityId: z.string().uuid('Invalid facility ID').optional(),
});

export type TimeRangePresetSchema = z.infer<typeof timeRangePresetSchema>;
export type ReportFilterSchema = z.infer<typeof reportFilterSchema>;
export type ReportExportSchema = z.infer<typeof reportExportSchema>;

// ============================================================================
// STEP 10 — Platform Administration, Organization Settings & Audit System Schemas
// ============================================================================

export const bookingOperationalSettingsSchema = z.object({
  min_booking_duration_minutes: z.number().int().min(15).max(1440).default(30),
  max_booking_duration_minutes: z.number().int().min(30).max(1440).default(480),
  hold_duration_minutes: z.number().int().min(1).max(60).default(10),
  cancellation_window_hours: z.number().int().min(0).max(168).default(2),
  buffer_minutes: z.number().int().min(0).max(120).default(0),
  allow_auto_confirm: z.boolean().default(true),
});

export const paymentOperationalSettingsSchema = z.object({
  enabled_methods: z.array(z.string()).min(1).default(['SANDBOX', 'PAYHERE', 'DIRECT_BANK', 'CASH']),
  allow_offline_payments: z.boolean().default(true),
  offline_payment_instructions: z.string().max(1000).nullable().optional(),
  tax_registration_number: z.string().max(100).nullable().optional(),
});

export const notificationOperationalSettingsSchema = z.object({
  email_enabled: z.boolean().default(true),
  sms_enabled: z.boolean().default(false),
  booking_confirmation_enabled: z.boolean().default(true),
  hold_reminder_enabled: z.boolean().default(true),
  marketing_consent_required: z.boolean().default(true),
});

export const organizationOperationalSettingsSchema = z.object({
  booking: bookingOperationalSettingsSchema.default({
    min_booking_duration_minutes: 30,
    max_booking_duration_minutes: 480,
    hold_duration_minutes: 10,
    cancellation_window_hours: 2,
    buffer_minutes: 0,
    allow_auto_confirm: true,
  }),
  payment: paymentOperationalSettingsSchema.default({
    enabled_methods: ['SANDBOX', 'PAYHERE', 'DIRECT_BANK', 'CASH'],
    allow_offline_payments: true,
    offline_payment_instructions: 'Pay at the front desk before game time.',
    tax_registration_number: null,
  }),
  notifications: notificationOperationalSettingsSchema.default({
    email_enabled: true,
    sms_enabled: false,
    booking_confirmation_enabled: true,
    hold_reminder_enabled: true,
    marketing_consent_required: true,
  }),
});

export const updateOrganizationSettingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  logo_url: z.string().url('Invalid URL').nullable().optional().or(z.literal('')),
  phone: z.string().max(50).nullable().optional().or(z.literal('')),
  email: z.string().email('Invalid email').nullable().optional().or(z.literal('')),
  website: z.string().url('Invalid URL').nullable().optional().or(z.literal('')),
  currency: z.string().length(3, 'Currency must be 3 characters').optional(),
  timezone: z.string().min(1, 'Timezone is required').optional(),
  settings: organizationOperationalSettingsSchema.optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['MANAGER', 'RECEPTIONIST', 'SCORER', 'COACH'], {
    errorMap: () => ({ message: 'Permitted staff roles: MANAGER, RECEPTIONIST, SCORER, COACH' }),
  }),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['MANAGER', 'RECEPTIONIST', 'SCORER', 'COACH'], {
    errorMap: () => ({ message: 'Permitted staff roles: MANAGER, RECEPTIONIST, SCORER, COACH' }),
  }),
});

export const updateMemberStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED'], {
    errorMap: () => ({ message: 'Invalid member status' }),
  }),
});

export const auditLogFilterSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID').optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  actorUserId: z.string().uuid('Invalid actor ID').optional(),
  startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  page: z.preprocess((v) => (v !== undefined && v !== null && v !== '' ? Number(v) : 1), z.number().int().min(1).default(1)),
  limit: z.preprocess((v) => (v !== undefined && v !== null && v !== '' ? Number(v) : 25), z.number().int().min(1).max(100).default(25)),
});

export type BookingOperationalSettingsSchema = z.infer<typeof bookingOperationalSettingsSchema>;
export type PaymentOperationalSettingsSchema = z.infer<typeof paymentOperationalSettingsSchema>;
export type NotificationOperationalSettingsSchema = z.infer<typeof notificationOperationalSettingsSchema>;
export type OrganizationOperationalSettingsSchema = z.infer<typeof organizationOperationalSettingsSchema>;
export type UpdateOrganizationSettingsSchema = z.infer<typeof updateOrganizationSettingsSchema>;
export type InviteMemberSchema = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleSchema = z.infer<typeof updateMemberRoleSchema>;
export type UpdateMemberStatusSchema = z.infer<typeof updateMemberStatusSchema>;
export type AuditLogFilterSchema = z.infer<typeof auditLogFilterSchema>;

// ============================================================================
// STEP 11 — Customer Account & Experience Schemas
// ============================================================================

export const updateCustomerProfileSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
  display_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  avatar_url: z.string().url('Invalid URL').nullable().optional().or(z.literal('')),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').nullable().optional().or(z.literal('')),
  gender: z.string().max(30).nullable().optional(),
  country_code: z.string().max(5).optional(),
  preferred_language: z.string().max(10).optional(),
  timezone: z.string().min(1).optional(),
  emergency_contact_name: z.string().max(100).nullable().optional(),
  emergency_contact_phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const customerBookingQuerySchema = z.object({
  tab: z.enum(['all', 'upcoming', 'today', 'completed', 'cancelled', 'holds']).default('all'),
  page: z.preprocess((v) => (v !== undefined && v !== null && v !== '' ? Number(v) : 1), z.number().int().min(1).default(1)),
  limit: z.preprocess((v) => (v !== undefined && v !== null && v !== '' ? Number(v) : 20), z.number().int().min(1).max(100).default(20)),
});

export type UpdateCustomerProfileSchema = z.infer<typeof updateCustomerProfileSchema>;
export type CustomerBookingQuerySchema = z.infer<typeof customerBookingQuerySchema>;
