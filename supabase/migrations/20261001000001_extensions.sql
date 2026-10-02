-- ============================================================================
-- Migration: 001_extensions.sql
-- Description: Core PostgreSQL extensions and updated_at trigger helper
-- ============================================================================

-- Safely enable UUID and crypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable timestamp trigger function for updated_at columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at() IS 'Standard reusable trigger function to automatically update updated_at timestamp on row modification.';
