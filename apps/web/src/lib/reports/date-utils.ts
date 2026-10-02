import type { TimeRangePreset } from '@sportshub/types';

export interface DateRangeResult {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  preset: TimeRangePreset;
}

/**
 * Resolves a TimeRangePreset into a concrete start and end date (YYYY-MM-DD).
 * Respects the organization's reference date / timezone.
 */
export function resolveDateRange(
  preset: TimeRangePreset = 'this_month',
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): DateRangeResult {
  if (preset === 'custom' && customStart && customEnd) {
    return {
      startDate: customStart,
      endDate: customEnd,
      preset: 'custom',
    };
  }

  const now = new Date(referenceDate);
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const date = now.getDate();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...

  const formatDate = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  switch (preset) {
    case 'today': {
      const todayStr = formatDate(now);
      return { startDate: todayStr, endDate: todayStr, preset: 'today' };
    }

    case 'yesterday': {
      const yest = new Date(year, month, date - 1);
      const yestStr = formatDate(yest);
      return { startDate: yestStr, endDate: yestStr, preset: 'yesterday' };
    }

    case 'this_week': {
      // Monday as first day of week
      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(year, month, date - diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      return {
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
        preset: 'this_week',
      };
    }

    case 'this_month': {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      return {
        startDate: formatDate(startOfMonth),
        endDate: formatDate(endOfMonth),
        preset: 'this_month',
      };
    }

    case 'previous_month': {
      const startOfPrevMonth = new Date(year, month - 1, 1);
      const endOfPrevMonth = new Date(year, month, 0);
      return {
        startDate: formatDate(startOfPrevMonth),
        endDate: formatDate(endOfPrevMonth),
        preset: 'previous_month',
      };
    }

    case 'last_30_days': {
      const start = new Date(year, month, date - 29);
      return {
        startDate: formatDate(start),
        endDate: formatDate(now),
        preset: 'last_30_days',
      };
    }

    case 'last_90_days': {
      const start = new Date(year, month, date - 89);
      return {
        startDate: formatDate(start),
        endDate: formatDate(now),
        preset: 'last_90_days',
      };
    }

    case 'this_year': {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      return {
        startDate: formatDate(startOfYear),
        endDate: formatDate(endOfYear),
        preset: 'this_year',
      };
    }

    case 'custom':
    default: {
      if (customStart && customEnd) {
        return { startDate: customStart, endDate: customEnd, preset: 'custom' };
      }
      // Fallback to this month
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      return {
        startDate: formatDate(startOfMonth),
        endDate: formatDate(endOfMonth),
        preset: 'this_month',
      };
    }
  }
}

/**
 * Generates an array of all dates (YYYY-MM-DD) between startDate and endDate inclusive.
 */
export function generateDateBuckets(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Safety cap at 366 days
  let current = new Date(start);
  let count = 0;

  while (current <= end && count <= 366) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);

    current.setDate(current.getDate() + 1);
    count++;
  }

  return dates;
}
