import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { fetchOrganizationWithSettings } from '@/lib/settings/settings-service';
import { OrganizationSettingsForm } from '@/components/owner/OrganizationSettingsForm';
import { Card } from '@/components/ui/Card';
import { AlertCircle, Sliders, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Organization & Operational Settings — SportsHub Owner',
};

export default async function OwnerSettingsPage() {
  let context;
  try {
    context = await getActiveOrganizationContext();
  } catch {
    redirect('/login?error=auth_required');
  }

  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { activeOrganization, role } = context;
  const org = await fetchOrganizationWithSettings(activeOrganization.id);

  if (!org) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Card className="p-6 text-center text-slate-500">
          Organization record not found.
        </Card>
      </div>
    );
  }

  const isOwnerOrAdmin = role === 'OWNER' || role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sports-accent" />
            <h1 className="text-xl font-bold text-slate-900">Organization & Operational Settings</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure organization profile, booking hold policies, payment methods, and notifications.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 w-fit">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Role: {role}</span>
        </div>
      </div>

      {!isOwnerOrAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Read-Only Access:</span> Your role is <strong>{role}</strong>. Only organization <strong>OWNER</strong>s and Platform Super Admins can update organization settings.
          </div>
        </div>
      )}

      <OrganizationSettingsForm organization={org} isReadOnly={!isOwnerOrAdmin} />
    </div>
  );
}
