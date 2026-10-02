/**
 * Supabase Harmless Connectivity Verification
 *
 * Performs a safe, minimal connectivity check to verify SportsHub <-> Supabase communication.
 * Does NOT query application tables or leak keys, internal URLs, or database details.
 */

import type { SupabaseHealth } from '@sportshub/validation';
import { isSupabaseConfigured, getSupabasePublicConfig } from './env';

/**
 * Checks Supabase backend connectivity safely
 */
export async function checkSupabaseConnectivity(): Promise<SupabaseHealth> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      status: 'not_configured',
      message: 'Supabase credentials are not configured in local environment variables.',
    };
  }

  const startTime = Date.now();

  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const cleanUrl = url.replace(/\/$/, '');

    // Ping the Supabase Auth Health endpoint with a strict 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${cleanUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (response.ok || response.status < 500) {
      return {
        configured: true,
        connected: true,
        status: 'connected',
        message: 'Supabase backend service reachable and operational.',
        latencyMs,
      };
    }

    return {
      configured: true,
      connected: false,
      status: 'disconnected',
      message: 'Supabase backend service returned a non-healthy status code.',
      latencyMs,
    };
  } catch {
    const latencyMs = Date.now() - startTime;
    return {
      configured: true,
      connected: false,
      status: 'disconnected',
      message: 'Supabase backend service is currently unreachable.',
      latencyMs,
    };
  }
}
