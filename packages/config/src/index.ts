/**
 * @sportshub/config
 * Shared configuration and constants for SportsHub platform
 */

import type { SportInfo, SportType } from '@sportshub/types';

export const APP_CONFIG = {
  name: 'SportsHub',
  tagline: 'Book. Play. Compete. Connect.',
  description: 'Multi-tenant sports and recreation platform for bookings, tournaments, coaching, and communities.',
  version: '0.1.0',
  defaultCurrency: 'LKR',
  defaultTimezone: 'Asia/Colombo',
  contactEmail: 'support@sportshub.local',
} as const;

export const INITIAL_SPORTS: Record<SportType, SportInfo> = {
  cricket: {
    id: 'cricket',
    name: 'Cricket',
    category: 'team',
    minPlayers: 2,
    maxPlayers: 22,
    description: 'Nets, turf pitches, full ground matches, and live scoring.',
  },
  badminton: {
    id: 'badminton',
    name: 'Badminton',
    category: 'racquet',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Indoor synthetic & wooden court reservations and doubles tournaments.',
  },
  basketball: {
    id: 'basketball',
    name: 'Basketball',
    category: 'team',
    minPlayers: 2,
    maxPlayers: 10,
    description: 'Full court and half court hourly bookings and pickup games.',
  },
  table_tennis: {
    id: 'table_tennis',
    name: 'Table Tennis',
    category: 'indoor',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'ITTF-standard indoor tables, robot training, and ladder tournaments.',
  },
  chess: {
    id: 'chess',
    name: 'Chess',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Rapid, Blitz, and Classical rated matches and coaching clinics.',
  },
  carrom: {
    id: 'carrom',
    name: 'Carrom',
    category: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Championship powder boards for singles and doubles club matches.',
  },
};

export const ROUTES = {
  HOME: '/',
  HEALTH: '/health',
} as const;
