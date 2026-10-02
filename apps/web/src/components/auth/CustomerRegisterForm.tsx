'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { registerCustomerAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/Button';
import { Eye, EyeOff, Lock, Mail, User, Phone, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function CustomerRegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await registerCustomerAction(null, formData);
      if (res.success) {
        setSuccessMessage('Account created successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        setErrorMessage(res.error || 'Failed to create account. Please check the fields and try again.');
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sports-accent/10 text-sports-accent text-xs font-semibold mb-2">
            <span>Customer & Player</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create Account</h2>
          <p className="text-sm text-slate-500 mt-1">
            Book sports facilities, join teams, and enter tournaments
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
            <p className="leading-tight">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500 mt-0.5" />
            <p className="leading-tight">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="fullName"
                required
                placeholder="John Silva"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-accent focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-accent focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                name="phone"
                placeholder="+94 77 123 4567"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-accent focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                placeholder="Minimum 6 characters"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-accent focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                required
                placeholder="Repeat password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-accent focus:border-transparent transition-all"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full mt-4 py-3 rounded-xl shadow-md flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Register Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 space-y-3 text-center text-xs text-slate-500">
          <div>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-sports-accent hover:underline">
              Sign in
            </Link>
          </div>
          <div>
            Are you a venue operator?{' '}
            <Link href="/register/owner" className="font-semibold text-sports-navy hover:underline">
              Register as Venue Owner
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
