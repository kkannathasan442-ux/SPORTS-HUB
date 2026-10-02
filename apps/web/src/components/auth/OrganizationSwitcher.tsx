'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setActiveOrganizationAction } from '@/lib/auth/actions';
import { Building, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import type { Organization, OrganizationMember } from '@sportshub/types';

interface OrganizationSwitcherProps {
  currentOrg: Organization | null;
  userMemberships: OrganizationMember[];
  organizations: Organization[];
}

export function OrganizationSwitcher({
  currentOrg,
  userMemberships,
  organizations,
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (organizations.length <= 1) {
    if (!currentOrg) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
        <Building className="w-3.5 h-3.5 text-slate-500" />
        <span className="truncate max-w-[140px]">{currentOrg.name}</span>
      </div>
    );
  }

  const handleSelect = (orgId: string) => {
    if (orgId === currentOrg?.id) return;

    startTransition(async () => {
      const res = await setActiveOrganizationAction(orgId);
      if (res.success) {
        router.refresh();
      }
    });
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors cursor-pointer shadow-xs">
        <Building className="w-3.5 h-3.5 text-sports-navy" />
        <select
          value={currentOrg?.id || ''}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={isPending}
          className="bg-transparent border-none outline-none cursor-pointer pr-4 text-xs font-semibold appearance-none"
          aria-label="Select Active Organization"
        >
          {organizations.map((org) => {
            const member = userMemberships.find((m) => m.organization_id === org.id);
            const roleLabel = member ? ` (${member.role})` : '';
            return (
              <option key={org.id} value={org.id}>
                {org.name}
                {roleLabel}
              </option>
            );
          })}
        </select>
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-slate-400 pointer-events-none" />
        )}
      </div>
    </div>
  );
}
