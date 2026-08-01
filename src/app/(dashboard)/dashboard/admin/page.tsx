import { AlertTriangle, ArrowRight, Building2, Eye, MessageSquare, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ActivityFeed } from '@/modules/admin/components/ActivityFeed';
import { getPlatformTotals } from '@/modules/admin/master-queries';
import { getAdminStats } from '@/modules/admin/queries';

import { PageHeader, Panel } from '../components/PageHeader';

export const metadata: Metadata = { title: 'Control centre', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * The master admin's first screen.
 *
 * Two halves, on purpose. The top is the state of the platform — everything,
 * with nothing rolled up or hidden, because the owner asked to be able to see
 * the whole thing at once. The bottom is work: every number there is a queue
 * with somebody waiting at the end of it, so each one is a link.
 *
 * The counters come from two places. admin_dashboard_stats() answers the queue
 * questions in one round trip but returns null if the database refuses it, so
 * the platform totals are computed separately and the page still renders when
 * only one of the two succeeds.
 */
export default async function AdminOverviewPage() {
  const [totals, stats] = await Promise.all([getPlatformTotals(), getAdminStats()]);

  if (!totals) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        title="Could not load the control centre"
        description="The database refused the request. Sign out and back in; if it keeps happening, this account may no longer hold the master admin role."
      />
    );
  }

  const queues = [
    {
      label: 'Listings waiting for review',
      value: stats?.properties_pending ?? totals.listingsPending,
      href: '/dashboard/admin/moderation',
      urgent: (stats?.properties_pending ?? totals.listingsPending) > 0,
    },
    {
      label: 'Open reports',
      value: stats?.reports_open ?? 0,
      href: '/dashboard/admin/reports',
      urgent: (stats?.reports_overdue ?? 0) > 0,
      note: (stats?.reports_overdue ?? 0) > 0 ? `${stats?.reports_overdue} past due` : undefined,
    },
    {
      label: 'Payments to check',
      value: stats?.payments_pending ?? 0,
      href: '/dashboard/admin/payments',
      urgent: (stats?.payments_pending ?? 0) > 0,
    },
    {
      label: 'Suspended accounts',
      value: stats?.users_suspended ?? 0,
      href: '/dashboard/admin/users',
      urgent: false,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Master admin"
        title="Control centre"
        subtitle="Everything on the platform, and everything waiting on you."
        action={
          <Button asChild>
            <Link href="/dashboard/listings/new">Post for a seller</Link>
          </Button>
        }
      />

      <section>
        <h2 className="label mb-4">The platform</h2>
        <dl className="grid gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
          <Figure label="People" value={totals.users.toLocaleString('en-IN')} icon={Users} href="/dashboard/admin/users" />
          <Figure label="Sellers" value={totals.vendors.toLocaleString('en-IN')} href="/dashboard/admin/users" />
          <Figure label="Live listings" value={totals.listingsLive.toLocaleString('en-IN')} icon={Building2} href="/dashboard/listings" />
          <Figure label="Drafts not finished" value={totals.listingsDraft.toLocaleString('en-IN')} href="/dashboard/listings" />

          <Figure label="Sold" value={totals.sold.toLocaleString('en-IN')} tone="good" href="/dashboard/admin/sales" />
          <Figure label="Rented or leased" value={totals.rented.toLocaleString('en-IN')} tone="good" href="/dashboard/admin/sales" />
          <Figure label="Value closed" value={formatPrice(totals.valueClosed)} tone="warm" href="/dashboard/admin/sales" />
          <Figure label="Enquiries" value={totals.enquiries.toLocaleString('en-IN')} icon={MessageSquare} href="/dashboard/enquiries" />
        </dl>

        <p className="mt-3 flex items-center gap-2 text-xs text-ink-500">
          <Eye aria-hidden className="size-3.5" />
          {totals.views.toLocaleString('en-IN')} property views counted, one per person per day.
        </p>
      </section>

      <section>
        <h2 className="label mb-4">Waiting on you</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((queue) => (
            <Link
              key={queue.label}
              href={queue.href}
              className={cn(
                'group rounded-2xl border bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-raised',
                queue.urgent ? 'border-crimson-200' : 'border-ink-100',
              )}
            >
              <p className="label">{queue.label}</p>
              <p
                className={cn(
                  'figure mt-2.5 text-4xl',
                  queue.urgent ? 'text-crimson-700' : 'text-ink-900',
                )}
              >
                {queue.value.toLocaleString('en-IN')}
              </p>
              {queue.note && <p className="mt-1 text-xs text-clay-700">{queue.note}</p>}
              <span className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-500 transition-colors group-hover:text-crimson-700">
                Open <ArrowRight aria-hidden className="size-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel accent className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink-900">What this seat can do</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-ink-600">
            <li>
              <Link href="/dashboard/listings" className="font-medium text-crimson-700 hover:underline">
                Every listing
              </Link>{' '}
              — read, edit and publish any property, whoever posted it.
            </li>
            <li>
              <Link href="/dashboard/admin/users" className="font-medium text-crimson-700 hover:underline">
                Every account
              </Link>{' '}
              — correct a name, change a sign-in email, set a password, change a role.
            </li>
            <li>
              <Link href="/dashboard/listings/new" className="font-medium text-crimson-700 hover:underline">
                Post on someone&rsquo;s behalf
              </Link>{' '}
              — for a seller who rang the office instead of using the site.
            </li>
            <li>
              <Link href="/dashboard/admin/site" className="font-medium text-crimson-700 hover:underline">
                The home page background
              </Link>{' '}
              — change the picture visitors land on.
            </li>
            <li>
              <Link href="/dashboard/admin/audit" className="font-medium text-crimson-700 hover:underline">
                The record
              </Link>{' '}
              — every privileged change is written down with your name and your reason.
            </li>
          </ul>
        </Panel>

        <ActivityFeed />
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  tone?: 'good' | 'warm';
  href: string;
}) {
  return (
    <Link href={href} className="group bg-white px-5 py-4 transition-colors hover:bg-ink-50/70">
      <dt className="flex items-center gap-2 text-ink-400">
        {Icon && <Icon aria-hidden className="size-3.5" />}
        <span className="label">{label}</span>
      </dt>
      <dd
        className={cn(
          'figure mt-2.5 text-3xl',
          tone === 'warm' && 'text-marigold-800',
          tone === 'good' && 'text-emerald-700',
          !tone && 'text-ink-900',
        )}
      >
        {value}
      </dd>
    </Link>
  );
}
