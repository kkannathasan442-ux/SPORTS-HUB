import React from 'react';
import { OrganizationSwitcher } from '@/components/auth/OrganizationSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Shield, Building2 } from 'lucide-react';
import type { Organization, OrganizationMember, AppRole } from '@sportshub/types';

interface OwnerHeaderProps {
  currentOrg: Organization | null;
  role: AppRole | null;
  allMemberships: OrganizationMember[];
  organizations: Organization[];
}

export function OwnerHeader({
  currentOrg,
  role,
  allMemberships,
  organizations,
}: OwnerHeaderProps) {
  return (
    <div className="w-full bg-white border-b border-slate-200/80 px-4 md:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sports-navy/10 text-sports-navy flex items-center justify-center font-bold">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {currentOrg?.name || 'Organization Portal'}
            </span>
            {role && (
              <Badge variant={role === 'OWNER' ? 'success' : 'info'} className="text-[10px] py-0 px-2">
                <Shield className="w-2.5 h-2.5 mr-1" />
                {role}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            Multi-Tenant Business Management
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <OrganizationSwitcher
          currentOrg={currentOrg}
          userMemberships={allMemberships}
          organizations={organizations}
        />
      </div>
    </div>
  );
}
