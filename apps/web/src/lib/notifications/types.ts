/**
 * @sportshub/web - Notifications & Communication Engine Types & Constants
 */

export {
  notificationTypeSchema,
  notificationChannelSchema,
  notificationStatusSchema,
  createNotificationSchema,
  updateNotificationPreferencesSchema,
  notificationQuerySchema,
  type NotificationTypeSchema,
  type NotificationChannelSchema,
  type NotificationStatusSchema,
  type CreateNotificationSchema,
  type UpdateNotificationPreferencesSchema,
  type NotificationQuerySchema,
} from '@sportshub/validation';

export type {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  Notification,
  NotificationPreference,
  CreateNotificationInput,
  NotificationFilterParams,
  UpdateNotificationPreferencesInput,
} from '@sportshub/types';

export const NOTIFICATION_ERRORS = {
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_INPUT: 'INVALID_INPUT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  FAILED_TO_DISPATCH: 'FAILED_TO_DISPATCH',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
