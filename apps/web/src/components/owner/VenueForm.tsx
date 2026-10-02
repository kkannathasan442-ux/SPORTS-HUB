'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createVenueAction, updateVenueAction } from '@/lib/owner/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  MapPin,
  Mail,
  Phone,
  Clock,
  Image as ImageIcon,
  Compass,
} from 'lucide-react';
import Link from 'next/link';
import type { Venue } from '@sportshub/types';

interface VenueFormProps {
  venue?: Venue;
  mode: 'create' | 'edit';
}

export function VenueForm({ venue, mode }: VenueFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [slug, setSlug] = useState(venue?.slug || '');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (mode === 'create' && !slug) {
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
    setSuccessMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (mode === 'create') {
        const res = await createVenueAction(null, formData);
        if (res.success && res.data?.venueId) {
          setSuccessMessage('Venue created successfully! Redirecting...');
          setTimeout(() => {
            router.push(`/owner/venues/${res.data!.venueId}`);
            router.refresh();
          }, 1000);
        } else {
          setErrorMessage(res.error || 'Failed to create venue.');
        }
      } else if (venue) {
        const res = await updateVenueAction(venue.id, null, formData);
        if (res.success) {
          setSuccessMessage('Venue updated successfully.');
          router.refresh();
        } else {
          setErrorMessage(res.error || 'Failed to update venue.');
        }
      }
    });
  };

  return (
    <Card className="max-w-4xl">
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <p className="leading-tight">{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500 mt-0.5" />
          <p className="leading-tight">{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Venue Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Venue Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={venue?.name}
              onChange={handleNameChange}
              placeholder="e.g. Royal Indoor Arena"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              URL Slug <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. royal-indoor-arena"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy font-mono text-xs transition-all"
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Venue Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={venue?.description || ''}
              placeholder="Highlights, sports offered, parking, shower facilities..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all resize-none"
            />
          </div>

          {/* Address Line 1 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Address Line 1
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="address_line_1"
                defaultValue={venue?.address_line_1 || ''}
                placeholder="No. 123, Stadium Road"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
              />
            </div>
          </div>

          {/* Address Line 2 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Address Line 2 (Optional)
            </label>
            <input
              type="text"
              name="address_line_2"
              defaultValue={venue?.address_line_2 || ''}
              placeholder="Suite / Floor / Landmark"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              City
            </label>
            <input
              type="text"
              name="city"
              defaultValue={venue?.city || ''}
              placeholder="Colombo"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
            />
          </div>

          {/* District */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              District / State
            </label>
            <input
              type="text"
              name="district"
              defaultValue={venue?.district || ''}
              placeholder="Colombo District"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
            />
          </div>

          {/* Postal Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Postal Code
            </label>
            <input
              type="text"
              name="postal_code"
              defaultValue={venue?.postal_code || ''}
              placeholder="00700"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Operational Status
            </label>
            <select
              name="status"
              defaultValue={venue?.status || 'DRAFT'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all bg-white"
            >
              <option value="DRAFT">DRAFT (Under Setup)</option>
              <option value="ACTIVE">ACTIVE (Operational)</option>
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>

          {/* Latitude */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Latitude (-90.0 to 90.0)
            </label>
            <div className="relative">
              <Compass className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="any"
                name="latitude"
                defaultValue={venue?.latitude ?? ''}
                placeholder="6.927079"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
              />
            </div>
          </div>

          {/* Longitude */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Longitude (-180.0 to 180.0)
            </label>
            <div className="relative">
              <Compass className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="any"
                name="longitude"
                defaultValue={venue?.longitude ?? ''}
                placeholder="79.861244"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
              />
            </div>
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Venue Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                name="phone"
                defaultValue={venue?.phone || ''}
                placeholder="+94 11 987 6543"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
              />
            </div>
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Venue Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="email"
                defaultValue={venue?.email || ''}
                placeholder="arena@royalsports.lk"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
              />
            </div>
          </div>

          {/* Cover Image URL */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Cover Image URL
            </label>
            <div className="relative">
              <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                name="cover_image_url"
                defaultValue={venue?.cover_image_url || ''}
                placeholder="https://images.unsplash.com/photo-1546519638-68e109498ffc"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy transition-all"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <Link
            href={mode === 'edit' && venue ? `/owner/venues/${venue.id}` : '/owner/venues'}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel
          </Link>

          <Button
            type="submit"
            disabled={isPending}
            className="shadow-md flex items-center gap-2 px-6"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === 'create' ? 'Creating...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{mode === 'create' ? 'Create Venue' : 'Save Changes'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
