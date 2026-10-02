import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Award, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Scorer Portal — SportsHub',
};

export default async function ScorerDashboardPage() {
  const context = await getActiveOrganizationContext();
  if (!context) {
    redirect('/login?error=auth_required');
  }

  const { profile, activeOrganization, role } = context;

  const allowedRoles = ['SCORER', 'MANAGER', 'OWNER', 'SUPER_ADMIN'];
  if (!role || !allowedRoles.includes(role)) {
    return (
      <div className="py-12">
        <Container size="sm">
          <Card className="text-center p-8 border-rose-200 bg-rose-50/50">
            <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">Scorer Access Required</h2>
            <p className="text-xs text-slate-600 mt-2">
              You do not have official match scoring permissions for this organization.
            </p>
            <div className="mt-6">
              <Link href="/customer" className="text-xs font-bold text-sports-accent hover:underline">
                Go to Customer Portal &rarr;
              </Link>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-10">
      <Container>
        <PageHeader
          badge={<Badge variant="warning">Match Officials Portal</Badge>}
          title={`Official Match Scoring — ${activeOrganization?.name || 'Organization'}`}
          description={`Logged in as ${profile.full_name} (${role})`}
        />

        <div className="mt-8">
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">Live Scoring Operations</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Step 3 RBAC foundation active for official match scoring. Real-time scoreboard and tournament sheet controllers will be connected in future steps.
            </p>
          </Card>
        </div>
      </Container>
    </div>
  );
}
