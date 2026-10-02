/**
 * Supabase Environment Variable Validation & Safe Accessors
 *
 * Ensures all Supabase environment variables are validated before client initialization.
 * Never leaks secret keys or values in logs or exception messages.
 */

import { supabasePublicEnvSchema, supabaseServerEnvSchema, type SupabasePublicEnv, type SupabaseServerEnv } from '@sportshub/validation';

/**
 * Check if the public Supabase environment variables are configured and valid
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('placeholder')) {
    return false;
  }

  const result = supabasePublicEnvSchema.safeParse({ url, anonKey });
  return result.success;
}

/**
 * Retrieve validated public Supabase configuration (URL & Anon Key).
 * Safe for both browser and server environments.
 */
export function getSupabasePublicConfig(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-build-and-testing-only';

  const result = supabasePublicEnvSchema.safeParse({ url, anonKey });

  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(
      `[SportsHub] Supabase public environment configuration error. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are properly set in .env.local. Details: ${errorDetails}`
    );
  }

  return result.data;
}

/**
 * Retrieve validated server-only Supabase configuration (URL & Service Role Key).
 *
 * SECURITY:
 * - NEVER import or invoke in client-side code or browser components.
 * - Throws an error immediately if invoked in a browser environment.
 */
export function getSupabaseServerConfig(): SupabaseServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[SportsHub Security Violation] Attempted to access Supabase server configuration (service-role key) in a browser/client environment.'
    );
  }

  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result = supabaseServerEnvSchema.safeParse({ url, serviceRoleKey });

  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(
      `[SportsHub] Supabase server environment configuration error. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your server environment. Details: ${errorDetails}`
    );
  }

  return result.data;
}
