/**
 * @sportshub/types
 * Core shared TypeScript types and database entity interfaces for SportsHub platform
 */

// Foundation Health & System Types
export type SystemStatus = 'OK' | 'DEGRADED' | 'MAINTENANCE';
export type SupabaseStatus = 'connected' | 'not_configured' | 'disconnected';

export interface HealthCheckResponse {
  status: SystemStatus;
  timestamp: string;
  version: string;
  service: string;
  environment: string;
  supabase?: {
    configured: boolean;
    connected: boolean;
    status: SupabaseStatus;
    message: string;
    latencyMs?: number;
  };
}

// Initial Supported Sports (Foundation)
export type SportType =
  | 'cricket'
  | 'badminton'
  | 'basketball'
  | 'table_tennis'
  | 'chess'
  | 'carrom';

export interface SportInfo {
  id: SportType;
  name: string;
  category: 'team' | 'racquet' | 'indoor' | 'board';
  minPlayers: number;
  maxPlayers: number;
  description: string;
}

// ============================================================================
// STEP 2 — Core Database Controlled Enums
// ============================================================================

export type OrganizationStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export type AppRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'MANAGER'
  | 'RECEPTIONIST'
  | 'SCORER'
  | 'COACH'
  | 'CUSTOMER'
  | 'PLAYER';

export type VenueStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CLOSED'
  | 'ARCHIVED';

export type FacilityStatus =
  | 'AVAILABLE'
  | 'MAINTENANCE'
  | 'BLOCKED'
  | 'CLOSED'
  | 'ARCHIVED';

export type PricingType =
  | 'BASE'
  | 'PEAK'
  | 'OFF_PEAK'
  | 'MEMBER'
  | 'WEEKEND'
  | 'HOLIDAY'
  | 'CUSTOM';

export type MaintenanceBlockStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED';

// Backward-compatible user role alias
export type UserRole =
  | 'customer'
  | 'venue_owner'
  | 'manager'
  | 'receptionist'
  | 'scorer'
  | 'coach'
  | 'super_admin'
  | 'public_user';

// Generic Entity Baseline
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// STEP 2 — Core Database Entity Interfaces
// ============================================================================

export interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  country_code: string;
  preferred_language: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: OrganizationStatus;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: AppRole;
  status: MemberStatus;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  status: VenueStatus;
  timezone: string;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sport {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  is_active: boolean;
  supports_booking: boolean;
  supports_team: boolean;
  supports_tournament: boolean;
  supports_live_scoring: boolean;
  created_at: string;
  updated_at: string;
}

