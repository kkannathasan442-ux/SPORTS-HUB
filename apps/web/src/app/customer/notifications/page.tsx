import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CustomerNotificationsClient } from '@/components/notifications/CustomerNotificationsClient';

export default async function CustomerNotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=auth_required');
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <CustomerNotificationsClient />
    </div>
  );
}
