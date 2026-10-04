-- ============================================================================
-- Migration: 024_teams_and_rosters.sql
-- Description: Player, Team & Sports Participation Management
-- ============================================================================

-- Create Enums
CREATE TYPE public.team_role AS ENUM (
  'CAPTAIN',
  'MANAGER',
  'PLAYER'
);

CREATE TYPE public.team_invite_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED'
);

-- Teams Table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  logo_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team Members Table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.team_role NOT NULL DEFAULT 'PLAYER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_user UNIQUE (team_id, user_id)
);

-- Team Invitations Table
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.team_invite_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to prevent duplicate pending invitations for the same email + team
CREATE UNIQUE INDEX idx_team_invitations_unique_pending 
ON public.team_invitations (team_id, invited_email) 
WHERE status = 'PENDING';

-- Triggers for updated_at
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_team_invitations_updated_at
  BEFORE UPDATE ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_teams_organization_id ON public.teams(organization_id);
CREATE INDEX idx_teams_created_by ON public.teams(created_by);
CREATE INDEX idx_teams_sport_id ON public.teams(sport_id);

CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_role ON public.team_members(role);

CREATE INDEX idx_team_invitations_team_id ON public.team_invitations(team_id);
CREATE INDEX idx_team_invitations_invited_email ON public.team_invitations(invited_email);
CREATE INDEX idx_team_invitations_status ON public.team_invitations(status);

-- RLS POLICIES

-- Teams Policies
-- Anyone authenticated can view teams (needed for invitations and discovery).
CREATE POLICY "Authenticated users can view active teams"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE OR created_by = auth.uid());

-- Server handles INSERT and UPDATE securely, but allow members to update if they are CAPTAIN
-- UI relies heavily on server operations, but we can set basic RLS.
CREATE POLICY "Captains can update teams"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members 
      WHERE team_members.team_id = teams.id 
      AND team_members.user_id = auth.uid() 
      AND team_members.role = 'CAPTAIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members 
      WHERE team_members.team_id = teams.id 
      AND team_members.user_id = auth.uid() 
      AND team_members.role = 'CAPTAIN'
    )
  );

-- Team Members Policies
-- Authenticated users can view team members
CREATE POLICY "Authenticated users can view team members"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT / UPDATE / DELETE allowed for normal clients on team_members. Must be done via service_role API.

-- Team Invitations Policies
-- Can view if they are a manager/captain of the team OR if their email matches
CREATE POLICY "Users can view relevant invitations"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (
    invited_email = auth.email() OR 
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.team_members 
      WHERE team_members.team_id = team_invitations.team_id 
      AND team_members.user_id = auth.uid() 
      AND team_members.role IN ('CAPTAIN', 'MANAGER')
    )
  );

-- No INSERT / UPDATE / DELETE allowed for normal clients on team_invitations. Must be done via service_role API.

-- Comments
COMMENT ON TABLE public.teams IS 'Sports teams (either globally customer-owned or organization-scoped)';
COMMENT ON TABLE public.team_members IS 'Many-to-many relationship mapping profiles to teams with roles';
COMMENT ON TABLE public.team_invitations IS 'Invitations to join a team sent via email';
