/**
 * SportsHub Mobile Auth Foundation
 *
 * Client-side authentication helpers for React Native / Expo.
 * Strictly uses public anon keys and Expo-safe storage.
 */

import { getMobileSupabaseClient } from '../supabase/client';

export interface MobileAuthResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Sign in using email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<MobileAuthResponse> {
  try {
    const supabase = getMobileSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Mobile sign in failed.',
    };
  }
}

/**
 * Sign up a customer account from mobile app
 */
export async function signUpCustomer(
  fullName: string,
  email: string,
  password: string,
  phone?: string
): Promise<MobileAuthResponse> {
  try {
    const supabase = getMobileSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Customer registration failed.',
    };
  }
}

/**
 * Sign out and clear active session
 */
export async function signOutMobile(): Promise<MobileAuthResponse> {
  try {
    const supabase = getMobileSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Sign out failed.',
    };
  }
}

/**
 * Get active session
 */
export async function getMobileSession() {
  try {
    const supabase = getMobileSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
}
