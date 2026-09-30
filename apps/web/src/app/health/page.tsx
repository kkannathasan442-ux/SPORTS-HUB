import React from 'react';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { APP_CONFIG } from '@sportshub/config';
import { Activity, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Health Check — SportsHub',
  description: 'SportsHub system status and foundation health check.',
};

export default function HealthPage() {
  const systemTime = new Date().toISOString();

  return (
    <Container className="py-16 sm:py-24 max-w-2xl">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-600">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <Card className="p-8 sm:p-10 shadow-md border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{APP_CONFIG.name}</h1>
              <p className="text-xs text-slate-500">Foundation Health Status</p>
            </div>
          </div>
          <Badge variant="success" className="px-3 py-1 flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Healthy
          </Badge>
        </div>

        {/* Primary Health Statement */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-6 text-center my-6">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            SportsHub
          </div>
          <div className="mt-2 text-base font-semibold text-emerald-600 flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            System Status: OK
          </div>
        </div>

        {/* Diagnostic Metadata */}
        <div className="space-y-3 pt-2 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-slate-100 text-slate-600">
            <span className="font-medium text-slate-500">Architecture Phase</span>
            <span className="font-semibold text-slate-900">STEP 0 — Project Foundation</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 text-slate-600">
            <span className="font-medium text-slate-500">Platform Version</span>
            <span className="font-semibold text-slate-900">{APP_CONFIG.version}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100 text-slate-600">
            <span className="font-medium text-slate-500">Environment</span>
            <span className="font-semibold text-slate-900">
              {process.env.NODE_ENV || 'development'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-slate-600">
            <span className="font-medium text-slate-500">Server Timestamp</span>
            <span className="font-mono text-slate-700">{systemTime}</span>
          </div>
        </div>
      </Card>
    </Container>
  );
}
