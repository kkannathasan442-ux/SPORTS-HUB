import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@sportshub/config';
import { checkSupabaseConnectivity } from '@/lib/supabase/health';
import type { HealthCheckResponse } from '@sportshub/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseHealth = await checkSupabaseConnectivity();

  const responsePayload: HealthCheckResponse = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: APP_CONFIG.version,
    service: 'sportshub-web',
    environment: process.env.NODE_ENV || 'development',
    supabase: supabaseHealth,
  };

  return NextResponse.json(responsePayload);
}
