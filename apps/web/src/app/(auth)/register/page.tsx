import React from 'react';
import { CustomerRegisterForm } from '@/components/auth/CustomerRegisterForm';
import { Container } from '@/components/ui/Container';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register Account — SportsHub',
  description: 'Create a customer account on SportsHub to book courts, join matches, and enter tournaments.',
};

export default function CustomerRegisterPage() {
  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12">
      <Container size="sm">
        <CustomerRegisterForm />
      </Container>
    </div>
  );
}
