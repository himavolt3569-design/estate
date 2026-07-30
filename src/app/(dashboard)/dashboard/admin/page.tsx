import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { ActivityFeed } from '@/modules/admin/components/ActivityFeed';
import { getAdminStats } from '@/modules/admin/queries';

export const metadata: Metadata = { title: 'Control centre', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();

  if (!stats) {
    return (
      <EmptyState
        title="Could not load the dashboard"
        description="The database refused the request. This usually means the second factor is no longer valid on this session. Sign in again."
        icon={<AlertTriangle className="size-6" />}
      />
    );
  }

  // Anything with a number attached is a queue somebody has to work through, so
  // every tile links to the screen where the work happens.
  const queues = [
    {
      label: 'Listings waiting for review',
      value: stats.properties_pending,
      href: '/dashboard/admin/moderation',
      urgent: stats.properties_pending > 0,
    },
    {
      label: 'Open reports',
      value: stats.reports_open,
      href: '/dashboard/admin/reports',
      urgent: stats.reports_overdue > 0,
      note: stats.reports_overdue > 0 ? `${stats.reports_overdue} past due` : undefined,
    },
    {
      label: 'Payments to check',
      value: stats.payments_pending,
      href: '/dashboard/admin/payments',
      urgent: stats.payments_pending > 0,
    },
    {
      label: 'Suspended accounts',
      value: stats.users_suspended,
      href: '/dashboard/admin/users?status=suspended',
      urgent: false,
    },
  ];

  const totals = [
    { label: 'Live listings', value: stats.properties_published },
    { label: 'All listings', value: stats.properties_total },
    { label: 'People', value: stats.users_total },
    { label: 'Sellers and agents', value: stats.vendors_total },
    { label: 'New people this week', value: stats.users_new_7d },
    { label: 'Enquiries this week', value: stats.enquiries_7d },
  ];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="label mb-4">Needs attention</h2>
        <ul className="grid gap-px bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((queue) => (
            <li key={queue.label}>
              <Link
                href={queue.href}
                className="group flex h-full flex-col justify-between gap-6 bg-white p-5 transition-colors hover:bg-royal-900"
              >
                <span className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'nums text-4xl leading-none font-extralight',
                      queue.urgent ? 'text-clay-700' : 'text-ink-900',
                      'group-hover:text-white',
                    )}
                  >
                    {queue.value}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 size-4 shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-300"
                  />
                </span>
                <span>
                  <span className="block text-sm text-ink-700 transition-colors group-hover:text-white">
                    {queue.label}
                  </span>
                  {queue.note && (
                    <span className="mt-1 block text-2xs text-clay-700 transition-colors group-hover:text-ochre-200">
                      {queue.note}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h2 className="label mb-4">The platform</h2>
          <dl className="grid gap-px bg-ink-200 sm:grid-cols-3">
            {totals.map((total) => (
              <div key={total.label} className="bg-white p-5">
                <dd className="nums text-2xl leading-none font-medium text-ink-900">
                  {total.value.toLocaleString('en-IN')}
                </dd>
                <dt className="mt-2 text-xs leading-snug text-ink-500">{total.label}</dt>
              </div>
            ))}
          </dl>

          {stats.verifications_pending > 0 && (
            <p className="mt-4 border-l-2 border-ochre-600 pl-4 text-sm text-ink-600">
              {stats.verifications_pending} verification{' '}
              {stats.verifications_pending === 1 ? 'request is' : 'requests are'} waiting for a
              document check.
            </p>
          )}
        </section>

        <ActivityFeed />
      </div>
    </div>
  );
}
