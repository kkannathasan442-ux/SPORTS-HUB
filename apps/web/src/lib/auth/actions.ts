'use server';

/**
 * SportsHub Authentication Server Actions
 *
 * Provides server-side mutations for login, registration, organization onboarding,
 * and active organization switching with full Zod input validation and tenant safety.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../supabase/server';
import {
  loginSchema,
  customerRegistrationSchema,
  ownerRegistrationSchema,
  activeOrgSelectionSchema,
} from '@sportshub/validation';
import { formatAuthError } from './errors';
import { ACTIVE_ORG_COOKIE_NAME, getCurrentUser } from './current-user';
import { getActiveMemberships } from './membership';

export interface ActionState<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Generates a clean, URL-safe slug from an organization name
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || `org-${Date.now()}`;
}

/**
 * Server Action: Authenticate user with Email and Password
 */
export async function loginAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please fill in all required fields correctly.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: formatAuthError(authError || new Error('Invalid login credentials')),
      };
    }

    // Verify or set active organization cookie if available
    const memberships = await getActiveMemberships(authData.user.id);
    if (memberships.length > 0) {
      cookies().set(ACTIVE_ORG_COOKIE_NAME, memberships[0].organization_id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return {
      success: true,
      message: 'Sign in successful.',
    };
  } catch (err) {
    return {
      success: false,
      error: formatAuthError(err),
    };
  }
}

/**
 * Server Action: Register Customer Account
 */
export async function registerCustomerAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawData = {
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = customerRegistrationSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please correct the highlighted form errors.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { fullName, email, phone, password } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: formatAuthError(authError || new Error('Registration failed.')),
      };
    }

    // Ensure profile row exists
    await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: fullName,
      phone: phone || null,
      is_active: true,
    });

    // Initialize empty customer profile row
    await supabase.from('customer_profiles').upsert({
      user_id: authData.user.id,
    });

    return {
      success: true,
      message: 'Account created successfully.',
    };
  } catch (err) {
    return {
      success: false,
      error: formatAuthError(err),
    };
  }
}

/**
 * Server Action: Register Owner Account & Create Organization
 */
export async function registerOwnerAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState<{ organizationId: string }>> {
  const rawData = {
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
    organizationName: formData.get('organizationName'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = ownerRegistrationSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please correct the highlighted form errors.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { fullName, email, phone, organizationName, password } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    // 1. Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: formatAuthError(authError || new Error('Owner registration failed.')),
      };
    }

    const userId = authData.user.id;

    // 2. Ensure profile exists
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      phone: phone || null,
      is_active: true,
    });

    // 3. Generate safe slug
    let baseSlug = generateSlug(organizationName);
    const slugSuffix = Math.random().toString(36).substring(2, 6);
    const uniqueSlug = `${baseSlug}-${slugSuffix}`;

    // 4. Create organization & owner membership via RPC (or direct insert)
    const { data: orgId, error: rpcError } = await supabase.rpc('create_organization_with_owner', {
      p_name: organizationName,
      p_slug: uniqueSlug,
      p_currency: 'LKR',
      p_timezone: 'Asia/Colombo',
    });

    let createdOrgId = orgId as string | undefined;

    // Fallback direct insert if RPC not present in local mocks
    if (rpcError || !createdOrgId) {
      const { data: insertedOrg, error: orgInsertError } = await supabase
        .from('organizations')
        .insert({
          name: organizationName,
          slug: uniqueSlug,
          status: 'ACTIVE',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        })
        .select('id')
        .single();

      if (orgInsertError || !insertedOrg) {
        return {
          success: false,
          error: formatAuthError(orgInsertError || new Error('Failed to create organization.')),
        };
      }

      createdOrgId = insertedOrg.id;

      await supabase.from('organization_members').insert({
        organization_id: createdOrgId,
        user_id: userId,
        role: 'OWNER',
        status: 'ACTIVE',
      });
    }

    // 5. Store active organization cookie
    if (createdOrgId) {
      cookies().set(ACTIVE_ORG_COOKIE_NAME, createdOrgId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return {
      success: true,
      message: 'Owner registration and organization setup completed.',
      data: { organizationId: createdOrgId || '' },
    };
  } catch (err) {
    return {
      success: false,
      error: formatAuthError(err),
    };
  }
}

/**
 * Server Action: Set Active Organization for Organization Switcher
 */
export async function setActiveOrganizationAction(
  organizationId: string
): Promise<ActionState> {
  const parsed = activeOrgSelectionSchema.safeParse({ organizationId });
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid organization ID provided.',
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      error: 'You must be signed in to select an organization.',
    };
  }

  // Verify that the user has an ACTIVE membership in this organization
  const activeMemberships = await getActiveMemberships(user.id);
  const isValid = activeMemberships.some((m) => m.organization_id === organizationId);

  if (!isValid) {
    return {
      success: false,
      error: 'You do not have an active membership in the selected organization.',
    };
  }

  cookies().set(ACTIVE_ORG_COOKIE_NAME, organizationId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return {
    success: true,
    message: 'Active organization updated.',
  };
}

/**
 * Server Action: Sign Out and Clear Session
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  cookies().delete(ACTIVE_ORG_COOKIE_NAME);
  redirect('/login');
}
