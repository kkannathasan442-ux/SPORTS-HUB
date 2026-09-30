/**
 * @sportshub/validation
 * Shared Zod validation schemas for SportsHub
 */

import { z } from 'zod';

export const systemStatusSchema = z.enum(['OK', 'DEGRADED', 'MAINTENANCE']);

export const healthCheckSchema = z.object({
  status: systemStatusSchema,
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  service: z.string().min(1),
  environment: z.string().min(1),
});

export const sportTypeSchema = z.enum([
  'cricket',
  'badminton',
  'basketball',
  'table_tennis',
  'chess',
  'carrom',
]);

export const userRoleSchema = z.enum([
  'customer',
  'venue_owner',
  'manager',
  'receptionist',
  'scorer',
  'coach',
  'super_admin',
  'public_user',
]);

export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type HealthCheckInput = z.infer<typeof healthCheckSchema>;
