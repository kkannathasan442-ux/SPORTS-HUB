/**
 * @sportshub/types
 * Core shared TypeScript types for SportsHub platform
 */

// Foundation Health & System Types
export type SystemStatus = 'OK' | 'DEGRADED' | 'MAINTENANCE';

export interface HealthCheckResponse {
  status: SystemStatus;
  timestamp: string;
  version: string;
  service: string;
  environment: string;
}

// Initial Supported Sports (Foundation)
export type SportType =
  | 'cricket'
  | 'badminton'
  | 'basketball'
  | 'table_tennis'
  | 'chess'
  | 'carrom';

export interface SportInfo {
  id: SportType;
  name: string;
  category: 'team' | 'racquet' | 'indoor' | 'board';
  minPlayers: number;
  maxPlayers: number;
  description: string;
}

// Platform User Roles (Foundation Architecture)
export type UserRole =
  | 'customer'
  | 'venue_owner'
  | 'manager'
  | 'receptionist'
  | 'scorer'
  | 'coach'
  | 'super_admin'
  | 'public_user';

// Generic Entity Baseline
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Generic API Envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
