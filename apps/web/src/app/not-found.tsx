import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Compass, ArrowLeft, Building2 } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="py-20">
      <Container className="max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <Building2 className="w-8 h-8 text-sports-navy" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">404</h1>
          <h2 className="text-lg font-bold text-slate-800">Listing or Page Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The venue, facility, or page you are looking for does not exist, has been archived, or is not publicly accessible.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/search">
            <Button size="sm" className="w-full sm:w-auto text-xs font-bold flex items-center gap-1.5 shadow-md">
              <Compass className="w-3.5 h-3.5" />
              <span>Search Venues</span>
            </Button>
          </Link>

          <Link href="/">
            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs font-bold flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back Home</span>
            </Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}
