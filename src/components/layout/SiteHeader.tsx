import { Phone } from 'lucide-react';
import Link from 'next/link';

import { Wordmark } from '@/components/brand/Seal';
import { HeaderNav, MobileNav } from '@/components/layout/HeaderNav';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { getTranslation } from '@/i18n';
import { getSessionUser } from '@/lib/auth/session';

/**
 * Server component. The header renders per-request with the real session, so
 * there is no flash of the signed-out state and no client-side auth check.
 */
export async function SiteHeader() {
  const [user, { t }] = await Promise.all([getSessionUser(), getTranslation()]);

  return (
    /*
     * Three stops. Buy, Rent, Land and Shops are one question, so they live in
     * one menu; the two calculators are their own destinations. Everything about
     * the account sits on the right, and the phone number only appears once
     * there is room for it without crowding the actions.
     */
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[68px] max-w-8xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label={t.nav.home}>
          <Wordmark />
        </Link>

        <HeaderNav />

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <a
            href="tel:+9779801234567"
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 xl:flex"
          >
            <Phone aria-hidden className="size-4 text-crimson-600" />
            <span className="nums">+977 9801234567</span>
          </a>

          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">{user.fullName?.split(' ')[0] ?? t.nav.dashboard}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard/listings/new">{t.nav.listProperty}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t.nav.signIn}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t.nav.listProperty}</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <MobileNav />
    </header>
  );
}


export async function SiteFooter() {
  const { locale, t } = await getTranslation();

  return (
    <footer className="border-t border-royal-800 bg-royal-950 text-white">
      <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Wordmark tone="light" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-royal-300">{t.footer.about}</p>
            <LanguageSwitcher current={locale} className="mt-6 sm:hidden" />
          </div>

          <FooterColumn
            title={t.footer.search}
            links={[
              { href: '/search?transaction_type=sale', label: t.footer.housesForSale },
              { href: '/search?transaction_type=rent', label: t.footer.rentals },
              { href: '/search?category=land', label: t.footer.land },
              { href: '/search?category=commercial', label: t.footer.commercial },
            ]}
          />
          <FooterColumn
            title={t.footer.posting}
            links={[
              { href: '/register', label: t.footer.listProperty },
              { href: '/how-verification-works', label: t.footer.howChecking },
              { href: '/dashboard', label: t.footer.yourAccount },
            ]}
          />
          <FooterColumn
            title={t.footer.platform}
            links={[
              { href: '/about', label: t.footer.aboutUs },
              { href: '/contact', label: t.auth.contact },
              { href: '/terms', label: t.auth.terms },
              { href: '/privacy', label: t.auth.privacy },
              { href: '/report', label: t.footer.report },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-royal-800 pt-6 text-2xs text-royal-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="nums">© {new Date().getFullYear()} Kitta</p>
          {/* ODbL requires attribution wherever OSM data is shown. */}
          <p>
            {t.footer.mapCredit}{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline underline-offset-2 hover:text-white"
              rel="noreferrer noopener"
              target="_blank"
            >
              OpenStreetMap
            </a>{' '}
            {t.footer.contributors}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h3 className="label label-light">{title}</h3>
      <ul className="mt-3 space-y-0.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="-mx-2 inline-block rounded-lg px-2 py-1.5 text-sm text-royal-200 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
