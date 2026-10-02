'use client';

import React, { useState, useTransition } from 'react';
import { createFacilityAction, updateFacilityAction } from '@/lib/owner/actions';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Loader2, X, Save } from 'lucide-react';
import type { FacilityWithSport, VenueSportWithSport } from '@sportshub/types';

interface FacilityFormModalProps {
  venueId: string;
  facility?: FacilityWithSport | null;
  activeVenueSports: VenueSportWithSport[];
  isOpen: boolean;
  onClose: () => void;
}

export function FacilityFormModal({
  venueId,
  facility,
  activeVenueSports,
  isOpen,
  onClose,
}: FacilityFormModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdit = !!facility;
  const [slug, setSlug] = useState(facility?.slug || '');

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEdit && !slug) {
      const generated = e.target.value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generated);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    const formData = new FormData(e.currentTarget);
    formData.append('venue_id', venueId);

    startTransition(async () => {
      let res;
      if (isEdit && facility) {
        res = await updateFacilityAction(facility.id, null, formData);
      } else {
        res = await createFacilityAction(null, formData);
      }

      if (res.success) {
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to save facility.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            {isEdit ? 'Edit Facility / Court' : 'Add New Facility / Court'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="my-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Facility Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Facility Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                defaultValue={facility?.name}
                onChange={handleNameChange}
                placeholder="e.g. Badminton Court 01"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy"
              />
            </div>

            {/* Slug */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Slug <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="slug"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. badminton-court-01"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sports-navy"
              />
            </div>

            {/* Assigned Sport */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Sport Type
              </label>
              <select
                name="sport_id"
                defaultValue={facility?.sport_id || ''}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
              >
                <option value="">-- Generic / Multi-Sport --</option>
                {activeVenueSports.map((vs) => (
                  <option key={vs.sport_id} value={vs.sport_id}>
                    {vs.sport.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={facility?.status || 'AVAILABLE'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="CLOSED">CLOSED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>

            {/* Facility Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Surface / Type
              </label>
              <input
                type="text"
                name="facility_type"
                defaultValue={facility?.facility_type || ''}
                placeholder="Synthetic / Turf / Wood"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Max Players / Capacity
              </label>
              <input
                type="number"
                name="capacity"
                min={1}
                defaultValue={facility?.capacity ?? ''}
                placeholder="4"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
              />
            </div>

            {/* Default Duration Minutes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                name="default_duration_minutes"
                min={15}
                step={15}
                defaultValue={facility?.default_duration_minutes ?? 60}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
              />
            </div>

            {/* Buffer Minutes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Buffer (Minutes)
              </label>
              <input
                type="number"
                name="buffer_minutes"
                min={0}
                step={5}
                defaultValue={facility?.buffer_minutes ?? 0}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                name="description"
                rows={2}
                defaultValue={facility?.description || ''}
                placeholder="Court specifications, lighting, net height..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy resize-none"
              />
            </div>

            {/* Bookable Toggle */}
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_bookable"
                name="is_bookable"
                value="true"
                defaultChecked={facility?.is_bookable ?? true}
                className="w-4 h-4 rounded text-sports-navy focus:ring-sports-navy"
              />
              <label htmlFor="is_bookable" className="text-xs font-medium text-slate-700 cursor-pointer">
                Allow online booking reservations for this facility
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="flex items-center gap-1.5 shadow-xs">
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'Save Changes' : 'Create Facility'}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
