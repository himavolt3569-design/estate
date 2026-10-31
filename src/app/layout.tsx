import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/merokotha/auth-provider';
import { SiteShell } from '@/components/merokotha/site-shell';
import { AdProvider } from '@/components/merokotha/ad-provider';
import { getLocale } from '@/i18n';
import '@/styles/globals.css';

export const metadata: Metadata = { title: 'MeroKotha | Find your place', description: 'Browse and manage rental homes in Nepal.' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <html lang={locale}><head><link rel="stylesheet" href="/fonts/poppins.css" /></head><body className="min-h-dvh bg-white text-ink-900 antialiased"><AuthProvider><AdProvider><SiteShell locale={locale}>{children}</SiteShell></AdProvider></AuthProvider><Toaster richColors position="bottom-right" /></body></html>;
}
