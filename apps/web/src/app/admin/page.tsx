import React from 'react';
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth/authorization';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShieldAlert, Database, Server, Key, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Admin — SportsHub',
};

export default async function AdminDashboardPage() {
  let authContext;
  try {
    authContext = await requireSuperAdmin();
  } catch {
    return (
      <div className="py-12">
        <Container size="sm">
          <Card className="text-center p-8 border-rose-200 bg-rose-50/50">
            <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">Platform Administrator Access Required</h2>
            <p className="text-xs text-slate-600 mt-2">
              You must have an active platform-level SUPER_ADMIN role to access this area.
            </p>
            <div className="mt-6">
              <Link href="/login" className="text-xs font-bold text-sports-accent hover:underline">
                Sign In With Admin Account &rarr;
              </Link>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  const { profile, user } = authContext;

  return (
    <div className="py-10">
      <Container>
        <PageHeader
          badge={<Badge variant="error">Super Admin Console</Badge>}
          title="Platform Governance & Tenant Control"
          description={`Authenticated as Platform Super Admin: ${profile.full_name} (${user.email})`}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">Platform Governance</h3>
            </div>
            <p className="text-xs text-slate-500">
              Cross-tenant oversight, platform-wide sports catalog management, and global audit logging.
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-3">
              <Database className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">Multi-Tenant Isolation</h3>
            </div>
            <p className="text-xs text-slate-500">
              PostgreSQL RLS security layer active with bypass privileges strictly confined to validated SUPER_ADMIN credentials.
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-3">
              <Key className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Security Invariant</h3>
            </div>
            <p className="text-xs text-slate-500">
              No public registration for Super Admin; elevated privileges are strictly server/database controlled.
            </p>
          </Card>
        </div>
      </Container>
    </div>
  );
}
