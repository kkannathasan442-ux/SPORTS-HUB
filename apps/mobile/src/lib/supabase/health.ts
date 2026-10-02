/**
 * Mobile Supabase Connectivity Check (Development & Diagnostics)
 *
 * Lightweight harmless check to verify Mobile <-> Supabase connectivity.
 * Never leaks keys, sensitive database information, or tokens.
 */

import { isMobileSupabaseConfigured, getMobileSupabaseConfig } from './env';

export interface MobileSupabaseHealth {
  configured: boolean;
  connected: boolean;
  status: 'connected' | 'not_configured' | 'disconnected';
  message: string;
  latencyMs?: number;
}

/**
 * Checks Supabase connectivity from mobile client safely
 */
export async function checkMobileSupabaseConnectivity(): Promise<MobileSupabaseHealth> {
  if (!isMobileSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      status: 'not_configured',
      message: 'Mobile Supabase environment variables not configured.',
    };
  }

  const startTime = Date.now();

  try {
    const { url, anonKey } = getMobileSupabaseConfig();
    const cleanUrl = url.replace(/\/$/, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${cleanUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (response.ok || response.status < 500) {
      return {
        configured: true,
        connected: true,
        status: 'connected',
        message: 'Supabase reachable from mobile client.',
        latencyMs,
      };
    }

    return {
      configured: true,
      connected: false,
      status: 'disconnected',
      message: 'Supabase returned a non-healthy status code.',
      latencyMs,
    };
  } catch {
    const latencyMs = Date.now() - startTime;
    return {
      configured: true,
      connected: false,
      status: 'disconnected',
      message: 'Supabase backend service is currently unreachable from mobile.',
      latencyMs,
    };
  }
}
