import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOwnerVenues, getGlobalActiveSports } from '@/lib/owner/queries';
import { getVenueBookings } from '@/lib/bookings/queries';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ReceptionistBookingDesk } from '@/components/bookings/ReceptionistBookingDesk';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Front Desk Receptionist Desk — SportsHub',
  description: 'Manage live court schedules, check-ins, and walk-in reservations.',
};

export default async function ReceptionistDashboardPage() {
  const context = await getActiveOrganizationContext();
  if (!context) {
    redirect('/login?error=auth_required');
  }

  const { profile, activeOrganization, role } = context;

  const allowedRoles = ['RECEPTIONIST', 'MANAGER', 'OWNER', 'SUPER_ADMIN', 'receptionist', 'manager', 'venue_owner', 'super_admin'];
  if (!role || !allowedRoles.includes(role) || !activeOrganization) {
    return (
      <div className="py-12">
        <Container size="sm">
          <Card className="text-center p-8 border-rose-200 bg-rose-50/50">
            <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">Receptionist Access Required</h2>
            <p className="text-xs text-slate-600 mt-2">
              You do not have front-desk or receptionist permissions for this organization.
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

  const supabase = await createSupabaseServerClient();
  const venues = await getOwnerVenues(activeOrganization.id);
  const sports = await getGlobalActiveSports();

  const todayStr = new Date().toISOString().split('T')[0];
  let initialBookings: any[] = [];
  if (venues.length > 0) {
    initialBookings = await getVenueBookings(supabase, venues[0].id, todayStr);
  }

  return (
    <div className="py-8">
      <Container>
        <PageHeader
          badge={<Badge variant="info">Front Desk Terminal</Badge>}
          title={`Front Desk — ${activeOrganization?.name || 'SportsHub'}`}
          description={`Logged in as ${profile.full_name} (${role})`}
        />

        <div className="mt-6">
          <ReceptionistBookingDesk
            organizationName={activeOrganization.name}
            venues={venues}
            sports={sports}
            initialBookings={initialBookings}
          />
        </div>
      </Container>
    </div>
  );
}
