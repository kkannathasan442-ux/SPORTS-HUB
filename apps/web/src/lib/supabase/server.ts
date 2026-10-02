/**
 * Supabase Server Client
 *
 * Server-side Supabase client for Next.js App Router (Server Components, Route Handlers, Server Actions).
 * Uses public anon credentials + server-side cookie store to preserve user sessions safely.
 * Never exposes the service-role key to end users.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from './env';

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Creates a server-side Supabase client with Next.js cookie handling
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Gracefully handle invocation outside active request context (e.g. tests or build)
  }
  const { url, anonKey } = getSupabasePublicConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll?.() || [];
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore?.set?.(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This is safe to ignore if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
