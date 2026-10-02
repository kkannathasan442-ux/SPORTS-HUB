'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { registerOwnerAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/Button';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Phone,
  Building2,
  AlertCircle,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export function OwnerRegisterForm() {
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
      const res = await registerOwnerAction(null, formData);
      if (res.success) {
        setSuccessMessage('Organization created successfully! Redirecting to Owner Portal...');
        setTimeout(() => {
          router.push('/owner');
          router.refresh();
        }, 1500);
      } else {
        setErrorMessage(res.error || 'Failed to register organization. Please check fields.');
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sports-navy/10 text-sports-navy text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Venue Operator Onboarding</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Register as Venue Owner</h2>
          <p className="text-sm text-slate-500 mt-1">
            Setup your sports organization, manage venues, and configure courts
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
                placeholder="Kamal Perera"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Organization / Business Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="organizationName"
                required
                placeholder="Colombo Sports Arena"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Business Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="email"
                required
                placeholder="owner@colombosports.lk"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                name="phone"
                placeholder="+94 77 987 6543"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy focus:border-transparent transition-all"
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
                className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy focus:border-transparent transition-all"
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sports-navy focus:border-transparent transition-all"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full mt-4 py-3 rounded-xl bg-sports-navy hover:bg-slate-800 shadow-md flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Organization...</span>
              </>
            ) : (
              <>
                <span>Register Organization</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 space-y-3 text-center text-xs text-slate-500">
          <div>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-sports-navy hover:underline">
              Sign in
            </Link>
          </div>
          <div>
            Looking for player registration?{' '}
            <Link href="/register" className="font-semibold text-sports-accent hover:underline">
              Create customer account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
