/**
 * @sportshub/config
 * Shared configuration and constants for SportsHub platform
 */

import type { SportInfo, SportType } from '@sportshub/types';

export const APP_CONFIG = {
  name: 'SportsHub',
  tagline: 'Book. Play. Compete. Connect.',
  description: 'Multi-tenant sports and recreation platform for bookings, tournaments, coaching, and communities.',
  version: '0.1.0',
  defaultCurrency: 'LKR',
  defaultTimezone: 'Asia/Colombo',
  contactEmail: 'support@sportshub.local',
} as const;

export const INITIAL_SPORTS: Record<SportType, SportInfo> = {
  cricket: {
    id: 'cricket',
    name: 'Cricket',
    category: 'team',
    minPlayers: 2,
    maxPlayers: 22,
    description: 'Nets, turf pitches, full ground matches, and live scoring.',
  },
  badminton: {
    id: 'badminton',
    name: 'Badminton',
    category: 'racquet',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Indoor synthetic & wooden court reservations and doubles tournaments.',
  },
  basketball: {
    id: 'basketball',
    name: 'Basketball',
    category: 'team',
    minPlayers: 2,
    maxPlayers: 10,
    description: 'Full court and half court hourly bookings and pickup games.',
  },
  table_tennis: {
    id: 'table_tennis',
    name: 'Table Tennis',
    category: 'indoor',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'ITTF-standard indoor tables, robot training, and ladder tournaments.',
  },
  chess: {
    id: 'chess',
    name: 'Chess',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Rapid, Blitz, and Classical rated matches and coaching clinics.',
  },
  carrom: {
    id: 'carrom',
    name: 'Carrom',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Championship powder boards for singles and doubles club matches.',
  },
};

export const ROUTES = {
  HOME: '/',
  HEALTH: '/health',
  LOGIN: '/login',
  REGISTER: '/register',
  REGISTER_OWNER: '/register/owner',
  AUTH_CALLBACK: '/auth/callback',
  CUSTOMER_DASHBOARD: '/customer',
  OWNER_DASHBOARD: '/owner',
  RECEPTIONIST_DASHBOARD: '/receptionist',
  SCORER_DASHBOARD: '/scorer',
  COACH_DASHBOARD: '/coach',
  ADMIN_DASHBOARD: '/admin',
} as const;

export const OWNER_ROUTES = {
  DASHBOARD: '/owner',
  ORGANIZATION: '/owner/organization',
  VENUES: '/owner/venues',
  VENUE_NEW: '/owner/venues/new',
  VENUE_VIEW: (venueId: string) => `/owner/venues/${venueId}`,
  VENUE_EDIT: (venueId: string) => `/owner/venues/${venueId}/edit`,
  VENUE_SPORTS: (venueId: string) => `/owner/venues/${venueId}/sports`,
  VENUE_FACILITIES: (venueId: string) => `/owner/venues/${venueId}/facilities`,
  VENUE_HOURS: (venueId: string) => `/owner/venues/${venueId}/hours`,
  VENUE_PRICING: (venueId: string) => `/owner/venues/${venueId}/pricing`,
  VENUE_MAINTENANCE: (venueId: string) => `/owner/venues/${venueId}/maintenance`,
  BOOKINGS: '/owner/bookings',
  PAYMENTS: '/owner/payments',
  NOTIFICATIONS: '/owner/notifications',
  REPORTS: '/owner/reports',
  SETTINGS: '/owner/settings',
  MEMBERS: '/owner/members',
  AUDIT_LOGS: '/owner/audit-logs',
} as const;

export const CUSTOMER_ROUTES = {
  HOME: '/',
  DISCOVER: '/search',
  VENUES: '/venues',
  VENUE_VIEW: (venueId: string) => `/venues/${venueId}`,
  FACILITY_VIEW: (venueId: string, facilityId: string) => `/venues/${venueId}/facilities/${facilityId}`,
  BOOK_FACILITY: (venueId: string, facilityId: string) => `/venues/${venueId}/facilities/${facilityId}/book`,
  MY_BOOKINGS: '/customer/bookings',
  BOOKING_DETAILS: (bookingId: string) => `/customer/bookings/${bookingId}`,
  BOOKING_RECEIPT: (bookingId: string) => `/customer/bookings/${bookingId}/receipt`,
  PAYMENTS: '/customer/payments',
  CHECKOUT: (bookingId: string) => `/customer/bookings/${bookingId}/pay`,
  NOTIFICATIONS: '/customer/notifications',
  PROFILE: '/customer',
  ACCOUNT: '/customer/account',
} as const;

// ============================================================================
// STEP 6 — Booking Engine Constants & Policies
// ============================================================================

