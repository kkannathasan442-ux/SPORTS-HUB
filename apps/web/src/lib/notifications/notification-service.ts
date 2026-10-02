import { SupabaseClient } from '@supabase/supabase-js';
import {
  createNotificationSchema,
  updateNotificationPreferencesSchema,
  type CreateNotificationSchema,
  type UpdateNotificationPreferencesSchema,
} from '@sportshub/validation';
import type {
  Notification,
  NotificationPreference,
  NotificationFilterParams,
} from '@sportshub/types';
import { NOTIFICATION_ERRORS } from './types';
import { NOTIFICATION_CONFIG } from '@sportshub/config';

/**
 * Creates a single notification record with idempotency protection.
 */
export async function createNotification(
  supabase: SupabaseClient,
  input: CreateNotificationSchema
): Promise<{ success: boolean; notification?: Notification; error?: { code: string; message: string } }> {
  const validated = createNotificationSchema.parse(input);
  const nowIso = new Date().toISOString();

  const insertPayload = {
    organization_id: validated.organizationId || null,
    recipient_user_id: validated.recipientUserId,
    notification_type: validated.notificationType,
    title: validated.title,
    message: validated.message,
    related_entity_type: validated.relatedEntityType,
    related_entity_id: validated.relatedEntityId || null,
    channel: validated.channel || 'IN_APP',
    status: 'SENT',
    idempotency_key: validated.idempotencyKey || null,
    read_at: null,
    metadata: validated.metadata || {},
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    // If duplicate idempotency key, retrieve existing notification safely
    if (error.code === '23505' && validated.idempotencyKey) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('*')
        .eq('idempotency_key', validated.idempotencyKey)
        .maybeSingle();

      if (existing) {
        return { success: true, notification: existing as Notification };
      }
    }

    return {
      success: false,
      error: {
        code: NOTIFICATION_ERRORS.FAILED_TO_DISPATCH,
        message: error.message,
      },
    };
  }

  return {
    success: true,
    notification: data as Notification,
  };
}

/**
 * Creates bulk notifications for multiple recipients (e.g. staff alerts).
 */
export async function createBulkNotifications(
  supabase: SupabaseClient,
  inputs: CreateNotificationSchema[]
): Promise<{ success: boolean; count: number }> {
  if (!inputs || inputs.length === 0) return { success: true, count: 0 };

  const nowIso = new Date().toISOString();
  const rows = inputs.map((input) => {
    const validated = createNotificationSchema.parse(input);
    return {
      organization_id: validated.organizationId || null,
      recipient_user_id: validated.recipientUserId,
      notification_type: validated.notificationType,
      title: validated.title,
      message: validated.message,
      related_entity_type: validated.relatedEntityType,
      related_entity_id: validated.relatedEntityId || null,
      channel: validated.channel || 'IN_APP',
      status: 'SENT',
      idempotency_key: validated.idempotencyKey || null,
      read_at: null,
      metadata: validated.metadata || {},
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  const { error } = await supabase.from('notifications').insert(rows);

  if (error) {
    console.error('Failed to insert bulk notifications:', error);
    return { success: false, count: 0 };
  }

  return { success: true, count: rows.length };
}

/**
 * Retrieves paginated notifications for a user (or authenticated session user).
 */
export async function getUserNotifications(
  supabase: SupabaseClient,
  userIdOrParams?: string | NotificationFilterParams,
  maybeParams?: NotificationFilterParams
): Promise<{
  notifications: Notification[];
  totalCount: number;
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  limit: number;
  totalPages: number;
}> {
  let userId: string | undefined;
  let params: NotificationFilterParams | undefined;

  if (typeof userIdOrParams === 'string') {
    userId = userIdOrParams;
    params = maybeParams;
  } else {
    params = userIdOrParams;
  }

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  const page = params?.page || 1;
  const pageSize = params?.limit || params?.pageSize || NOTIFICATION_CONFIG.PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!userId) {
    return {
      notifications: [],
      totalCount: 0,
      total: 0,
      unreadCount: 0,
      page,
      pageSize,
      limit: pageSize,
      totalPages: 1,
    };
  }

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false });

  if (params?.unreadOnly) {
    query = query.is('read_at', null);
  }

  if (params?.notificationType) {
    query = query.eq('notification_type', params.notificationType);
  }

  if (params?.channel) {
    query = query.eq('channel', params.channel);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('Failed to fetch user notifications:', error);
    return {
      notifications: [],
      totalCount: 0,
      total: 0,
      unreadCount: 0,
      page,
      pageSize,
      limit: pageSize,
      totalPages: 1,
    };
  }

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const unreadCount = await getUnreadCount(supabase, userId);

  return {
    notifications: (data as Notification[]) || [],
    totalCount: total,
    total,
    unreadCount,
    page,
    pageSize,
    limit: pageSize,
    totalPages,
  };
}

/**
 * Fast query for user's unread notification count.
 */
