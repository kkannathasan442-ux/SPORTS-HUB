import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { fetchOrganizationAuditLogs } from '@/lib/audit/audit-service';
import { AuditLogsClient } from '@/components/owner/AuditLogsClient';
import { ShieldCheck, History } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Immutable Audit Trail & Activity Logs — SportsHub Owner',
};

interface PageProps {
  searchParams: {
    action?: string;
    entityType?: string;
    actorUserId?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
  };
}

export default async function OwnerAuditLogsPage({ searchParams }: PageProps) {
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

  // Audit logs are accessible only to OWNER, MANAGER, and SUPER_ADMIN
  if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    redirect('/owner?error=unauthorized');
  }

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const limit = searchParams.limit ? parseInt(searchParams.limit, 10) : 25;

  const { logs, total, totalPages } = await fetchOrganizationAuditLogs(
    activeOrganization.id,
    {
      action: searchParams.action || undefined,
      entityType: searchParams.entityType || undefined,
      actorUserId: searchParams.actorUserId || undefined,
      startDate: searchParams.startDate || undefined,
      endDate: searchParams.endDate || undefined,
      page,
      limit,
    }
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-sports-accent" />
            <h1 className="text-xl font-bold text-slate-900">Immutable Audit Trail & Activity Logs</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-proof compliance records for administrative changes, role updates, settings modifications, and financial actions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 w-fit">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Role: {role}</span>
        </div>
      </div>

      <AuditLogsClient
        initialLogs={logs}
        totalCount={total}
        currentPage={page}
        pageSize={limit}
        totalPages={totalPages}
        organizationId={activeOrganization.id}
      />
    </div>
  );
}
