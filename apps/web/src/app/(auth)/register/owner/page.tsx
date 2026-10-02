import React from 'react';
import { OwnerRegisterForm } from '@/components/auth/OwnerRegisterForm';
import { Container } from '@/components/ui/Container';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register as Venue Owner — SportsHub',
  description: 'Onboard your sports business, manage multi-sport venues, and configure bookable facilities.',
};

export default function OwnerRegisterPage() {
  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12">
      <Container size="sm">
        <OwnerRegisterForm />
      </Container>
    </div>
  );
}
