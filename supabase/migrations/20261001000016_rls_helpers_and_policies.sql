-- ============================================================================
-- Migration: 016_rls_helpers_and_policies.sql
-- Description: Core PostgreSQL RLS helper functions and multi-tenant security policies
-- ============================================================================

-- ============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================

-- Check if authenticated user holds an active SUPER_ADMIN role
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND role = 'SUPER_ADMIN'::public.app_role
      AND status = 'ACTIVE'::public.member_status
  );
$$;

COMMENT ON FUNCTION public.is_super_admin() IS 'Returns TRUE if the authenticated user has an ACTIVE platform SUPER_ADMIN role.';

-- Check if authenticated user is an ACTIVE member of a target organization
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE'::public.member_status
  );
$$;

COMMENT ON FUNCTION public.is_org_member(UUID) IS 'Returns TRUE if the authenticated user is an ACTIVE member of the target organization.';

-- Check if authenticated user holds one of the specified active roles within a target organization
CREATE OR REPLACE FUNCTION public.has_org_role(target_org_id UUID, target_roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
      AND role = ANY(target_roles)
      AND status = 'ACTIVE'::public.member_status
  );
$$;

COMMENT ON FUNCTION public.has_org_role(UUID, public.app_role[]) IS 'Returns TRUE if the authenticated user has any of the specified roles and is ACTIVE in the target organization.';

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. PROFILES POLICIES
-- ============================================================================

CREATE POLICY "profiles_select_own_or_superadmin_or_colleagues"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om1
      JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
        AND om1.status = 'ACTIVE'::public.member_status
        AND om2.user_id = public.profiles.id
        AND om2.status = 'ACTIVE'::public.member_status
    )
  );

CREATE POLICY "profiles_insert_own_or_superadmin"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    OR public.is_super_admin()
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own_or_superadmin"
  ON public.profiles
  FOR DELETE
  USING (
    auth.uid() = id
    OR public.is_super_admin()
  );

-- ============================================================================
-- 4. ORGANIZATIONS POLICIES
-- ============================================================================

CREATE POLICY "organizations_select_active_members_or_superadmin"
  ON public.organizations
  FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_org_member(id)
  );

CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR public.is_super_admin()
  );

CREATE POLICY "organizations_update_owner_or_manager"
  ON public.organizations
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR public.has_org_role(id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

CREATE POLICY "organizations_delete_owner_or_superadmin"
  ON public.organizations
  FOR DELETE
  USING (
    public.is_super_admin()
    OR public.has_org_role(id, ARRAY['OWNER'::public.app_role])
  );

-- ============================================================================
-- 5. ORGANIZATION MEMBERS POLICIES
-- ============================================================================

CREATE POLICY "org_members_select_own_or_co_members_or_superadmin"
  ON public.organization_members
  FOR SELECT
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "org_members_insert_authorized_staff"
  ON public.organization_members
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
      AND role NOT IN ('SUPER_ADMIN'::public.app_role, 'OWNER'::public.app_role)
    )
  );

CREATE POLICY "org_members_update_owner_or_superadmin"
  ON public.organization_members
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR (
      public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role])
      AND user_id != auth.uid()
      AND role != 'SUPER_ADMIN'::public.app_role
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role])
      AND user_id != auth.uid()
      AND role != 'SUPER_ADMIN'::public.app_role
    )
  );

CREATE POLICY "org_members_delete_owner_or_superadmin"
  ON public.organization_members
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (
      public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role])
      AND user_id != auth.uid()
    )
  );

-- ============================================================================
-- 6. VENUES POLICIES
-- ============================================================================

CREATE POLICY "venues_select_member_or_superadmin"
  ON public.venues
  FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "venues_insert_owner_manager_or_superadmin"
  ON public.venues
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

CREATE POLICY "venues_update_owner_manager_or_superadmin"
  ON public.venues
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

CREATE POLICY "venues_delete_owner_or_superadmin"
  ON public.venues
  FOR DELETE
  USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role])
  );

-- ============================================================================
-- 7. SPORTS POLICIES (Global Platform Catalog)
-- ============================================================================

CREATE POLICY "sports_select_active_or_superadmin"
  ON public.sports
  FOR SELECT
  USING (
    is_active = TRUE
    OR public.is_super_admin()
  );

