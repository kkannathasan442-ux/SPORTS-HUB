/**
 * SportsHub Web Supabase Module
 */

export * from './env';
export * from './browser';
export * from './server';
export * from './health';
// Note: getSupabaseAdminClient is deliberately NOT exported from the root barrel to prevent accidental bundling in client components.
