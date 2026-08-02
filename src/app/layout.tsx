import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import { Toaster } from 'sonner';

import { getLocale } from '@/i18n';
import { siteOrigin } from '@/lib/utils';
import { PresenceTracker } from '@/modules/analytics/components/PresenceTracker';

import { Providers } from './providers';
import { PageTransition } from '@/components/animations/PageTransition';

import '@/styles/globals.css';

/*
 * One family, both scripts.
 *
 * Poppins ships a Devanagari cut drawn by the same foundry, so Nepali and
 * English are a matched design rather than a second face bolted on. That is the
 * reason this product can run on a single typeface without compromising either
 * script.
 *
 * The expressive range comes from weight and italic, not from a second family.
 * 200 carries large quiet numerals, 600/700 carries display, 500 carries the
 * uppercase micro-labels, and italic is reserved for the human voice: Nepali
 * transliterations and pull quotes.
 */
const poppins = Poppins({
  subsets: ['latin', 'devanagari'],
  weight: ['200', '300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-poppins',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: 'Kitta: property in Nepal, with its paperwork in the open',
    template: '%s · Kitta',
  },
  description:
    'Search houses, apartments and land across Nepal. Every listing carries a public record of who listed it, when, and what has been verified.',
  applicationName: 'Kitta',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kitta' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_NP',
    siteName: 'Kitta',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#142c52',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // `lang` has to be correct for screen readers to pick the right voice and for
  // the browser to hyphenate Devanagari properly.
  const locale = await getLocale();

  return (
    <html lang={locale} className={poppins.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {/* Keyboard users reach the content without tabbing the whole header. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:bg-royal-800 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <Providers>
          <PageTransition>
            {children}
          </PageTransition>
        </Providers>
        {/* Renders nothing. Reports which route this tab is on so the control
            centre can show real visitors rather than a generated number. */}
        <PresenceTracker />
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                'rounded-md border border-ink-200 bg-white text-ink-800 shadow-soft font-sans text-sm',
            },
          }}
        />
      </body>
    </html>
  );
}