export interface VenueSport {
  id: string;
  venue_id: string;
  sport_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Facility {
  id: string;
  venue_id: string;
  sport_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  facility_type: string | null;
  capacity: number | null;
  status: FacilityStatus;
  is_bookable: boolean;
  default_duration_minutes: number;
  buffer_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface VenueOperatingHours {
  id: string;
  venue_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  organization_id: string;
  venue_id: string;
  facility_id: string | null;
  name: string;
  pricing_type: PricingType;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  price_per_hour: number;
  member_price: number | null;
  priority: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceBlock {
  id: string;
  organization_id: string;
  venue_id: string;
  facility_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  status: MaintenanceBlockStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile {
  id: string;
  user_id: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Generic API Envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// ============================================================================
// STEP 3 — Centralized Permissions & RBAC Types
// ============================================================================

export type PlatformPermission = 'platform.read' | 'platform.manage';
export type OrgPermission = 'organization.read' | 'organization.manage';
export type VenuePermission = 'venue.read' | 'venue.manage';
export type FacilityPermission = 'facility.read' | 'facility.manage';
export type StaffPermission = 'staff.read' | 'staff.manage';
export type CustomerPermission = 'customer.read' | 'customer.manage';
export type ScoringPermission = 'scoring.read' | 'scoring.manage';
export type BookingPermission = 'booking.read' | 'booking.create' | 'booking.manage' | 'booking.cancel';
export type PaymentPermission = 'payment.read' | 'payment.create' | 'payment.refund' | 'payment.manage';
export type NotificationPermission = 'notification.read' | 'notification.manage';
export type ReportPermission = 'report.read' | 'report.financial' | 'report.export';
export type AuditPermission = 'audit.read' | 'audit.manage';
export type SettingsPermission = 'settings.read' | 'settings.manage';

export type Permission =
  | PlatformPermission
  | OrgPermission
  | VenuePermission
  | FacilityPermission
  | StaffPermission
  | CustomerPermission
  | ScoringPermission
  | BookingPermission
  | PaymentPermission
  | NotificationPermission
  | ReportPermission
  | AuditPermission
  | SettingsPermission;

export type RolePermissionsMap = Record<AppRole, readonly Permission[]>;

// ============================================================================
// STEP 3 — Authentication & Session Context Types
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  user_metadata?: {
    full_name?: string;
    phone?: string;
    [key: string]: unknown;
  };
}

export interface ActiveOrganizationContext {
  user: AuthUser;
  profile: Profile;
  activeOrganization: Organization | null;
  activeMembership: OrganizationMember | null;
  allMemberships: OrganizationMember[];
  role: AppRole | null;
  permissions: readonly Permission[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CustomerRegistrationInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export interface OwnerRegistrationInput {
  fullName: string;
  email: string;
  phone?: string;
  organizationName: string;
  password: string;
  confirmPassword: string;
}

// ============================================================================
// STEP 4 — Owner Organization & Venue Management Types
// ============================================================================

export interface VenueWithCounts extends Venue {
  facility_count?: number;
  sports_count?: number;
  pricing_rules_count?: number;
}

export interface VenueSportWithSport extends VenueSport {
  sport: Sport;
}

export interface FacilityWithSport extends Facility {
  sport?: Sport | null;
}

export interface VenueDetail extends Venue {
  organization: Organization;
  sports: VenueSportWithSport[];
  facilities: FacilityWithSport[];
  operating_hours: VenueOperatingHours[];
  pricing_rules: PricingRule[];
  maintenance_blocks: MaintenanceBlock[];
}

export interface OwnerDashboardSummary {
  totalVenues: number;
  totalFacilities: number;
  activeSportsCount: number;
  activeMaintenanceBlocksCount: number;
}

export interface UpdateOrganizationInput {
  name: string;
  description?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  currency: string;
  timezone: string;
}

export interface CreateVenueInput {
  name: string;
  slug: string;
  description?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  district?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  status?: VenueStatus;
  timezone?: string;
  cover_image_url?: string | null;
}

export interface UpdateVenueInput extends Partial<CreateVenueInput> {}

export interface CreateFacilityInput {
  venue_id: string;
  sport_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  facility_type?: string | null;
  capacity?: number | null;
  status?: FacilityStatus;
  is_bookable?: boolean;
  default_duration_minutes?: number;
  buffer_minutes?: number;
}

export interface UpdateFacilityInput extends Partial<CreateFacilityInput> {}

export interface DailyOperatingHourInput {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface CreatePricingRuleInput {
  organization_id: string;
  venue_id: string;
  facility_id?: string | null;
  name: string;
  pricing_type: PricingType;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  price_per_hour: number;
  member_price?: number | null;
  priority?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
}

export interface CreateMaintenanceBlockInput {
  organization_id: string;
  venue_id: string;
  facility_id: string;
  start_at: string;
  end_at: string;
  reason?: string | null;
  status?: MaintenanceBlockStatus;
}

// ============================================================================
// STEP 5 — Customer Discovery, Venue Search & Availability Types
// ============================================================================

export type FacilityAvailabilityStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'OUTSIDE_OPERATING_HOURS'
  | 'MAINTENANCE'
  | 'NOT_BOOKABLE';

export type VenueSearchSortOption = 'distance' | 'price' | 'rating' | 'availability';

export interface VenueSearchParams {
  sportId?: string;
  date?: string; // YYYY-MM-DD (Asia/Colombo)
  startTime?: string; // HH:mm or HH:mm:ss
  durationMinutes?: number;
  latitude?: number;
  longitude?: number;
  locationText?: string;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  availability?: 'available' | 'all';
  facilityType?: string;
  sort?: VenueSearchSortOption;
  view?: 'list' | 'map';
  page?: number;
  pageSize?: number;
}

export interface FacilityAvailabilityResult {
  facility_id: string;
  facility_name: string;
  status: FacilityAvailabilityStatus;
  is_available: boolean;
  reason?: string;
  message?: string;
  slot_start?: string;
  slot_end?: string;
  price_per_hour?: number;
  operating_hours?: {
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  };
  calculated_price?: {
    price_per_hour: number;
    pricing_type: PricingType;
    currency: string;
  } | null;
}

export interface PublicVenueSearchResult {
  venue_id: string;
  venue_name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  status: VenueStatus;
  currency: string;
  sports: Sport[];
  total_facilities_count: number;
  available_facilities_count: number;
  starting_price_per_hour: number | null;
  overall_availability_status: FacilityAvailabilityStatus;
}

export interface PublicFacilityDetail {
  id: string;
  venue_id: string;
  sport_id: string | null;
  sport: Sport | null;
  name: string;
  slug: string;
  description: string | null;
  facility_type: string | null;
  surface_type?: string | null;
  capacity: number | null;
  capacity_per_slot?: number | null;
  status: FacilityStatus;
  is_bookable: boolean;
  default_duration_minutes: number;
  buffer_minutes: number;
  currency: string;
  availability?: FacilityAvailabilityResult;
  starting_price_per_hour?: number | null;
  pricing_rules: PricingRule[];
  venue: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    district: string | null;
    address_line_1: string | null;
    operating_hours: VenueOperatingHours[];
  };
}

export interface PublicVenueDetail {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  status: VenueStatus;
  timezone: string;
  cover_image_url: string | null;
  currency: string;
  sports: Sport[];
  facilities: PublicFacilityDetail[];
  operating_hours: VenueOperatingHours[];
  starting_price_per_hour: number | null;
}

export interface DiscoverySearchResults {
  items: PublicVenueSearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appliedParams: VenueSearchParams;
}

// ============================================================================
// STEP 6 — Booking Engine, Reservation Management & Hold Types
// ============================================================================

export type BookingStatus =
  | 'HOLD'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface BookingPriceSnapshot {
  baseRatePerHour: number;
  appliedRatePerHour: number;
  pricingRuleId?: string | null;
  pricingRuleName?: string | null;
  pricingType?: PricingType | string;
  durationMinutes: number;
  subtotal: number;
  currency: string;
  calculatedAt: string;
}

export interface Booking {
  id: string;
  booking_reference: string;
  customer_user_id: string;
  customer_profile_id: string | null;
  organization_id: string;
  venue_id: string;
  facility_id: string;
  sport_id: string | null;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS or HH:MM
  end_time: string; // HH:MM:SS or HH:MM
  duration_minutes: number;
  protected_time_range: string;
  status: BookingStatus;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  price_snapshot: BookingPriceSnapshot | Record<string, any>;
  customer_note: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  confirmed_at: string | null;
  hold_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingWithDetails extends Booking {
  venue?: {
    id: string;
    name: string;
    slug: string;
    address_line_1: string | null;
    city: string | null;
    phone: string | null;
  };
  facility?: {
    id: string;
    name: string;
    slug: string;
    facility_type: string | null;
  };
  sport?: {
    id: string;
    name: string;
    icon_name: string | null;
  };
  customer?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
}

export interface FacilitySlot {
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
  durationMinutes: number;
  isAvailable: boolean;
  price: number | null;
  currency: string;
  unavailableReason?: 'PAST' | 'OUTSIDE_HOURS' | 'MAINTENANCE' | 'BOOKED' | 'HELD' | 'CLOSED';
}

export interface CreateBookingHoldInput {
  facilityId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  customerNote?: string;
}

export interface CreateBookingHoldResult {
  success: boolean;
  booking?: Booking;
  error?: {
    code: string;
    message: string;
  };
}

export interface ConfirmBookingInput {
  bookingId: string;
}

export interface ConfirmBookingResult {
  success: boolean;
  booking?: Booking;
  error?: {
    code: string;
    message: string;
  };
}

export interface CancelBookingInput {
  bookingId: string;
  reason?: string;
}

export interface CancelBookingResult {
  success: boolean;
  booking?: Booking;
  error?: {
    code: string;
    message: string;
  };
}

export interface WalkInBookingInput {
  venueId: string;
  facilityId: string;
  sportId?: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'COMPLIMENTARY';
  amountPaid?: number;
}

// ============================================================================
// STEP 7 — Payment & Transaction Management Types
// ============================================================================

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod =
  | 'CARD'
  | 'ONLINE_BANKING'
  | 'WALLET'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'COMPLIMENTARY';

export type RefundStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PaymentTransaction {
  id: string;
  booking_id: string;
  organization_id: string;
  customer_user_id: string;
  provider: string;
  provider_transaction_id: string | null;
  idempotency_key: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: PaymentMethod;
  provider_reference: string | null;
  failure_code: string | null;
  failure_message: string | null;
  metadata: Record<string, any>;
  refunded_amount: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RefundRecord {
  id: string;
  payment_transaction_id: string;
  booking_id: string;
  organization_id: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: RefundStatus;
  provider_refund_id: string | null;
  created_by: string | null;
  metadata: Record<string, any>;
  created_at: string;
  completed_at: string | null;
}

export interface PaymentWithDetails extends PaymentTransaction {
  booking?: BookingWithDetails;
  customer?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  refunds?: RefundRecord[];
}

export interface CreatePaymentInput {
  bookingId: string;
  paymentMethod?: PaymentMethod;
  idempotencyKey?: string;
  returnUrl?: string;
  metadata?: Record<string, any>;
}

export interface CreatePaymentResult {
  success: boolean;
  transaction?: PaymentTransaction;
  clientSecret?: string;
  checkoutUrl?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface VerifyPaymentInput {
  paymentTransactionId: string;
  providerTransactionId?: string;
  verificationToken?: string;
  idempotencyKey?: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: PaymentStatus;
  transaction?: PaymentTransaction;
  error?: {
    code: string;
    message: string;
  };
}

export interface RefundPaymentInput {
  paymentTransactionId: string;
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface RefundPaymentResult {
  success: boolean;
  refund?: RefundRecord;
  transaction?: PaymentTransaction;
  error?: {
    code: string;
    message: string;
  };
}

export interface OwnerFinancialSummary {
  totalRevenue: number;
  totalSuccessfulPayments: number;
  totalPendingPayments: number;
  totalFailedPayments: number;
  totalRefundedAmount: number;
  totalTransactionsCount: number;
  currency: string;
}

export interface PaymentFilterParams {
  venueId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// STEP 8 — Notifications & Communication System Types
// ============================================================================

export type NotificationType =
  | 'BOOKING_HOLD_CREATED'
  | 'BOOKING_HOLD_EXPIRING'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'WALK_IN_BOOKING_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'REFUND_PROCESSED'
  | 'SYSTEM_ALERT';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';

export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface Notification {
  id: string;
  organization_id: string | null;
  recipient_user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string;
  related_entity_id: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  idempotency_key: string | null;
  read_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  email_booking_confirmations: boolean;
  email_payment_receipts: boolean;
  email_hold_reminders: boolean;
  email_cancellations: boolean;
  in_app_enabled: boolean;
  promotional_emails?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationInput {
  organizationId?: string | null;
  recipientUserId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId?: string | null;
  channel?: NotificationChannel;
  idempotencyKey?: string | null;
  metadata?: Record<string, any>;
}

export interface NotificationFilterParams {
  organizationId?: string;
  unreadOnly?: boolean;
  notificationType?: NotificationType;
  channel?: NotificationChannel;
  page?: number;
  limit?: number;
  pageSize?: number;
}

export interface UpdateNotificationPreferencesInput {
  emailBookingConfirmations?: boolean;
  emailPaymentReceipts?: boolean;
  emailHoldReminders?: boolean;
  emailCancellations?: boolean;
  inAppEnabled?: boolean;
  promotionalEmails?: boolean;
  email_booking_confirmations?: boolean;
  email_payment_receipts?: boolean;
  email_hold_reminders?: boolean;
  email_cancellations?: boolean;
  in_app_enabled?: boolean;
  promotional_emails?: boolean;
}

// ============================================================================
// STEP 9 — Reporting, Analytics & Business Intelligence Types
// ============================================================================

export type TimeRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'previous_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'custom';

export interface ReportFilterParams {
  organizationId?: string;
  timeRangePreset?: TimeRangePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  venueId?: string;
  facilityId?: string;
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  timezone?: string;
}

export interface BookingOverviewMetrics {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  activeHolds: number;
  completedBookings: number;
  walkInBookings: number;
  cancellationRate: number; // percentage e.g. 12.5
  totalHoursBooked: number;
  averageDurationMinutes: number;
}

export interface RevenueOverviewMetrics {
  grossBookingAmount: number;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
  totalRefundedAmount: number;
  netRevenue: number; // successfulPayments - totalRefundedAmount
  currency: string;
  paymentMethodBreakdown: Array<{
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  paymentStatusBreakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
}

export interface VenuePerformanceMetrics {
  venueId: string;
  venueName: string;
  city?: string;
  totalBookings: number;
  confirmedBookings: number;
  grossRevenue: number;
  facilitiesCount: number;
  utilizationRate: number; // percentage
}

export interface FacilityPerformanceMetrics {
  facilityId: string;
  facilityName: string;
  venueId: string;
  venueName: string;
  sportName: string;
  totalBookings: number;
  confirmedBookings: number;
  totalHours: number;
  grossRevenue: number;
  utilizationRate: number; // percentage
}

export interface CustomerAnalyticsMetrics {
  totalUniqueCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageBookingsPerCustomer: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    phone?: string;
    bookingsCount: number;
    totalSpent: number;
    lastBookingDate?: string;
  }>;
}

export interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD
  label: string;
  bookingsCount: number;
  confirmedCount: number;
  cancelledCount: number;
  revenue: number;
}

export interface PeakHoursDataPoint {
  hour: number; // 0..23
  label: string; // "06:00", "18:00"
  bookingsCount: number;
  percentage: number;
}

export interface ExecutiveSummaryReport {
  organizationId: string;
  organizationName?: string;
  currency: string;
  timezone: string;
  dateRange: {
    startDate: string;
    endDate: string;
    preset?: TimeRangePreset;
  };
  bookingOverview: BookingOverviewMetrics;
  revenueOverview: RevenueOverviewMetrics;
  venuePerformance: VenuePerformanceMetrics[];
  facilityPerformance: FacilityPerformanceMetrics[];
  customerAnalytics: CustomerAnalyticsMetrics;
  bookingTrends: TimeSeriesDataPoint[];
  peakHours: PeakHoursDataPoint[];
  recentActivity: Array<{
    id: string;
    type: 'booking' | 'payment' | 'refund';
    title: string;
    reference: string;
    timestamp: string;
    amount?: number;
    currency?: string;
    status: string;
    customerName?: string;
    facilityName?: string;
  }>;
}

export type ReportExportFormat = 'csv' | 'json';

// ============================================================================
// STEP 10 — Platform Administration, Organization Settings & Audit System Types
// ============================================================================

export interface BookingOperationalSettings {
  min_booking_duration_minutes: number;
  max_booking_duration_minutes: number;
  hold_duration_minutes: number;
  cancellation_window_hours: number;
  buffer_minutes: number;
  allow_auto_confirm: boolean;
}

export interface PaymentOperationalSettings {
  enabled_methods: string[];
  allow_offline_payments: boolean;
  offline_payment_instructions?: string | null;
  tax_registration_number?: string | null;
}

export interface NotificationOperationalSettings {
  email_enabled: boolean;
  sms_enabled: boolean;
  booking_confirmation_enabled: boolean;
  hold_reminder_enabled: boolean;
  marketing_consent_required: boolean;
}

export interface OrganizationOperationalSettings {
  booking: BookingOperationalSettings;
  payment: PaymentOperationalSettings;
  notifications: NotificationOperationalSettings;
}

export interface OrganizationWithSettings extends Organization {
  settings?: OrganizationOperationalSettings;
}

export interface OrganizationMemberWithProfile {
  id: string;
  organization_id: string;
  user_id: string;
  role: AppRole;
  status: MemberStatus;
  joined_at: string;
  created_at: string;
  updated_at: string;
  profile: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string | null;
    phone?: string | null;
  };
}

export type AuditAction =
  | 'ORGANIZATION_PROFILE_UPDATED'
  | 'ORGANIZATION_SETTINGS_UPDATED'
  | 'CUSTOMER_PROFILE_UPDATED'
  | 'MEMBER_INVITED'
  | 'MEMBER_ROLE_UPDATED'
  | 'MEMBER_STATUS_UPDATED'
  | 'MEMBER_REMOVED'
  | 'VENUE_CREATED'
  | 'VENUE_UPDATED'
  | 'VENUE_STATUS_UPDATED'
  | 'FACILITY_CREATED'
  | 'FACILITY_UPDATED'
  | 'PRICING_RULE_CREATED'
  | 'PRICING_RULE_UPDATED'
  | 'PRICING_RULE_DELETED'
  | 'MAINTENANCE_BLOCK_CREATED'
  | 'MAINTENANCE_BLOCK_CANCELLED'
  | 'BOOKING_CANCELLED_BY_ADMIN'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED';

export interface AuditLog {
  id: string;
  organization_id: string | null;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogWithActor extends AuditLog {
  actor?: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string | null;
  } | null;
}

export interface AuditLogFilterParams {
  organizationId?: string;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// STEP 11 — Customer Account, Booking History & Experience Types
// ============================================================================

export interface CustomerAccountProfile {
  id: string;
  email: string;
  full_name: string;
  display_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country_code: string;
  preferred_language: string;
  timezone: string;
  is_active: boolean;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAccountStats {
  totalBookings: number;
  completedBookings: number;
  upcomingBookings: number;
  cancelledBookings: number;
  activeHolds: number;
  totalAmountPaid: number;
  currency: string;
}

export interface CustomerBookingHistoryItem {
  id: string;
  reference: string;
  organization_id: string;
  venue_id: string;
  facility_id: string;
  customer_user_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: BookingStatus;
  total_price: number;
  currency: string;
  notes?: string | null;
  hold_expires_at?: string | null;
  created_at: string;
  venue?: {
    id: string;
    name: string;
    slug: string;
    address: string;
    city: string;
    timezone: string;
    phone?: string | null;
  } | null;
  facility?: {
    id: string;
    name: string;
    facility_type: string;
  } | null;
  payment?: {
    id: string;
    transaction_reference: string;
    payment_method: string;
    payment_provider: string;
    status: string;
    amount: number;
    currency: string;
    paid_at?: string | null;
  } | null;
}

export interface CustomerReceipt {
  bookingId: string;
  reference: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  bookingStatus: BookingStatus;
  totalPrice: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  organizationName: string;
  organizationEmail?: string | null;
  organizationPhone?: string | null;
  venueName: string;
  venueAddress: string;
  facilityName: string;
  facilityType: string;
  paymentReference?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  paidAt?: string | null;
  issuedAt: string;
}

