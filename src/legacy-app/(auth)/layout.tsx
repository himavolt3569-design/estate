import Link from 'next/link';

import { Wordmark } from '@/components/brand/Seal';
import { getDictionary } from '@/i18n';

/**
 * Auth shell: a single centred column.
 *
 * There was a marketing panel down the right-hand side. It tested as confusing:
 * two competing headlines on one screen, and a wall of claims sitting next to
 * the only thing the page is actually for. Signing in is a task, not a pitch,
 * so the page now does one thing.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getDictionary();

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link href="/" aria-label={t.nav.home}>
          <Wordmark />
        </Link>
        <Link
          href="/search"
          className="text-xs text-ink-500 underline-offset-4 hover:text-royal-700 hover:underline"
        >
          {t.nav.browseListings}
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-2xs text-ink-400">
        © {new Date().getFullYear()} Kitta ·{' '}
        <Link href="/terms" className="underline-offset-4 hover:underline">
          {t.auth.terms}
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          {t.auth.privacy}
        </Link>{' '}
        ·{' '}
        <Link href="/contact" className="underline-offset-4 hover:underline">
          {t.auth.contact}
        </Link>
      </footer>
    </div>
  );
}
