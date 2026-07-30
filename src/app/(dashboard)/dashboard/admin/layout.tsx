import { FileClock, Flag, Gauge, CreditCard, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';

/**
 * The admin shell.
 *
 * Two gates, and neither is the real one. `platform_admin` plus a second factor
 * is asserted here so the UI never renders admin chrome on a guess, and every
 * RPC behind these pages asserts the same thing again inside Postgres via
 * is_admin(). If this file were deleted, the control centre would still be
 * closed; this only decides what gets drawn.
 */
const NAV = [
  { href: '/dashboard/admin', label: 'Overview', icon: Gauge, exact: true },
  { href: '/dashboard/admin/moderation', label: 'Moderation', icon: ShieldCheck },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/reports', label: 'Reports', icon: Flag },
  { href: '/dashboard/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/admin/audit', label: 'Audit log', icon: FileClock },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  // A stolen aal1 token must not reach the control centre. The database refuses
  // it anyway; this turns that refusal into a route the admin can act on.
  if (user.aal !== 'aal2') {
    redirect('/dashboard/settings/security?reason=admin-requires-2fa');
  }

  return (
    <div className="pb-10">
      <header className="border-b border-ink-900 pb-4">
        <p className="label">Master admin</p>
        <h1 className="mt-2 text-display-md text-ink-900">Control centre</h1>
      </header>

      <nav aria-label="Admin" className="mt-6 overflow-x-auto">
        <ul className="flex min-w-max gap-px bg-ink-200">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm text-ink-600 transition-colors hover:bg-royal-900 hover:text-white"
              >
                <item.icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
