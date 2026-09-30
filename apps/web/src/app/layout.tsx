import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Container';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'SportsHub — Book. Play. Compete. Connect.',
  description:
    'SportsHub is a modern sports and recreation platform for venues, tournaments, players, coaches, and sports communities.',
  keywords: ['Sports', 'Booking', 'Cricket', 'Badminton', 'Basketball', 'Table Tennis', 'Chess', 'Carrom', 'Tournaments'],
  authors: [{ name: 'SportsHub Team' }],
  metadataBase: new URL('http://localhost:3000'),
  openGraph: {
    title: 'SportsHub — Book. Play. Compete. Connect.',
    description: 'Multi-tenant sports and recreation platform.',
    siteName: 'SportsHub',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <Container className="flex h-16 items-center justify-between">
            <Logo size="md" />
            <nav className="flex items-center gap-6">
              <Link
                href="/health"
                className="text-xs font-semibold text-slate-500 hover:text-sports-navy transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                System Status
              </Link>
            </nav>
          </Container>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200/80 bg-white py-8">
          <Container className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} SportsHub. All rights reserved.</p>
            <p className="font-medium tracking-wide">Book. Play. Compete. Connect.</p>
          </Container>
        </footer>
      </body>
    </html>
  );
}
