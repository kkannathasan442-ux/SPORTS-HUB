import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  supabasePublicEnvSchema,
  supabaseServerEnvSchema,
  supabaseHealthSchema,
} from '@sportshub/validation';
import {
  isSupabaseConfigured,
  getSupabasePublicConfig,
  getSupabaseServerConfig,
} from '../../apps/web/src/lib/supabase/env';
import {
  isMobileSupabaseConfigured,
  getMobileSupabaseConfig,
} from '../../apps/mobile/src/lib/supabase/env';

describe('Supabase Environment & Validation — STEP 1', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Zod Schema Validation', () => {
    it('should validate valid public Supabase credentials', () => {
      const valid = {
        url: 'https://xyzproject.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key',
      };

      const result = supabasePublicEnvSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(valid.url);
        expect(result.data.anonKey).toBe(valid.anonKey);
      }
    });

    it('should reject invalid Supabase URLs', () => {
      const invalid = {
        url: 'not-a-valid-url',
        anonKey: 'sample-anon-key',
      };

      const result = supabasePublicEnvSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty anon keys', () => {
      const invalid = {
        url: 'https://xyzproject.supabase.co',
        anonKey: '',
      };

      const result = supabasePublicEnvSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate server-only Supabase credentials', () => {
      const valid = {
        url: 'https://xyzproject.supabase.co',
        serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_role',
      };

      const result = supabaseServerEnvSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject empty service role key', () => {
      const invalid = {
        url: 'https://xyzproject.supabase.co',
        serviceRoleKey: '',
      };

      const result = supabaseServerEnvSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate Supabase health status schemas', () => {
      const connectedHealth = {
        configured: true,
        connected: true,
        status: 'connected' as const,
        message: 'Supabase connection active',
        latencyMs: 35,
      };

      const notConfiguredHealth = {
        configured: false,
        connected: false,
        status: 'not_configured' as const,
        message: 'Credentials missing',
      };

      expect(supabaseHealthSchema.safeParse(connectedHealth).success).toBe(true);
      expect(supabaseHealthSchema.safeParse(notConfiguredHealth).success).toBe(true);
    });
  });

  describe('Web Environment Helpers', () => {
    it('should return false when environment variables are not set', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(isSupabaseConfigured()).toBe(false);
    });

    it('should return true when valid environment variables are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sportshub-test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-12345';

      expect(isSupabaseConfigured()).toBe(true);
      const config = getSupabasePublicConfig();
      expect(config.url).toBe('https://sportshub-test.supabase.co');
      expect(config.anonKey).toBe('test-anon-key-12345');
    });

    it('should throw safe error without leaking raw secret when server config is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sportshub-test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => getSupabaseServerConfig()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY is set/);
    });
  });

  describe('Mobile Environment Helpers', () => {
    it('should return false when mobile environment variables are missing', () => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      expect(isMobileSupabaseConfigured()).toBe(false);
      expect(() => getMobileSupabaseConfig()).toThrowError(/Supabase public configuration is missing/);
    });

    it('should return configuration when EXPO_PUBLIC_* variables are set', () => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://sportshub-mobile.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'expo-anon-key-67890';

      expect(isMobileSupabaseConfigured()).toBe(true);
      const config = getMobileSupabaseConfig();
      expect(config.url).toBe('https://sportshub-mobile.supabase.co');
      expect(config.anonKey).toBe('expo-anon-key-67890');
    });
  });
});
