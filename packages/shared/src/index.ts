/**
 * @sportshub/shared
 * Shared generic utilities for SportsHub
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_CONFIG } from '@sportshub/config';

/**
 * Merge Tailwind and conditional CSS classes safely
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format currency with locale and defaults
 */
export function formatCurrency(
  amount: number,
  currency: string = APP_CONFIG.defaultCurrency,
  locale: string = 'en-LK'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Capitalize first letter of words
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Sleep utility for retry / async delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
