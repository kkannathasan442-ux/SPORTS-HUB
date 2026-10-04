'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MatchTypeSchema, MatchFormatSchema } from '@sportshub/validation';

export interface MatchFormProps {
  sports?: any[];
}

export const MatchForm: React.FC<MatchFormProps> = ({ sports = [] }) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    sportId: sports.length > 0 ? sports[0].id : '',
    matchType: 'CASUAL' as MatchTypeSchema,
    matchFormat: 'SINGLES' as MatchFormatSchema,
    scheduledStart: '',
    scheduledEnd: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        title: formData.title || undefined,
        matchType: formData.matchType,
        matchFormat: formData.matchFormat,
      };

      if (formData.sportId) payload.sportId = formData.sportId;
      
      if (formData.scheduledStart) {
        payload.scheduledStart = new Date(formData.scheduledStart).toISOString();
      }
      if (formData.scheduledEnd) {
        payload.scheduledEnd = new Date(formData.scheduledEnd).toISOString();
      }

      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create match');
      }

      router.push(`/matches/${data.id || data.match?.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-rose-50 text-rose-700 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Match Title (Optional)</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Friendly Weekend Match"
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Sport</label>
            <select
              name="sportId"
              value={formData.sportId}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select a Sport</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Match Type</label>
            <select
              name="matchType"
              value={formData.matchType}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="CASUAL">Casual</option>
              <option value="PRACTICE">Practice</option>
              <option value="COMPETITIVE">Competitive</option>
              <option value="TOURNAMENT">Tournament</option>
              <option value="LEAGUE">League</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Match Format</label>
            <select
              name="matchFormat"
              value={formData.matchFormat}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="SINGLES">Singles</option>
              <option value="DOUBLES">Doubles</option>
              <option value="TEAM">Team</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Start</label>
            <input
              type="datetime-local"
              name="scheduledStart"
              value={formData.scheduledStart}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled End</label>
            <input
              type="datetime-local"
              name="scheduledEnd"
              value={formData.scheduledEnd}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="pt-4">
          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Create Match
          </Button>
        </div>
      </form>
    </Card>
  );
};
