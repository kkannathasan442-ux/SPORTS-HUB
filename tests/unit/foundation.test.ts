import { describe, it, expect } from 'vitest';
import { APP_CONFIG, INITIAL_SPORTS, ROUTES } from '@sportshub/config';
import { healthCheckSchema, sportTypeSchema } from '@sportshub/validation';
import { cn, formatCurrency, capitalize } from '@sportshub/shared';

describe('SportsHub Foundation — STEP 0', () => {
  it('should have valid application metadata and branding', () => {
    expect(APP_CONFIG.name).toBe('SportsHub');
    expect(APP_CONFIG.tagline).toBe('Book. Play. Compete. Connect.');
    expect(APP_CONFIG.defaultCurrency).toBe('LKR');
    expect(APP_CONFIG.defaultTimezone).toBe('Asia/Colombo');
  });

  it('should define all 6 initial sports correctly', () => {
    const sports = Object.keys(INITIAL_SPORTS);
    expect(sports).toEqual([
      'cricket',
      'badminton',
      'basketball',
      'table_tennis',
      'chess',
      'carrom',
    ]);

    sports.forEach((sport) => {
      const parsed = sportTypeSchema.safeParse(sport);
      expect(parsed.success).toBe(true);
      expect(INITIAL_SPORTS[sport as keyof typeof INITIAL_SPORTS].name).toBeDefined();
    });
  });

  it('should validate foundation health check schema', () => {
    const validPayload = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      service: 'sportshub-web',
      environment: 'development',
    };

    const result = healthCheckSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should test shared helper utilities', () => {
    expect(cn('btn', true && 'btn-primary', false && 'btn-disabled')).toBe('btn btn-primary');
    expect(capitalize('cricket')).toBe('Cricket');
    expect(formatCurrency(1500, 'LKR', 'en-LK')).toContain('1,500');
  });

  it('should have essential foundation routes configured', () => {
    expect(ROUTES.HOME).toBe('/');
    expect(ROUTES.HEALTH).toBe('/health');
  });
});
