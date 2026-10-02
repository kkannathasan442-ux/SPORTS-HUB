/**
 * Type declarations for Mobile (Expo) environment variables.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly NEXT_PUBLIC_SUPABASE_URL?: string;
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly SUPABASE_URL?: string;
    readonly SUPABASE_ANON_KEY?: string;
  }
}

declare var process: {
  env: NodeJS.ProcessEnv;
};
