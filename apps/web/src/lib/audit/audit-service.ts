/**
 * SportsHub Centralized Audit Logging Service — STEP 10
 *
 * Provides append-only, tenant-isolated audit log creation and queries.
 * Enforces strict non-secret sanitization (no passwords, tokens, payment secrets).
 */

import { createSupabaseServerClient } from '../supabase/server';
import type {
  AuditLog,
  AuditLogWithActor,
  AuditLogFilterParams,
  AuditAction,
} from '@sportshub/types';

// Sensitive keys to automatically redact from audit payloads
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'secret_key',
  'apikey',
  'api_key',
  'authorization',
  'card_number',
  'cvv',
  'credit_card',
]);

/**
 * Recursively sanitizes data payloads to ensure sensitive information is never audited
 */
export function sanitizeAuditData<T>(data: T): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

export interface CreateAuditLogParams {
  organizationId?: string | null;
  actorUserId: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/**
 * Creates an immutable audit log entry.
 * Guarantees sanitization of all payload data before writing.
 */
export async function createAuditLog(
  params: CreateAuditLogParams
): Promise<AuditLog | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const sanitizedBefore = params.beforeData ? sanitizeAuditData(params.beforeData) : null;
    const sanitizedAfter = params.afterData ? sanitizeAuditData(params.afterData) : null;
    const sanitizedMetadata = params.metadata ? sanitizeAuditData(params.metadata) : {};

    const payload = {
      organization_id: params.organizationId || null,
      actor_user_id: params.actorUserId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      before_data: sanitizedBefore,
      after_data: sanitizedAfter,
      metadata: sanitizedMetadata,
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to create audit log entry:', error);
      return null;
    }

    return data as AuditLog;
  } catch (err) {
    console.error('Audit logging error:', err);
    return null;
  }
}

/**
 * Queries paginated audit logs for an organization.
 * Includes actor profile details (name, email, avatar).
 */
export async function fetchOrganizationAuditLogs(
  organizationId: string,
  filters: AuditLogFilterParams = {}
): Promise<{ logs: AuditLogWithActor[]; total: number; page: number; limit: number; totalPages: number }> {
  const supabase = await createSupabaseServerClient();
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('audit_logs')
    .select(
      `
      id,
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data,
      metadata,
      created_at,
      actor:profiles!actor_user_id(id, email, full_name, avatar_url)
    `,
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  if (filters.actorUserId) {
    query = query.eq('actor_user_id', filters.actorUserId);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching audit logs:', error);
    return { logs: [], total: 0, page, limit, totalPages: 0 };
  }

  const logs = (data || []).map((item: any) => ({
    id: item.id,
    organization_id: item.organization_id,
    actor_user_id: item.actor_user_id,
    action: item.action,
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    before_data: item.before_data,
    after_data: item.after_data,
    metadata: item.metadata || {},
    created_at: item.created_at,
    actor: item.actor || null,
  })) as AuditLogWithActor[];

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return { logs, total, page, limit, totalPages };
}