export async function getUnreadCount(
  supabase: SupabaseClient,
  targetUserId?: string
): Promise<number> {
  let userId = targetUserId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('Failed to fetch unread count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Marks a single notification as read by recipient.
 */
export async function markAsRead(
  supabase: SupabaseClient,
  notificationId: string,
  targetUserId?: string
): Promise<Notification | null> {
  let userId = targetUserId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    return null;
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('notifications')
    .update({
      read_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', notificationId)
    .eq('recipient_user_id', userId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as Notification;
}

/**
 * Marks all unread notifications as read for current user.
 */
export async function markAllAsRead(
  supabase: SupabaseClient,
  targetUserId?: string
): Promise<number> {
  let userId = targetUserId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    return 0;
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('notifications')
    .update({
      read_at: nowIso,
      updated_at: nowIso,
    })
    .eq('recipient_user_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) {
    console.error('Failed to mark all notifications as read:', error);
    return 0;
  }

  return data ? data.length : 0;
}

/**
 * Retrieves organization-scoped notifications for staff ledger.
 */
export async function getStaffNotifications(
  supabase: SupabaseClient,
  organizationId: string,
  params?: NotificationFilterParams
): Promise<{
  notifications: Notification[];
  totalCount: number;
  total: number;
  page: number;
  pageSize: number;
  limit: number;
  totalPages: number;
}> {
  const page = params?.page || 1;
  const pageSize = params?.limit || params?.pageSize || NOTIFICATION_CONFIG.PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (params?.notificationType) {
    query = query.eq('notification_type', params.notificationType);
  }

  if (params?.channel) {
    query = query.eq('channel', params.channel);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('Failed to fetch staff notifications:', error);
    return {
      notifications: [],
      totalCount: 0,
      total: 0,
      page,
      pageSize,
      limit: pageSize,
      totalPages: 1,
    };
  }

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    notifications: (data as Notification[]) || [],
    totalCount: total,
    total,
    page,
    pageSize,
    limit: pageSize,
    totalPages,
  };
}

/**
 * Retrieves or initializes default notification preferences for a user.
 */
export async function getUserPreferences(
  supabase: SupabaseClient,
  targetUserId?: string
): Promise<NotificationPreference> {
  let userId = targetUserId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    return {
      id: 'default',
      user_id: 'anonymous',
      email_booking_confirmations: true,
      email_payment_receipts: true,
      email_hold_reminders: true,
      email_cancellations: true,
      in_app_enabled: true,
      promotional_emails: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return existing as NotificationPreference;
  }

  // Insert default preferences if not yet existing
  const nowIso = new Date().toISOString();
  const defaultPayload = {
    user_id: userId,
    email_booking_confirmations: true,
    email_payment_receipts: true,
    email_hold_reminders: true,
    email_cancellations: true,
    in_app_enabled: true,
    promotional_emails: false,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: created } = await supabase
    .from('notification_preferences')
    .insert(defaultPayload)
    .select()
    .maybeSingle();

  return (created as NotificationPreference) || (defaultPayload as any);
}

/**
 * Updates notification preferences for a user.
 */
export async function updateUserPreferences(
  supabase: SupabaseClient,
  userIdOrInput: string | UpdateNotificationPreferencesSchema,
  maybeInput?: UpdateNotificationPreferencesSchema
): Promise<NotificationPreference | null> {
  let userId: string | undefined;
  let rawInput: UpdateNotificationPreferencesSchema;

  if (typeof userIdOrInput === 'string') {
    userId = userIdOrInput;
    rawInput = maybeInput || {};
  } else {
    rawInput = userIdOrInput;
  }

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    return null;
  }

  const validated = updateNotificationPreferencesSchema.parse(rawInput);
  const nowIso = new Date().toISOString();

  // Map both camelCase and snake_case to database column names
  const dbPayload: Record<string, any> = {
    user_id: userId,
    updated_at: nowIso,
  };

  if (validated.email_booking_confirmations !== undefined) {
    dbPayload.email_booking_confirmations = validated.email_booking_confirmations;
  } else if (validated.emailBookingConfirmations !== undefined) {
    dbPayload.email_booking_confirmations = validated.emailBookingConfirmations;
  }

  if (validated.email_payment_receipts !== undefined) {
    dbPayload.email_payment_receipts = validated.email_payment_receipts;
  } else if (validated.emailPaymentReceipts !== undefined) {
    dbPayload.email_payment_receipts = validated.emailPaymentReceipts;
  }

  if (validated.email_hold_reminders !== undefined) {
    dbPayload.email_hold_reminders = validated.email_hold_reminders;
  } else if (validated.emailHoldReminders !== undefined) {
    dbPayload.email_hold_reminders = validated.emailHoldReminders;
  }

  if (validated.email_cancellations !== undefined) {
    dbPayload.email_cancellations = validated.email_cancellations;
  } else if (validated.emailCancellations !== undefined) {
    dbPayload.email_cancellations = validated.emailCancellations;
  }

  if (validated.in_app_enabled !== undefined) {
    dbPayload.in_app_enabled = validated.in_app_enabled;
  } else if (validated.inAppEnabled !== undefined) {
    dbPayload.in_app_enabled = validated.inAppEnabled;
  }

  if (validated.promotional_emails !== undefined) {
    dbPayload.promotional_emails = validated.promotional_emails;
  } else if (validated.promotionalEmails !== undefined) {
    dbPayload.promotional_emails = validated.promotionalEmails;
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(dbPayload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to update preferences:', error);
    return null;
  }

  return data as NotificationPreference;
}
