/**
 * Supabase Browser Client
 *
 * Client-side Supabase client for Next.js browser execution and Client Components.
 * Uses only public anon credentials (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig, isSupabaseConfigured } from './env';

let browserClientInstance: SupabaseClient | null = null;

/**
 * Creates a new Supabase browser client.
 * Returns null if Supabase is not configured yet (graceful degradation in local dev without env).
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}

/**
 * Returns a singleton browser client instance for React client components.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '[SportsHub] Cannot initialize Supabase browser client: environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing.'
    );
  }

  if (!browserClientInstance) {
    browserClientInstance = createSupabaseBrowserClient();
  }

  return browserClientInstance;
}
