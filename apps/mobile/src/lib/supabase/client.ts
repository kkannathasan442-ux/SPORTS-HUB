/**
 * Mobile (Expo) Supabase Client
 *
 * Configures the Supabase client for React Native / Expo.
 * Strictly uses public anon keys and Expo-safe configuration.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMobileSupabaseConfig, isMobileSupabaseConfigured } from './env';

let mobileClientInstance: SupabaseClient | null = null;

/**
 * Creates a mobile Supabase client instance
 */
export function createMobileSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getMobileSupabaseConfig();

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Returns the singleton mobile Supabase client
 */
export function getMobileSupabaseClient(): SupabaseClient {
  if (!isMobileSupabaseConfigured()) {
    throw new Error(
      '[SportsHub Mobile] Cannot initialize Supabase client: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is not configured.'
    );
  }

  if (!mobileClientInstance) {
    mobileClientInstance = createMobileSupabaseClient();
  }

  return mobileClientInstance;
}
