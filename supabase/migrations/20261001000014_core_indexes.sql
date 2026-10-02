-- ============================================================================
-- Migration: 014_core_indexes.sql
-- Description: Core performance indexes for SportsHub relational queries
-- ============================================================================

-- Organization Members Indexes
CREATE INDEX idx_organization_members_org_id ON public.organization_members (organization_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members (user_id);
CREATE INDEX idx_organization_members_role ON public.organization_members (role);

-- Venues Indexes
CREATE INDEX idx_venues_organization_id ON public.venues (organization_id);
CREATE INDEX idx_venues_status ON public.venues (status);
CREATE INDEX idx_venues_city ON public.venues (city);
CREATE INDEX idx_venues_district ON public.venues (district);

-- Sports Indexes
CREATE INDEX idx_sports_is_active ON public.sports (is_active);
CREATE INDEX idx_sports_slug ON public.sports (slug);

-- Venue Sports Indexes
CREATE INDEX idx_venue_sports_venue_id ON public.venue_sports (venue_id);
CREATE INDEX idx_venue_sports_sport_id ON public.venue_sports (sport_id);
CREATE INDEX idx_venue_sports_active ON public.venue_sports (is_active);

-- Facilities Indexes
CREATE INDEX idx_facilities_venue_id ON public.facilities (venue_id);
CREATE INDEX idx_facilities_sport_id ON public.facilities (sport_id);
CREATE INDEX idx_facilities_status ON public.facilities (status);
CREATE INDEX idx_facilities_bookable ON public.facilities (is_bookable);

-- Venue Operating Hours Indexes
CREATE INDEX idx_venue_operating_hours_venue_id ON public.venue_operating_hours (venue_id);

-- Pricing Rules Indexes
CREATE INDEX idx_pricing_rules_org_id ON public.pricing_rules (organization_id);
CREATE INDEX idx_pricing_rules_venue_id ON public.pricing_rules (venue_id);
CREATE INDEX idx_pricing_rules_facility_id ON public.pricing_rules (facility_id);
CREATE INDEX idx_pricing_rules_active ON public.pricing_rules (is_active);
CREATE INDEX idx_pricing_rules_type ON public.pricing_rules (pricing_type);

-- Maintenance Blocks Indexes
CREATE INDEX idx_maintenance_blocks_org_id ON public.maintenance_blocks (organization_id);
CREATE INDEX idx_maintenance_blocks_venue_id ON public.maintenance_blocks (venue_id);
CREATE INDEX idx_maintenance_blocks_facility_id ON public.maintenance_blocks (facility_id);
CREATE INDEX idx_maintenance_blocks_time ON public.maintenance_blocks (start_at, end_at);
CREATE INDEX idx_maintenance_blocks_status ON public.maintenance_blocks (status);

-- Customer Profiles Index
CREATE INDEX idx_customer_profiles_user_id ON public.customer_profiles (user_id);
