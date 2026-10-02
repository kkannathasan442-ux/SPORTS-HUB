import React from 'react';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/authorization';
import {
  getCustomerAccountProfile,
  getCustomerAccountStats,
} from '@/lib/customer/customer-service';
import { getUserPreferences } from '@/lib/notifications/notification-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CustomerAccountClient } from '@/components/customer/CustomerAccountClient';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { User, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Athlete Account & Profile — SportsHub',
};

export default async function CustomerAccountPage() {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch {
    redirect('/login?error=auth_required');
  }

  const { user } = authContext;
  const profile = await getCustomerAccountProfile(user.id);

  if (!profile) {
    redirect('/login?error=auth_required');
  }

  const supabase = await createSupabaseServerClient();
  const stats = await getCustomerAccountStats(user.id);
  const preferences = await getUserPreferences(supabase, user.id);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Container className="py-8 space-y-6">
        <PageHeader
          badge={<Badge variant="info">Athlete Portal</Badge>}
          title="My Account & Preferences"
          description="Manage your player identity, contact details, timezone, and communication settings."
        />

        <CustomerAccountClient
          initialProfile={profile}
          initialStats={stats}
          initialPreferences={preferences}
        />
      </Container>
    </div>
  );
}
