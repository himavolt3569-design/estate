import { Phone } from 'lucide-react';
import Link from 'next/link';

import { Wordmark } from '@/components/brand/Seal';
import { HeaderNav, MobileNav } from '@/components/layout/HeaderNav';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { getTranslation } from '@/i18n';
import { getSessionUser } from '@/lib/auth/session';

export async function SiteHeader() {
  const [user, { t, locale }] = await Promise.all([getSessionUser(), getTranslation()]);

  return (
    <>
      {/*
        Only the 64px bar is pinned.

        The browse rail used to sit inside this sticky header, so on a phone
        168px — nearly a quarter of the screen — was permanently occupied by
        chrome before any content. It is a way in to the four property types,
        not something anybody needs mid-scroll, so it scrolls away with the page
        and comes back at the top.
      */}
      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/70 backdrop-blur-xl">
        {/*
          Every child in this row is allowed to shrink, and the two that must
          not — the wordmark and the action pair — say so explicitly. The old
          row let a "Post your property" button at its natural width push the
          header out to 500px on a 375px screen, which is what put a horizontal
          scrollbar on every page of the site.
        */}
        <div className="mx-auto flex h-16 max-w-8xl items-center gap-3 px-4 sm:h-[68px] sm:gap-6 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0" aria-label={t.nav.home}>
            <Wordmark />
          </Link>

          <HeaderNav t={t.headerNav} />

          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
            <a
              href="tel:+9779801234567"
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 xl:flex"
            >
              <Phone aria-hidden className="size-4 text-crimson-600" />
              <span className="nums">+977 9801234567</span>
            </a>

            {/* The footer carries a switcher of its own below sm, so nothing is
                lost by dropping it out of the header on a phone. */}
            <LanguageSwitcher current={locale} className="hidden md:flex" />

            {user ? (
              <>
                <Button asChild variant="ghost" size="sm" className="min-w-0 max-w-32 px-2 sm:px-3">
                  <Link href="/dashboard" className="truncate">
                    {user.fullName?.split(' ')[0] ?? t.nav.dashboard}
                  </Link>
                </Button>
                <Button asChild size="sm" className="hidden shrink-0 sm:inline-flex">
                  <Link href="/dashboard/listings/new">{t.nav.listProperty}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="shrink-0 px-2 sm:px-3">
                  <Link href="/login">{t.nav.signIn}</Link>
                </Button>
                <Button asChild size="sm" className="shrink-0">
                  {/* The full sentence does not fit beside a sign-in link at
                      375px, and truncating it mid-word reads as a bug. */}
                  <Link href="/register">
                    <span className="sm:hidden">{t.nav.listPropertyShort}</span>
                    <span className="hidden sm:inline">{t.nav.listProperty}</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <MobileNav t={t.headerNav} />
    </>
  );
}

export async function SiteFooter() {
  const { locale, t } = await getTranslation();

  return (
    <footer className="border-t border-royal-800 bg-royal-950 text-white">
      <div className="mx-auto max-w-8xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-4">
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

        <div className="mt-12 flex flex-col gap-2 border-t border-royal-800 pt-6 text-2xs text-royal-400 sm:mt-14 sm:flex-row sm:items-center sm:justify-between">
          <p className="nums">© {new Date().getFullYear()} Kitta</p>
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
