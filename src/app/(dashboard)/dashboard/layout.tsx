import {
  Building2,
  CreditCard,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Wordmark } from '@/components/brand/Seal';
import { Badge } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/modules/identity/actions';
import { AccountTypePrompt } from '@/modules/identity/components/AccountTypePrompt';
import { SetPasswordPrompt } from '@/modules/identity/components/SetPasswordPrompt';
import { SidebarNav } from './components/SidebarNav';

/**
 * Authenticated shell. Server-rendered per request and never cached, so a role
 * change or a suspension takes effect on the next navigation rather than
 * whenever a cache happens to expire.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([getSessionUser(), getTranslation()]);

  // proxy.ts already redirects unauthenticated traffic; this is the second line,
  // because a layout must never render authenticated chrome on a guess.
  if (!user) redirect('/login?next=/dashboard');

  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';

  // A Google-only account has one way back in. Offer a password so it has two.
  // The identity list is read server-side here and re-checked in the action, so
  // the prompt cannot be provoked into overwriting an existing password.
  const {
    data: { user: authUser },
  } = await (await createClient()).auth.getUser();
  const needsPassword =
    (authUser?.identities?.length ?? 0) > 0 &&
    !authUser?.identities?.some((identity: any) => identity.provider === 'email');

  // Google sends no signup metadata, so an OAuth account is created as a
  // customer by default. account_type_chosen_at is null only when nobody has
  // actually been asked, which is exactly who should see the question.
  const { data: profileChoice } = await (await createClient())
    .from('profiles')
    .select('account_type_chosen_at')
    .eq('id', user.id)
    .single();
  const needsAccountType = profileChoice?.account_type_chosen_at == null;

  const n = t.dashboard.nav;

  const nav = [
    { href: '/dashboard', label: n.overview, icon: 'LayoutDashboard', show: true },
    { href: '/dashboard/listings', label: n.myProperties, icon: 'Building2', show: vendor || admin },
    { href: '/dashboard/enquiries', label: n.messages, icon: 'MessageSquare', show: vendor || admin },
    { href: '/dashboard/saved', label: n.saved, icon: 'Heart', show: !vendor && !admin },
    { href: '/dashboard/searches', label: n.savedSearches, icon: 'Search', show: !vendor && !admin },
    { href: '/dashboard/admin', label: n.admin, icon: 'Users', show: admin },
  ].filter((item) => item.show);

  const settingsNav = [
    { href: '/dashboard/settings', label: n.profile, icon: 'Settings', show: !admin },
    { href: '/dashboard/settings/security', label: n.security, icon: 'ShieldCheck', show: !admin },
    { href: '/dashboard/settings/payments', label: n.payments, icon: 'CreditCard', show: vendor },
  ].filter((item) => item.show);

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-50 border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-8xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label={t.nav.home}>
            <Wordmark />
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {user.status !== 'active' && (
              <Badge tone={user.status === 'pending_verification' ? 'pending' : 'rejected'}>
                {user.status === 'pending_verification' ? n.emailNotConfirmed : n.suspended}
              </Badge>
            )}
            {user.aal === 'aal2' && <Badge tone="verified">{n.twoFactorOn}</Badge>}

            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight text-ink-900">{user.fullName ?? 'Your account'}</p>
              <p className="label">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</p>
            </div>

            <form action={signOut}>
              <button
                type="submit"
                className="rounded-sm border border-ink-200 px-3 py-1.5 text-xs text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50"
              >
                {n.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-8xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block border-r border-ink-100 bg-white/50 pr-6">
          <nav aria-label="Dashboard" className="sticky top-24">
            <SidebarNav items={nav} />

            {settingsNav.length > 0 && (
              <>
                <p className="label mt-8 mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-ink-400">{n.settings}</p>
                <SidebarNav items={settingsNav} />
              </>
            )}
          </nav>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {user.status === 'pending_verification' && (
            <div className="mb-6 rounded-sm border border-ochre-100 bg-ochre-50 px-4 py-3 text-sm text-ochre-700">
              {n.confirmEmailBody}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile navigation. Touch targets are 44px and the bar clears the iOS
          home indicator. */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex">
          {[...nav, ...settingsNav.slice(0, 1)].slice(0, 5).map((item) => {
            // Re-map string icons back to components for the mobile nav since it's still server-rendered
            const ICON_MAP: Record<string, React.ElementType> = {
              Building2,
              CreditCard,
              Heart,
              LayoutDashboard,
              MessageSquare,
              Search,
              Settings,
              ShieldCheck,
              Users,
            };
            const Icon = ICON_MAP[item.icon as string] || LayoutDashboard;

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className="flex h-14 flex-col items-center justify-center gap-0.5 text-ink-500 hover:text-royal-700"
                >
                  <Icon aria-hidden className="size-4.5" />
                  <span className="text-[10px] leading-none">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div aria-hidden className="h-14 lg:hidden" />

      {needsAccountType ? <AccountTypePrompt /> : needsPassword && <SetPasswordPrompt />}
    </div>
  );
}
