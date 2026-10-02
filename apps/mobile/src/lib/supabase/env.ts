/**
 * Mobile (Expo) Supabase Environment Configuration
 *
 * Exposes only public, client-safe Supabase configuration for React Native/Expo.
 *
 * CRITICAL SECURITY:
 * - NEVER include or reference server-side administrative keys in mobile code.
 * - Mobile builds are client-side binaries; any bundled secret is publicly readable.
 */

export interface MobileSupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Checks if public Supabase environment variables are provided in Expo environment.
 */
export function isMobileSupabaseConfigured(): boolean {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  return Boolean(url && anonKey && url.startsWith('http'));
}

/**
 * Returns the public Supabase configuration for Expo.
 * Throws a safe configuration error if variables are missing.
 */
export function getMobileSupabaseConfig(): MobileSupabaseConfig {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[SportsHub Mobile] Supabase public configuration is missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.'
    );
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(
      '[SportsHub Mobile] Supabase URL must start with http:// or https://'
    );
  }

  return { url, anonKey };
}