export const BOOKING_CONFIG = {
  DEFAULT_HOLD_DURATION_MINUTES: 10,
  DEFAULT_SLOT_INTERVAL_MINUTES: 30,
  MIN_BOOKING_DURATION_MINUTES: 30,
  MAX_BOOKING_DURATION_MINUTES: 480,
  DEFAULT_CURRENCY: 'LKR',
  DEFAULT_TIMEZONE: 'Asia/Colombo',
  CANCELLATION_WINDOW_HOURS: 2,
  REFERENCE_PREFIX: 'SPH',
} as const;

// ============================================================================
// STEP 7 — Payment & Transaction Management Constants
// ============================================================================

export const PAYMENT_CONFIG = {
  DEFAULT_PROVIDER: 'SANDBOX',
  SUPPORTED_PROVIDERS: ['SANDBOX', 'STRIPE', 'PAYHERE', 'DIRECT_BANK', 'CASH'] as const,
  SUPPORTED_CURRENCIES: ['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'AED'] as const,
  DEFAULT_CURRENCY: 'LKR',
  TRANSACTION_PREFIX: 'TXN',
  REFUND_PREFIX: 'RFD',
  IDEMPOTENCY_HEADER: 'x-idempotency-key',
  DEFAULT_RETURN_URL: '/customer/payments',
} as const;

// ============================================================================
// STEP 8 — Notifications & Communication Constants
// ============================================================================

export const NOTIFICATION_CONFIG = {
  DEFAULT_CHANNEL: 'IN_APP',
  SUPPORTED_CHANNELS: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] as const,
  HOLD_REMINDER_THRESHOLD_MINUTES: 2,
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
  EMAIL_FROM: 'SportsHub <notifications@sportshub.local>',
  EMAIL_REPLY_TO: 'support@sportshub.local',
} as const;

// ============================================================================
// STEP 3, STEP 6, STEP 7, STEP 8, STEP 9 & STEP 10 — Centralized Role Permission Mapping
// ============================================================================

import type { RolePermissionsMap } from '@sportshub/types';

export const ROLE_PERMISSIONS: RolePermissionsMap = {
  SUPER_ADMIN: [
    'platform.read',
    'platform.manage',
    'organization.read',
    'organization.manage',
    'venue.read',
    'venue.manage',
    'facility.read',
    'facility.manage',
    'staff.read',
    'staff.manage',
    'customer.read',
    'customer.manage',
    'scoring.read',
    'scoring.manage',
    'booking.read',
    'booking.manage',
    'booking.create',
    'booking.cancel',
    'payment.read',
    'payment.create',
    'payment.refund',
    'payment.manage',
    'notification.read',
    'notification.manage',
    'report.read',
    'report.financial',
    'report.export',
    'audit.read',
    'audit.manage',
    'settings.read',
    'settings.manage',
  ],
  OWNER: [
    'organization.read',
    'organization.manage',
    'venue.read',
    'venue.manage',
    'facility.read',
    'facility.manage',
    'staff.read',
    'staff.manage',
    'customer.read',
    'customer.manage',
    'scoring.read',
    'scoring.manage',
    'booking.read',
    'booking.manage',
    'booking.create',
    'booking.cancel',
    'payment.read',
    'payment.create',
    'payment.refund',
    'payment.manage',
    'notification.read',
    'notification.manage',
    'report.read',
    'report.financial',
    'report.export',
    'audit.read',
    'audit.manage',
    'settings.read',
    'settings.manage',
  ],
  MANAGER: [
    'organization.read',
    'venue.read',
    'venue.manage',
    'facility.read',
    'facility.manage',
    'staff.read',
    'customer.read',
    'customer.manage',
    'scoring.read',
    'booking.read',
    'booking.manage',
    'booking.create',
    'booking.cancel',
    'payment.read',
    'payment.create',
    'payment.refund',
    'notification.read',
    'report.read',
    'report.financial',
    'report.export',
    'audit.read',
    'settings.read',
  ],
  RECEPTIONIST: [
    'organization.read',
    'venue.read',
    'facility.read',
    'customer.read',
    'customer.manage',
    'booking.read',
    'booking.manage',
    'booking.create',
    'booking.cancel',
    'payment.read',
    'payment.create',
    'notification.read',
    'report.read',
  ],
  SCORER: [
    'organization.read',
    'venue.read',
    'facility.read',
    'scoring.read',
    'scoring.manage',
  ],
  COACH: [
    'organization.read',
    'venue.read',
    'facility.read',
    'customer.read',
    'customer.manage',
    'booking.read',
  ],
  CUSTOMER: [
    'customer.read',
    'booking.read',
    'booking.create',
    'booking.cancel',
    'payment.read',
    'payment.create',
    'notification.read',
  ],
  PLAYER: [
    'customer.read',
    'booking.read',
  ],
} as const;




