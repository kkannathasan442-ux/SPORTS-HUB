'use client';

import React, { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { updateOperatingHoursAction } from '@/lib/owner/actions';
import { Clock, CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import type { VenueOperatingHours } from '@sportshub/types';

interface OperatingHoursFormProps {
  venueId: string;
  initialHours: VenueOperatingHours[];
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface DayState {
  day_of_week: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
}

export function OperatingHoursForm({ venueId, initialHours }: OperatingHoursFormProps) {
  // Normalize 7 days in order 0 to 6
  const [schedule, setSchedule] = useState<DayState[]>(() => {
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const found = initialHours.find((h) => h.day_of_week === dayIndex);
      return {
        day_of_week: dayIndex,
        is_closed: found ? found.is_closed : false,
        open_time: found?.open_time ? found.open_time.slice(0, 5) : '06:00',
        close_time: found?.close_time ? found.close_time.slice(0, 5) : '22:00',
      };
    });
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggleClosed = (dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.day_of_week === dayIndex ? { ...item, is_closed: !item.is_closed } : item
      )
    );
  };

  const handleTimeChange = (dayIndex: number, field: 'open_time' | 'close_time', value: string) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.day_of_week === dayIndex ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSetAllWeekdays = (open: string, close: string) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.day_of_week >= 1 && item.day_of_week <= 5
          ? { ...item, open_time: open, close_time: close, is_closed: false }
          : item
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side validation: open < close for active days
    for (const day of schedule) {
      if (!day.is_closed) {
        if (!day.open_time || !day.close_time) {
          setErrorMessage(`${DAY_NAMES[day.day_of_week]}: Open time and close time are required.`);
          return;
        }
        if (day.open_time >= day.close_time) {
          setErrorMessage(
            `${DAY_NAMES[day.day_of_week]}: Open time (${day.open_time}) must be earlier than close time (${day.close_time}). Overnight hours are not supported.`
          );
          return;
        }
      }
    }

    startTransition(async () => {
      // Format times to HH:mm:ss for postgres
      const payload = schedule.map((item) => ({
        day_of_week: item.day_of_week,
        is_closed: item.is_closed,
        open_time: item.is_closed ? null : item.open_time.length === 5 ? `${item.open_time}:00` : item.open_time,
        close_time: item.is_closed ? null : item.close_time.length === 5 ? `${item.close_time}:00` : item.close_time,
      }));

      const res = await updateOperatingHoursAction(venueId, payload);
      if (res.success) {
        setSuccessMessage('Operating hours updated successfully.');
      } else {
        setErrorMessage(res.error || 'Failed to update operating hours.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Weekly Operating Hours</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure opening and closing schedules for each day of the week.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSetAllWeekdays('06:00', '22:00')}
            className="text-xs"
          >
            Apply 06:00 - 22:00 to Weekdays
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
          <p>{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-0 overflow-hidden divide-y divide-slate-100">
          {schedule.map((day) => {
            const dayName = DAY_NAMES[day.day_of_week];
            const isWeekend = day.day_of_week === 0 || day.day_of_week === 6;

            return (
              <div
                key={day.day_of_week}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  day.is_closed ? 'bg-slate-50/70' : 'bg-white'
                }`}
              >
                <div className="w-40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                    {dayName.slice(0, 3)}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800">{dayName}</span>
                    {isWeekend && (
                      <span className="ml-2 text-[10px] font-bold text-amber-600 uppercase">Weekend</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.is_closed}
                      onChange={() => handleToggleClosed(day.day_of_week)}
                      className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
                    />
                    <span>Closed this day</span>
                  </label>

                  {!day.is_closed ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">Opens:</span>
                        <input
                          type="time"
                          value={day.open_time}
                          onChange={(e) => handleTimeChange(day.day_of_week, 'open_time', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sports-navy"
                        />
                      </div>

                      <span className="text-slate-400 text-xs font-semibold">to</span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">Closes:</span>
                        <input
                          type="time"
                          value={day.close_time}
                          onChange={(e) => handleTimeChange(day.day_of_week, 'close_time', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sports-navy"
                        />
                      </div>
                    </div>
                  ) : (
                    <Badge variant="default">CLOSED FOR BOOKING</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} className="flex items-center gap-1.5 shadow-xs">
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Schedule...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Operating Hours</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
