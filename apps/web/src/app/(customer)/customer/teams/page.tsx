import React from 'react';
import { requireAuth } from '@/lib/auth/authorization';
import { redirect } from 'next/navigation';

export default async function TeamsPage() {
  try {
    await requireAuth();
  } catch {
    redirect('/login?error=auth_required');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Teams</h1>
      <p>Manage your teams and rosters.</p>
    </div>
  );
}
