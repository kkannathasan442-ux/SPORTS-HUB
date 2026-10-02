import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { fetchOrganizationMembers } from '@/lib/members/member-service';
import { MembersManagerClient } from '@/components/owner/MembersManagerClient';
import { Card } from '@/components/ui/Card';
import { Users, ShieldCheck, AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team & Member Management — SportsHub Owner',
};

export default async function OwnerMembersPage() {
  let context;
  try {
    context = await getActiveOrganizationContext();
  } catch {
    redirect('/login?error=auth_required');
  }

  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { activeOrganization, role, user } = context;
  const members = await fetchOrganizationMembers(activeOrganization.id);
  const isOwnerOrAdmin = role === 'OWNER' || role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sports-accent" />
            <h1 className="text-xl font-bold text-slate-900">Organization Staff & Team Members</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage organization members, assign operational roles, and enforce role-based permissions.
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
            <span className="font-semibold">Read-Only View:</span> Your role is <strong>{role}</strong>. Only organization <strong>OWNER</strong>s and Platform Super Admins can invite staff or modify roles.
          </div>
        </div>
      )}

      <MembersManagerClient
        initialMembers={members}
        isReadOnly={!isOwnerOrAdmin}
        currentUserId={user.id}
      />
    </div>
  );
}
