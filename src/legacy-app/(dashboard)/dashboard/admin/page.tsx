import { AlertTriangle, ArrowRight, Building2, CheckCircle2, CreditCard, Eye, Flag, Image as ImageIcon, ScrollText, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ChartCard, RangeTabs } from '@/components/charts/ChartCard';
import { RankedBars } from '@/components/charts/RankedBars';
import { StatTile } from '@/components/charts/StatTile';
import { StatusPipeline } from '@/components/charts/StatusPipeline';
import { CHART } from '@/components/charts/tokens';
import { TrendChart } from '@/components/charts/TrendChart';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ActivityFeed } from '@/modules/admin/components/ActivityFeed';
import { getPlatformTotals } from '@/modules/admin/master-queries';
import { getAdminStats } from '@/modules/admin/queries';
import { LiveVisitorsPanel } from '@/modules/analytics/components/LiveVisitorsPanel';
import { getLiveAnalytics, getPlatformGrowth, getPortfolioAnalytics } from '@/modules/analytics/queries';

import { PageHeader } from '../components/PageHeader';

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
const RANGES = [7, 30, 90];

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.days);
  const days = RANGES.includes(requested) ? requested : 30;

  const [totals, stats, live, portfolio, growth] = await Promise.all([
    getPlatformTotals(),
    getAdminStats(),
    getLiveAnalytics(),
    getPortfolioAnalytics(days),
    getPlatformGrowth(days),
  ]);

  const vsBefore = `vs the ${days} days before`;

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
        subtitle="Manage the platform, moderate content, and support users."
        action={
          <Button asChild>
            <Link href="/dashboard/listings/new">Post for a seller</Link>
          </Button>
        }
      />

      <LiveVisitorsPanel initial={live} />

      <section>
        <h2 className="label mb-4 text-ink-900">Action Required</h2>
        {queues.some(q => q.urgent) ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {queues.map((queue) => (
              <Link
                key={queue.label}
                href={queue.href}
                className={cn(
                  'group flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-raised',
                  queue.urgent ? 'border-crimson-200 bg-crimson-50/10' : 'border-ink-100 opacity-70 grayscale',
                )}
              >
                <div>
                  <p className="label text-ink-900">{queue.label}</p>
                  <p
                    className={cn(
                      'figure mt-2.5 text-4xl',
                      queue.urgent ? 'text-crimson-700' : 'text-ink-900',
                    )}
                  >
                    {queue.value.toLocaleString('en-IN')}
                  </p>
                  {queue.note && <p className="mt-1 text-xs font-medium text-crimson-700">{queue.note}</p>}
                </div>
                <span className="mt-4 flex items-center gap-1 text-xs font-semibold text-ink-500 transition-colors group-hover:text-crimson-700">
                  Manage <ArrowRight aria-hidden className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/50 py-12 text-center shadow-soft">
            <CheckCircle2 className="mb-3 size-8 text-emerald-500" strokeWidth={1.5} />
            <h3 className="text-lg font-medium text-emerald-900">You're all caught up!</h3>
            <p className="mt-1 text-sm text-emerald-700">There are no pending tasks waiting for your review.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="label mb-4 text-ink-900">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ActionCard title="Moderation" href="/dashboard/admin/moderation" icon={ShieldCheck} />
          <ActionCard title="Users & Roles" href="/dashboard/admin/users" icon={Users} />
          <ActionCard title="All Listings" href="/dashboard/admin/listings" icon={Building2} />
          <ActionCard title="Sales & Rentals" href="/dashboard/admin/sales" icon={TrendingUp} />
          <ActionCard title="Payments" href="/dashboard/admin/payments" icon={CreditCard} />
          <ActionCard title="Reports" href="/dashboard/admin/reports" icon={Flag} />
          <ActionCard title="Settings" href="/dashboard/admin/site" icon={ImageIcon} />
          <ActionCard title="Audit Log" href="/dashboard/admin/audit" icon={ScrollText} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="label text-ink-900">Platform Health</h2>
            <p className="flex items-center gap-2 text-xs font-medium text-ink-500">
              <Eye aria-hidden className="size-3.5" />
              {totals.views.toLocaleString('en-IN')} daily views
            </p>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-soft sm:grid-cols-3">
            <Figure label="Total Users" value={totals.users.toLocaleString('en-IN')} icon={Users} href="/dashboard/admin/users" />
            <Figure label="Live Listings" value={totals.listingsLive.toLocaleString('en-IN')} icon={Building2} href="/dashboard/admin/listings" />
            <Figure label="Value Closed" value={formatPrice(totals.valueClosed)} tone="warm" href="/dashboard/admin/sales" />
          </dl>
        </section>

        <ActivityFeed />
      </div>

      {/*
        The growth charts used to live on a second "admin dashboard" at
        /dashboard, which nothing in the navigation pointed at — the sidebar
        sends the master admin straight here. Two screens each calling
        themselves the overview, one of them unreachable. They are here now,
        and /dashboard redirects.
      */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="label text-ink-900">Trends</h2>
          <RangeTabs current={days} basePath="/dashboard/admin" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatTile
            label="Property views"
            value={portfolio.viewsThisPeriod}
            delta={portfolio.viewsThisPeriod - portfolio.viewsLastPeriod}
            deltaLabel={vsBefore}
            trend={portfolio.views.slice(-12).map((point) => point.value)}
            trendColor={CHART.views}
            icon={Eye}
            href="/dashboard/listings/analytics"
          />
          <StatTile
            label="New properties"
            value={growth.listingsThisPeriod}
            delta={growth.listingsThisPeriod - growth.listingsLastPeriod}
            deltaLabel={vsBefore}
            trend={growth.listings.slice(-12).map((point) => point.value)}
            trendColor={CHART.enquiries}
            icon={Building2}
            href="/dashboard/admin/listings"
          />
          <StatTile
            label="People on Kitta"
            value={growth.totalPeople}
            delta={growth.peopleThisPeriod - growth.peopleLastPeriod}
            deltaLabel={vsBefore}
            trend={growth.people.slice(-12).map((point) => point.value)}
            trendColor={CHART.people}
            icon={Users}
            href="/dashboard/admin/users"
          />
          <StatTile
            label="Sellers"
            value={growth.sellers}
            icon={Users}
            hint="Accounts that can list"
            href="/dashboard/admin/users"
          />
        </div>

        <ChartCard title="Views across the platform" subtitle="Counted once per person per day.">
          <TrendChart
            points={portfolio.views}
            label="Views"
            color={CHART.views}
            height={220}
            emptyMessage="Nothing viewed yet"
          />
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <ChartCard title="New properties" subtitle="Every property added, draft or not.">
            <TrendChart
              points={growth.listings}
              label="New properties"
              color={CHART.enquiries}
              variant="column"
              emptyMessage="Nothing added yet"
            />
          </ChartCard>

          <ChartCard title="New people" subtitle="Accounts created, buyers and sellers together.">
            <TrendChart
              points={growth.people}
              label="New people"
              color={CHART.people}
              variant="column"
              emptyMessage="Nobody new yet"
            />
          </ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-5">
          <ChartCard
            title="Every property on Kitta"
            subtitle="Where the whole catalogue stands right now."
          >
            <StatusPipeline
              total={portfolio.counts.total}
              segments={[
                {
                  key: 'published',
                  label: 'Live',
                  value: portfolio.counts.published,
                  color: CHART.live,
                  href: '/dashboard/admin/listings',
                  note: 'Live on the site and findable in search.',
                },
                {
                  key: 'closed',
                  label: 'Sold or rented',
                  value: portfolio.counts.closed,
                  color: CHART.closed,
                  href: '/dashboard/admin/sales',
                  note: 'Finished. Kept for the record.',
                },
                {
                  key: 'pending_review',
                  label: 'Waiting for review',
                  value: portfolio.counts.pendingReview,
                  color: CHART.checking,
                  href: '/dashboard/admin/moderation',
                  note: 'Submitted before listings went live automatically.',
                },
                {
                  key: 'draft',
                  label: 'Unfinished',
                  value: portfolio.counts.draft,
                  color: CHART.draft,
                  href: '/dashboard/admin/listings',
                  note: 'Started by a seller and not published.',
                },
              ]}
              emptyMessage="Nothing has been listed yet"
            />
          </ChartCard>

          <ChartCard title="Most looked at" subtitle="Which listings are carrying the traffic.">
            <RankedBars
              color={CHART.views}
              valueLabel="views"
              emptyMessage="Nothing viewed yet"
              rows={portfolio.top.map((row) => ({
                id: row.id,
                label: row.title,
                sublabel: `${row.referenceCode} · ${row.enquiries} ${row.enquiries === 1 ? 'enquiry' : 'enquiries'}`,
                value: row.views,
                href: `/dashboard/listings/${row.id}/analytics`,
              }))}
            />
          </ChartCard>
        </div>
      </section>
    </div>
  );
}

function ActionCard({ title, href, icon: Icon }: { title: string; href: string; icon: React.ElementType }) {
  return (
    <Link href={href} className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-100 bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-royal-200 hover:shadow-raised">
      <div className="rounded-full bg-ink-50 p-3 text-ink-500 transition-colors group-hover:bg-royal-50 group-hover:text-royal-600">
        <Icon className="size-6" strokeWidth={1.5} />
      </div>
      <span className="text-sm font-medium text-ink-700 transition-colors group-hover:text-royal-700">{title}</span>
    </Link>
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
