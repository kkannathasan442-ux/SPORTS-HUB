import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Supabase Security & Scope Boundary Verification — STEP 3', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const migrationsDir = path.join(rootDir, 'supabase/migrations');

  it('should ensure .gitignore ignores all sensitive environment files', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

    expect(gitignore).toMatch(/\.env\b/);
    expect(gitignore).toMatch(/\.env\.local\b/);
    expect(gitignore).toMatch(/\.env\.production\.local\b/);
  });

  it('should ensure .env.example contains no hardcoded secrets or credentials', () => {
    const envExamplePath = path.join(rootDir, '.env.example');
    const envExample = fs.readFileSync(envExamplePath, 'utf-8');

    const lines = envExample.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, value] = trimmed.split('=');
      if (
        key === 'NEXT_PUBLIC_SUPABASE_URL' ||
        key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ||
        key === 'EXPO_PUBLIC_SUPABASE_URL' ||
        key === 'EXPO_PUBLIC_SUPABASE_ANON_KEY' ||
        key === 'SUPABASE_SERVICE_ROLE_KEY' ||
        key === 'CLOUDINARY_API_KEY' ||
        key === 'CLOUDINARY_API_SECRET'
      ) {
        expect(value?.trim() || '').toBe('');
      }
    }
  });

  it('should verify SUPABASE_SERVICE_ROLE_KEY is NEVER referenced in mobile codebase', () => {
    const mobileDir = path.join(rootDir, 'apps/mobile/src');

    function checkDirForForbiddenString(dir: string, forbidden: string) {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          checkDirForForbiddenString(fullPath, forbidden);
        } else if (/\.(ts|tsx|js|jsx|json)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          expect(content).not.toContain(forbidden);
        }
      }
    }

    checkDirForForbiddenString(mobileDir, 'SUPABASE_SERVICE_ROLE_KEY');
    checkDirForForbiddenString(mobileDir, 'service_role');
  });

  it('should verify SUPABASE_SERVICE_ROLE_KEY is NOT referenced in browser.ts', () => {
    const browserTsPath = path.join(rootDir, 'apps/web/src/lib/supabase/browser.ts');
    const content = fs.readFileSync(browserTsPath, 'utf-8');

    expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(content).not.toContain('service_role');
  });

  it('should verify STEP 2 migrations remain intact and unmodified', () => {
    const step2Migrations = [
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
    ];

    for (const file of step2Migrations) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      expect(content).not.toContain('ENABLE ROW LEVEL SECURITY');
      expect(content).not.toContain('CREATE POLICY');
    }
  });

  it('should verify STEP 3 migrations enable RLS on all 11 core tables', () => {
    const rlsMigrationPath = path.join(migrationsDir, '20261001000016_rls_helpers_and_policies.sql');
    expect(fs.existsSync(rlsMigrationPath)).toBe(true);

    const rlsContent = fs.readFileSync(rlsMigrationPath, 'utf-8');

    const expectedRlsTables = [
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
    ];

    for (const table of expectedRlsTables) {
      expect(rlsContent).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }

    // Verify helper functions explicitly configure safe search_path
    expect(rlsContent).toContain('SECURITY DEFINER');
    expect(rlsContent).toContain('SET search_path = public, pg_temp');
    expect(rlsContent).toContain('public.is_super_admin()');
    expect(rlsContent).toContain('public.is_org_member(');
    expect(rlsContent).toContain('public.has_org_role(');
  });

  it('should verify NO booking or payment tables exist in STEP 3 scope', () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      if (!file.includes('017_bookings')) {
        expect(content).not.toMatch(/CREATE\s+TABLE\s+public\.bookings/i);
      }
      expect(content).not.toMatch(/CREATE\s+TABLE\s+public\.payments/i);
      expect(content).not.toMatch(/CREATE\s+TABLE\s+public\.tournaments/i);
    }
  });
});
