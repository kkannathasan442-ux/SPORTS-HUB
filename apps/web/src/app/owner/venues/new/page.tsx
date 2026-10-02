import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { VenueForm } from '@/components/owner';
import { Card } from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Venue — SportsHub Owner',
};

export default async function NewVenuePage() {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { role } = context;
  const isAuthorized = role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN';

  if (!isAuthorized) {
    redirect('/owner');
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/owner/venues"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create New Venue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Register a new sports complex, stadium, or arena under your organization.
          </p>
        </div>
      </div>

      <VenueForm mode="create" />
    </div>
  );
}
