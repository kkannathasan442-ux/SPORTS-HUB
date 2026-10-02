import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getUserOrganizations } from '@/lib/auth/membership';
import { OwnerSidebar, OwnerHeader } from '@/components/owner';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let context;
  try {
    context = await getActiveOrganizationContext();
  } catch {
    redirect('/login?error=auth_required');
  }

  if (!context || !context.user) {
    redirect('/login?error=auth_required');
  }

  const { user, role, activeOrganization, allMemberships } = context;

  if (!activeOrganization) {
    redirect('/register/owner?error=no_organization');
  }

  // Verify Role
  const isAuthorized =
    role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN';

  if (!isAuthorized) {
    return (
      <div className="py-12 bg-slate-50 min-h-screen">
        <Container size="sm">
          <Card className="text-center p-8 border-rose-200 bg-white shadow-sm">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Owner Access Required</h2>
            <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto">
              Your account currently has the <strong className="text-slate-900">{role || 'GUEST'}</strong> role in the active organization. Only Owners and Managers may access the management dashboard.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/customer"
                className="inline-flex items-center text-xs font-semibold px-4 py-2 rounded-xl bg-sports-navy text-white hover:bg-sports-navy/90"
              >
                Go to Customer Portal
              </Link>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  const organizations = await getUserOrganizations(user.id);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OwnerHeader
        currentOrg={activeOrganization}
        role={role}
        allMemberships={allMemberships}
        organizations={organizations}
      />
      <div className="flex-1 flex flex-col md:flex-row">
        <OwnerSidebar />
        <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