CREATE POLICY "sports_insert_superadmin_only"
  ON public.sports
  FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sports_update_superadmin_only"
  ON public.sports
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sports_delete_superadmin_only"
  ON public.sports
  FOR DELETE
  USING (public.is_super_admin());

-- ============================================================================
-- 8. VENUE SPORTS POLICIES
-- ============================================================================

CREATE POLICY "venue_sports_select_member_or_superadmin"
  ON public.venue_sports
  FOR SELECT
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_sports.venue_id
        AND public.is_org_member(v.organization_id)
    )
  );

CREATE POLICY "venue_sports_insert_owner_manager_or_superadmin"
  ON public.venue_sports
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_sports.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

CREATE POLICY "venue_sports_update_owner_manager_or_superadmin"
  ON public.venue_sports
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_sports.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_sports.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

CREATE POLICY "venue_sports_delete_owner_manager_or_superadmin"
  ON public.venue_sports
  FOR DELETE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_sports.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

-- ============================================================================
-- 9. FACILITIES POLICIES
-- ============================================================================

CREATE POLICY "facilities_select_member_or_superadmin"
  ON public.facilities
  FOR SELECT
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.facilities.venue_id
        AND public.is_org_member(v.organization_id)
    )
  );

CREATE POLICY "facilities_insert_owner_manager_or_superadmin"
  ON public.facilities
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.facilities.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

CREATE POLICY "facilities_update_owner_manager_or_superadmin"
  ON public.facilities
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.facilities.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.facilities.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

CREATE POLICY "facilities_delete_owner_manager_or_superadmin"
  ON public.facilities
  FOR DELETE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.facilities.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

-- ============================================================================
-- 10. VENUE OPERATING HOURS POLICIES
-- ============================================================================

CREATE POLICY "operating_hours_select_member_or_superadmin"
  ON public.venue_operating_hours
  FOR SELECT
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_operating_hours.venue_id
        AND public.is_org_member(v.organization_id)
    )
  );

CREATE POLICY "operating_hours_insert_owner_manager_or_superadmin"
  ON public.venue_operating_hours
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_operating_hours.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

CREATE POLICY "operating_hours_update_owner_manager_or_superadmin"
  ON public.venue_operating_hours
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_operating_hours.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_operating_hours.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

CREATE POLICY "operating_hours_delete_owner_manager_or_superadmin"
  ON public.venue_operating_hours
  FOR DELETE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = public.venue_operating_hours.venue_id
        AND public.has_org_role(v.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
    )
  );

-- ============================================================================
-- 11. PRICING RULES POLICIES
-- ============================================================================

CREATE POLICY "pricing_rules_select_member_or_superadmin"
  ON public.pricing_rules
  FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "pricing_rules_insert_owner_manager_or_superadmin"
  ON public.pricing_rules
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

CREATE POLICY "pricing_rules_update_owner_manager_or_superadmin"
  ON public.pricing_rules
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

CREATE POLICY "pricing_rules_delete_owner_manager_or_superadmin"
  ON public.pricing_rules
  FOR DELETE
  USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

-- ============================================================================
-- 12. MAINTENANCE BLOCKS POLICIES
-- ============================================================================

CREATE POLICY "maintenance_blocks_select_member_or_superadmin"
  ON public.maintenance_blocks
  FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "maintenance_blocks_insert_owner_manager_or_superadmin"
  ON public.maintenance_blocks
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

CREATE POLICY "maintenance_blocks_update_owner_manager_or_superadmin"
  ON public.maintenance_blocks
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

CREATE POLICY "maintenance_blocks_delete_owner_manager_or_superadmin"
  ON public.maintenance_blocks
  FOR DELETE
  USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role])
  );

-- ============================================================================
-- 13. CUSTOMER PROFILES POLICIES
-- ============================================================================

CREATE POLICY "customer_profiles_select_own_or_superadmin"
  ON public.customer_profiles
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

CREATE POLICY "customer_profiles_insert_own_or_superadmin"
  ON public.customer_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

CREATE POLICY "customer_profiles_update_own_or_superadmin"
  ON public.customer_profiles
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_super_admin()
  );

CREATE POLICY "customer_profiles_delete_own_or_superadmin"
  ON public.customer_profiles
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.is_super_admin()
  );
