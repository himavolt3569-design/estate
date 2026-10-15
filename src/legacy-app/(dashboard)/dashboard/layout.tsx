import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Wordmark } from '@/components/brand/Seal';
import { Avatar } from '@/components/media/Avatar';
import { Badge } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AccountTypePrompt } from '@/modules/identity/components/AccountTypePrompt';
import { SetPasswordPrompt } from '@/modules/identity/components/SetPasswordPrompt';
import { getUnreadMessageCount } from '@/modules/messaging/queries';

import { ClientLogoutButton } from '@/components/navigation/ClientLogoutButton';
import { MobileDashboardNav } from './components/MobileDashboardNav';
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
  const unreadMessages = await getUnreadMessageCount();

  /*
   * A customer sees Saved and Saved searches; a seller sees their properties and
   * their inbox. The master admin sees every one of those surfaces pointed at
   * the whole platform rather than at their own row, which is why the admin
   * entries are a separate group rather than the same links with a flag.
   */
  const nav = [
    { href: admin ? '/dashboard/admin' : '/dashboard', label: n.overview, icon: 'LayoutDashboard', show: true },
    { href: admin ? '/dashboard/admin/listings' : '/dashboard/listings', label: admin ? 'All properties' : n.myProperties, icon: 'Building2', show: vendor || admin },
    { href: '/dashboard/messages', label: 'Messages', icon: 'MessagesSquare', show: true, badge: unreadMessages },
    { href: '/dashboard/enquiries', label: admin ? 'All enquiries' : n.messages, icon: 'MessageSquare', show: vendor || admin },
    { href: '/dashboard/saved', label: n.saved, icon: 'Heart', show: !vendor && !admin },
    { href: '/dashboard/searches', label: n.savedSearches, icon: 'Search', show: !vendor && !admin },
  ].filter((item) => item.show);

  // The master admin has no personal profile to curate — the seat is the
  // platform's, not a person's — so their settings group is the site's settings.
  const settingsNav = [
    { href: '/dashboard/admin/site', label: 'Platform settings', icon: 'Image', show: admin },
    { href: '/dashboard/admin/audit', label: 'Audit log', icon: 'ScrollText', show: admin },
    { href: '/dashboard/settings', label: n.profile, icon: 'Settings', show: !admin },
    { href: '/dashboard/settings/security', label: n.security, icon: 'ShieldCheck', show: true },
    { href: '/dashboard/settings/payments', label: n.payments, icon: 'CreditCard', show: vendor },
  ].filter((item) => item.show);

  // Four tabs in the phone's bottom bar; everything else — including the links
  // the old five-item slice was silently dropping — goes behind "More".
  const allNav = [...nav, ...settingsNav];
  const primaryNav = allNav.slice(0, 4);
  const overflowNav = allNav.slice(4);

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-50 border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-8xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label={t.nav.home} className="shrink-0">
            <Wordmark />
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            {user.status !== 'active' && (
              <Badge
                tone={user.status === 'pending_verification' ? 'pending' : 'rejected'}
                className="hidden sm:inline-flex"
              >
                {user.status === 'pending_verification' ? n.emailNotConfirmed : n.suspended}
              </Badge>
            )}

            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm leading-tight text-ink-900">
                {user.fullName ?? 'Your account'}
              </p>
              <p className="label">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</p>
            </div>

            <Link
              href="/dashboard/settings"
              aria-label="Your account and picture"
              className="shrink-0"
            >
              <Avatar src={user.avatarUrl} name={user.fullName} size="sm" />
            </Link>

            {/* On a phone this lives in the "More" sheet instead, where it has
                room to be a full-width target rather than a 60px pill. */}
            <div className="hidden shrink-0 lg:block">
              <ClientLogoutButton label={n.signOut} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-8xl gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <aside className="hidden w-64 shrink-0 border-r border-ink-100 pr-6 lg:block">
          <nav aria-label="Dashboard" className="sticky top-24">
            <SidebarNav items={nav} />

            {settingsNav.length > 0 && (
              <>
                <p className="label mt-8 mb-3 px-4">{n.settings}</p>
                <SidebarNav items={settingsNav} />
              </>
            )}
          </nav>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {user.status === 'pending_verification' && (
            <div className="mb-6 rounded-xl border border-ochre-200 bg-ochre-50 px-4 py-3 text-sm text-ochre-700">
              {n.confirmEmailBody}
            </div>
          )}
          {children}
        </main>
      </div>

      <MobileDashboardNav
        primary={primaryNav}
        rest={overflowNav}
        signOut={<ClientLogoutButton label={n.signOut} full />}
      />
      {/* Clears the fixed bar plus the home indicator, so the last row of a
          page is never sitting underneath it. */}
      <div
        aria-hidden
        className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden"
      />

      {needsAccountType ? <AccountTypePrompt /> : needsPassword && <SetPasswordPrompt />}
    </div>
  );
}
