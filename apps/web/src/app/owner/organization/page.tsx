import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerOrganization } from '@/lib/owner/queries';
import { OrganizationSettingsForm } from '@/components/owner';
import { Card } from '@/components/ui/Card';
import { AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Organization Settings — SportsHub Owner',
};

export default async function OwnerOrganizationPage() {
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
  const org = await getOwnerOrganization(activeOrganization.id);

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
      <div>
        <h1 className="text-xl font-bold text-slate-900">Organization Profile & Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your organization name, branding logo, contact details, currency, and primary timezone.
        </p>
      </div>

      {!isOwnerOrAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Read-Only View:</span> Your role is <strong>{role}</strong>. Only organization <strong>OWNER</strong>s and Platform Super Admins can update organization profile settings.
          </div>
        </div>
      )}

      <OrganizationSettingsForm organization={org} isReadOnly={!isOwnerOrAdmin} />
    </div>
  );
}
