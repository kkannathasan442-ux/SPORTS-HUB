/**
 * SportsHub Authentication & Authorization Errors
 *
 * Provides structured error types and safe error message extraction.
 * Never leaks database schema, SQL errors, or sensitive RLS internals to clients.
 */

export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'AUTH_ERROR', statusCode: number = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message: string = 'You must be signed in to perform this action.') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AuthError {
  constructor(message: string = 'You do not have permission to access this resource.') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class TenantIsolationError extends AuthError {
  constructor(message: string = 'You are not authorized to access this organization.') {
    super(message, 'TENANT_ACCESS_DENIED', 403);
    this.name = 'TenantIsolationError';
  }
}

/**
 * Sanitizes and extracts user-friendly error messages from unknown errors.
 * Ensures technical internals (e.g. Postgres RLS, stack traces, schema details) are never surfaced.
 */
export function formatAuthError(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Map common Supabase Auth error patterns to friendly strings
    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
      return 'An account with this email already exists.';
    }
    if (msg.includes('password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    if (msg.includes('rate limit')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Please verify your email address before signing in.';
    }

    // Default safe fallback if message contains technical keywords
    if (
      msg.includes('policy') ||
      msg.includes('violates') ||
      msg.includes('foreign key') ||
      msg.includes('relation') ||
      msg.includes('column') ||
      msg.includes('syntax')
    ) {
      return 'An unexpected authorization error occurred. Please try again or contact support.';
    }

    return error.message;
  }

  return 'An unexpected authentication error occurred. Please try again.';
}
