import React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Container } from '@/components/ui/Container';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — SportsHub',
  description: 'Sign in to your SportsHub account to manage bookings, venues, and tournaments.',
};

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12">
      <Container size="sm">
        <LoginForm />
      </Container>
    </div>
  );
}
