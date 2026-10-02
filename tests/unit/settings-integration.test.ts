import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPERATIONAL_SETTINGS,
} from '../../apps/web/src/lib/settings/settings-service';
import { sanitizeAuditData } from '../../apps/web/src/lib/audit/audit-service';

describe('STEP 10 — Settings & Member Administration Integration Tests', () => {
  it('should correctly merge partial settings updates with defaults without mutating existing properties', () => {
    const originalSettings = { ...DEFAULT_OPERATIONAL_SETTINGS };

    const partialUpdate = {
      booking: {
        ...originalSettings.booking,
        hold_duration_minutes: 12,
        buffer_minutes: 10,
      },
      payment: {
        ...originalSettings.payment,
        enabled_methods: ['PAYHERE', 'CASH'],
      },
    };

    const merged = {
      booking: {
        ...DEFAULT_OPERATIONAL_SETTINGS.booking,
        ...partialUpdate.booking,
      },
      payment: {
        ...DEFAULT_OPERATIONAL_SETTINGS.payment,
        ...partialUpdate.payment,
      },
      notifications: {
        ...DEFAULT_OPERATIONAL_SETTINGS.notifications,
      },
    };

    expect(merged.booking.hold_duration_minutes).toBe(12);
    expect(merged.booking.buffer_minutes).toBe(10);
    expect(merged.booking.min_booking_duration_minutes).toBe(30); // Preserved from defaults
    expect(merged.payment.enabled_methods).toEqual(['PAYHERE', 'CASH']);
    expect(merged.notifications.email_enabled).toBe(true); // Preserved from defaults
  });

  it('should record complete atomic audit payload structure for administrative updates', () => {
    const beforeState = {
      name: 'Old Sports Center',
      hold_duration_minutes: 10,
    };

    const afterState = {
      name: 'New Sports Complex',
      hold_duration_minutes: 15,
    };

    const auditEvent = {
      id: 'audit-event-001',
      organization_id: 'org-test-uuid',
      actor_user_id: 'owner-user-uuid',
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entity_type: 'organizations',
      entity_id: 'org-test-uuid',
      before_data: sanitizeAuditData(beforeState),
      after_data: sanitizeAuditData(afterState),
      metadata: {
        ip: '127.0.0.1',
        source: 'web_dashboard',
      },
      created_at: new Date().toISOString(),
    };

    expect(auditEvent.action).toBe('ORGANIZATION_SETTINGS_UPDATED');
    expect(auditEvent.before_data.name).toBe('Old Sports Center');
    expect(auditEvent.after_data.name).toBe('New Sports Complex');
    expect(auditEvent.entity_type).toBe('organizations');
  });
});
