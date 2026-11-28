import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/hamrokotha/auth-provider';
import { SiteShell } from '@/components/hamrokotha/site-shell';
import { AdProvider } from '@/components/hamrokotha/ad-provider';
import { getLocale } from '@/i18n';
import { siteOrigin } from '@/lib/utils';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: 'HamroKotha | Find your place', template: '%s | HamroKotha' },
  description: 'Browse, measure, and manage properties and land in Nepal on HamroKotha.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'HamroKotha',
    locale: 'en_NP',
    url: siteOrigin(),
  },
  twitter: { card: 'summary_large_image' },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <html lang={locale}><head><link rel="stylesheet" href="/fonts/poppins.css" /></head><body className="min-h-dvh bg-white text-ink-900 antialiased"><AuthProvider><AdProvider><SiteShell locale={locale}>{children}</SiteShell></AdProvider></AuthProvider><Toaster richColors position="bottom-right" /></body></html>;
}
