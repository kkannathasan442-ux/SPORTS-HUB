import React from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DiscoverySearchBar } from '@/components/discovery/DiscoverySearchBar';
import { VenueCard } from '@/components/discovery/VenueCard';
import { getActivePlatformSports } from '@/lib/discovery/public-venue';
import { searchPublicVenues } from '@/lib/discovery/search-venues';
import {
  Flame,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  Trophy,
  Compass,
  Building2,
  CalendarDays,
  Sparkles,
  Search,
} from 'lucide-react';
import Link from 'next/link';

export default async function HomePage() {
  const sports = await getActivePlatformSports();
  const searchResults = await searchPublicVenues({ pageSize: 4 });
  const featuredVenues = searchResults.items;

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section with Live Discovery Search Bar */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200/70">
        <Container className="relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 shadow-sm">
            <Flame className="w-3.5 h-3.5 text-brand-600" />
            <span>Customer Discovery & Venue Search</span>
          </div>

          <div className="space-y-3 max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Sports<span className="text-sports-accent">Hub</span>
            </h1>

            <p className="text-xl sm:text-2xl font-medium text-slate-700 max-w-2xl mx-auto tracking-tight">
              Book. Play. Compete. Connect.
            </p>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 pt-2">
              Find a place to <span className="text-sports-accent">play</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto">
              Discover verified sports venues, courts, and real-time availability across Sri Lanka.
            </p>
          </div>

          {/* Customer Search Bar Component */}
          <div className="max-w-4xl mx-auto text-left pt-2">
            <DiscoverySearchBar sports={sports} />
          </div>

          {/* Quick Sport Filters and Explore CTA */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
            <Link href="/register">
              <Button size="sm" className="h-8 text-xs font-bold shadow-xs">
                Get Started
              </Button>
            </Link>
            <Link href="#sports">
              <Button variant="outline" size="sm" className="h-8 text-xs font-bold">
                Explore Sports
              </Button>
            </Link>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
              Popular Sports:
            </span>
            {sports.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href={`/search?sportId=${s.id}`}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-sports-navy hover:text-sports-navy hover:shadow-xs transition-all flex items-center gap-1.5"
              >
                <span>{s.name}</span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Featured Venues Section */}
      {featuredVenues.length > 0 && (
        <section className="py-2">
          <Container>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-sports-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-sports-navy">
                    Available Near You
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Featured Sports Venues
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Explore top-rated venues and multi-sport facilities with real-time court schedules.
                </p>
              </div>

              <Link
                href="/search"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sports-navy hover:text-brand-700 transition-colors"
              >
                <span>View All Venues</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredVenues.map((venue) => (
                <VenueCard key={venue.venue_id} venue={venue} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Global Sports Catalog */}
      <section id="sports" className="py-4">
        <Container>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <Badge variant="info" className="mb-2">
                Multi-Sport Catalog
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Explore Sports Disciplines
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Engineered for specialized sports rules, court scheduling, and custom operating models.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {sports.length} Active Platform Sports
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sports.map((sport) => (
              <Link
                key={sport.id}
                href={`/search?sportId=${sport.id}`}
                className="group block"
              >
                <Card hoverable className="h-full flex flex-col justify-between transition-all group-hover:border-sports-navy">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100">
                        {sport.slug}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Verified Sport</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-sports-navy transition-colors">
                      {sport.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                      {sport.description || `Search venues and court availability for ${sport.name}.`}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-sports-navy font-bold">
                    <span>Search Facilities</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Platform Pillars */}
      <section className="py-6">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs mb-2">
                <Compass className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold uppercase text-brand-600 tracking-wider">Discover</div>
              <div className="text-sm font-bold text-slate-900">Search by Sport & Location</div>
              <p className="text-xs text-slate-500">Filter by radius, price, and facility type</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs mb-2">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold uppercase text-emerald-600 tracking-wider">Venues</div>
              <div className="text-sm font-bold text-slate-900">Verified Sports Complex Listings</div>
              <p className="text-xs text-slate-500">View 7-day operating hours and court specs</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs mb-2">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold uppercase text-amber-600 tracking-wider">Availability</div>
              <div className="text-sm font-bold text-slate-900">Real-Time Schedule Checks</div>
              <p className="text-xs text-slate-500">Instant operating hours & maintenance checks</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs mb-2">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold uppercase text-sky-600 tracking-wider">Connect</div>
              <div className="text-sm font-bold text-slate-900">Multi-Sport Ecosystem</div>
              <p className="text-xs text-slate-500">Teams, coaches, and sports clubs</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Enterprise Architecture Footer Note */}
      <section className="py-4">
        <Container>
          <div className="rounded-3xl bg-sports-navy text-white p-8 sm:p-10 shadow-lg border border-slate-800">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-sky-300 border border-sky-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enterprise Architecture</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Unified Multi-Tenant Sports Discovery
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                SportsHub provides strict tenant isolation, PostgreSQL RLS security, and real-time court availability in Asia/Colombo timezone.
              </p>

              <div className="pt-2 flex items-center gap-4">
                <Link
                  href="/health"
                  className="inline-flex items-center text-xs font-semibold text-sky-300 hover:text-white transition-colors"
                >
                  Verify Health Endpoint <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
