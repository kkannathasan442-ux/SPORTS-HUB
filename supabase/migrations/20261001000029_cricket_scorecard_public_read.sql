-- ============================================================================
-- Migration: 029_cricket_scorecard_public_read.sql
-- Description: STEP 16H — Additive public read access for cricket scorecards and match deliveries
-- ============================================================================

-- 1. Matches: Allow public/spectator read for non-draft matches
DO $$ BEGIN
  CREATE POLICY "matches_select_public"
    ON public.matches
    FOR SELECT
    TO anon, authenticated
    USING (
      status IN ('SCHEDULED', 'WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Match Competitors: Allow public read for non-draft matches
DO $$ BEGIN
  CREATE POLICY "match_competitors_select_public"
    ON public.match_competitors
    FOR SELECT
    TO anon
    USING (
      EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = match_competitors.match_id
        AND m.status IN ('SCHEDULED', 'WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Match Participants: Allow public read for non-draft matches
DO $$ BEGIN
  CREATE POLICY "match_participants_select_public"
    ON public.match_participants
    FOR SELECT
    TO anon
    USING (
      EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = match_participants.match_id
        AND m.status IN ('SCHEDULED', 'WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Cricket Innings: Allow public read for active/completed matches
DO $$ BEGIN
  CREATE POLICY "cricket_innings_select_public"
    ON public.cricket_innings
    FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = cricket_innings.match_id
        AND m.status IN ('WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Cricket Deliveries: Allow public read for active/completed matches
DO $$ BEGIN
  CREATE POLICY "cricket_deliveries_select_public"
    ON public.cricket_deliveries
    FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = cricket_deliveries.match_id
        AND m.status IN ('WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
