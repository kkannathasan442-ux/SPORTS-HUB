-- ============================================================================
-- Migration: 002_enums.sql
-- Description: Core PostgreSQL controlled enums for SportsHub
-- ============================================================================

-- Organization Lifecycle Status
CREATE TYPE public.organization_status AS ENUM (
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

-- Organization Member Status
CREATE TYPE public.member_status AS ENUM (
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'REMOVED'
);

-- Application Roles (Platform & Tenant)
CREATE TYPE public.app_role AS ENUM (
  'SUPER_ADMIN',
  'OWNER',
  'MANAGER',
  'RECEPTIONIST',
  'SCORER',
  'COACH',
  'CUSTOMER',
  'PLAYER'
);

-- Physical Venue Status
CREATE TYPE public.venue_status AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'ARCHIVED'
);

-- Facility / Court Availability Status
CREATE TYPE public.facility_status AS ENUM (
  'AVAILABLE',
  'MAINTENANCE',
  'BLOCKED',
  'CLOSED',
  'ARCHIVED'
);

-- Pricing Rule Tier Type
CREATE TYPE public.pricing_type AS ENUM (
  'BASE',
  'PEAK',
  'OFF_PEAK',
  'MEMBER',
  'WEEKEND',
  'HOLIDAY',
  'CUSTOM'
);

-- Maintenance Block Status
CREATE TYPE public.maintenance_block_status AS ENUM (
  'ACTIVE',
  'CANCELLED',
  'COMPLETED'
);
