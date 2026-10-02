/**
 * Supabase Admin / Service-Role Client Foundation
 *
 * CRITICAL SECURITY RULES:
 * - Server-only: Strictly forbidden in client components, browser bundles, or mobile applications.
 * - Uses SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security (RLS) for administrative workflows.
 * - Do NOT use for standard client requests or business logic in STEP 1.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerConfig } from './env';

let adminClientInstance: SupabaseClient | null = null;

/**
 * Creates or retrieves the singleton Supabase Service-Role Admin Client.
 *
 * Throws an explicit error if invoked in browser or without required server secrets.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[SportsHub Security Violation] Supabase admin client (service-role) cannot be used in a browser or client environment.'
    );
  }

  if (!adminClientInstance) {
    const { url, serviceRoleKey } = getSupabaseServerConfig();

    adminClientInstance = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClientInstance;
}
