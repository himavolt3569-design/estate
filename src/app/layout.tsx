import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/merokotha/auth-provider';
import { SiteShell } from '@/components/merokotha/site-shell';
import { getLocale } from '@/i18n';
import '@/styles/globals.css';

export const metadata: Metadata = { title: 'MeroKotha | Find your place', description: 'Browse and manage rental homes in Nepal.' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <html lang={locale}><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" /></head><body className="min-h-dvh bg-white text-ink-900 antialiased"><AuthProvider><SiteShell locale={locale}>{children}</SiteShell></AuthProvider><Toaster richColors position="bottom-right" /></body></html>;
}
