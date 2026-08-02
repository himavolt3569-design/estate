import {
  ArrowRight,
  Building2,
  Eye,
  Heart,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
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
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { formatPrice, formatRelative } from '@/lib/format';
import {
  getBuyerActivity,
  getPlatformGrowth,
  getPortfolioAnalytics,
} from '@/modules/analytics/queries';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90];

/**
 * The dashboard.
 *
 * It used to be six counters in a row. A counter answers "how many", which is
 * the least useful question a seller has — they already know they have three
 * properties. What they cannot know from a number is whether interest is
 * building or dying, which listing is carrying the others, and what is stuck.
 * That is what the charts are for, and it is why every figure on this page
 * carries a direction as well as a value.
 *
 * The whole page is scoped by the range in the URL, so the charts and the
 * figures are physically incapable of disagreeing, and a seller can bookmark
 * "last 90 days".
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const [user, { locale, t }, params] = await Promise.all([
    getSessionUser(),
    getTranslation(),
    searchParams,
  ]);
  if (!user) return null;

  const d = t.dashboard;
  const c = d.charts;
  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';

  const requested = Number(params.days);
  const days = RANGES.includes(requested) ? requested : 30;
  const vsBefore = c.vsBefore.replace('{n}', String(days));

  const firstName = user.fullName?.split(' ')[0];
  const today = new Date().toLocaleDateString(locale === 'ne' ? 'ne-NP' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-8 pb-10">
      <header className="relative overflow-hidden bg-royal-900 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="label label-light">{today}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              {d.greeting}
              {firstName ? `, ${firstName}` : ''}
            </h1>
          </div>

          <Button asChild variant="inverse" size="lg">
            <Link href={vendor || admin ? '/dashboard/listings/new' : '/search'}>
              {vendor || admin ? <Plus aria-hidden /> : <Search aria-hidden />}
              {vendor || admin ? d.addProperty : d.startCta}
            </Link>
          </Button>
        </div>
      </header>


      {admin ? (
        <AdminDashboard days={days} vsBefore={vsBefore} t={t} />
      ) : vendor ? (
        <SellerDashboard days={days} vsBefore={vsBefore} t={t} />
      ) : (
        <BuyerDashboard t={t} />
      )}
    </div>
  );
}

type Dict = Awaited<ReturnType<typeof getTranslation>>['t'];

/* ========================================================================== */
/* Seller                                                                     */
/* ========================================================================== */

async function SellerDashboard({
  days,
  vsBefore,
  t,
}: {
  days: number;
  vsBefore: string;
  t: Dict;
}) {
  const a = await getPortfolioAnalytics(days);
  const d = t.dashboard;
  const c = d.charts;

  if (a.counts.total === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<Building2 className="size-6" />}
          title={d.noListingsTitle}
          description={d.noListingsBody}
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">{d.addFirst}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="label">{d.yourProperties}</h2>
        <RangeTabs current={days} basePath="/dashboard" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={d.peopleLooked}
          value={a.viewsThisPeriod}
          delta={a.viewsThisPeriod - a.viewsLastPeriod}
          deltaLabel={vsBefore}
          trend={a.views.slice(-12).map((point) => point.value)}
          trendColor={CHART.views}
          icon={Eye}
          href="/dashboard/listings/analytics"
        />
        <StatTile
          label={d.messagesTitle}
          value={a.enquiriesThisPeriod}
          delta={a.enquiriesThisPeriod - a.enquiriesLastPeriod}
          deltaLabel={vsBefore}
          trend={a.enquiries.slice(-12).map((point) => point.value)}
          trendColor={CHART.enquiries}
          icon={MessageSquare}
          tone={a.newEnquiries > 0 ? 'pending' : 'flat'}
          href="/dashboard/enquiries"
        />
        <StatTile
          label={d.liveNow}
          value={a.counts.published}
          icon={Building2}
          tone="good"
          hint={`${a.counts.total} in total`}
          href="/dashboard/listings?status=published"
        />
        <StatTile
          label={d.savedProperties}
          value={a.totalSaves}
          icon={Heart}
          hint="Buyers who kept one of yours"
          href="/dashboard/listings/analytics"
        />
      </div>

      {/* Two charts, not one with two axes. Views run in the hundreds and
          enquiries in the ones; sharing an axis would flatten one of them and
          sharing a chart with two axes would let the scales tell any story we
          liked. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={c.viewsTitle} subtitle={c.viewsSubtitle}>
          <TrendChart
            points={a.views}
            label={c.views}
            color={CHART.views}
            emptyMessage={c.noViewsYet}
          />
        </ChartCard>

        <ChartCard title={c.enquiriesTitle} subtitle={c.enquiriesSubtitle}>
          <TrendChart
            points={a.enquiries}
            label={d.messagesTitle}
            color={CHART.enquiries}
            variant="column"
            emptyMessage={c.noEnquiriesYet}
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <ChartCard title={c.pipelineTitle} subtitle={c.pipelineSubtitle}>
          <StatusPipeline
            total={a.counts.total}
            segments={pipelineSegments(a.counts, d)}
            emptyMessage={d.noListingsTitle}
          />
        </ChartCard>

        <ChartCard title={c.topTitle} subtitle={c.topSubtitle}>
          <RankedBars
            color={CHART.views}
            valueLabel={c.views}
            emptyMessage={c.noViewsYet}
            rows={a.top.map((row) => ({
              id: row.id,
              label: row.title,
              sublabel: `${row.referenceCode} · ${row.enquiries} ${row.enquiries === 1 ? 'enquiry' : 'enquiries'}`,
              value: row.views,
              href: `/dashboard/listings/${row.id}/analytics`,
            }))}
          />
        </ChartCard>
      </div>

      {a.needsAttention.length > 0 && (
        <section className="rounded-2xl border border-marigold-200 bg-marigold-50/50 p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-marigold-900">
            <TriangleAlert aria-hidden className="size-4" />
            {c.attentionTitle}
          </h3>
          <ul className="mt-4 divide-y divide-marigold-200/70">
            {a.needsAttention.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/dashboard/listings/${row.id}/edit`}
                  className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900 group-hover:text-crimson-700">
                      {row.title}
                    </p>
                    <p className="mt-0.5 text-xs text-marigold-900/80">{row.reason}</p>
                  </div>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-marigold-700 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="label">{d.messagesTitle}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/enquiries">
              {d.openInbox} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        {a.totalEnquiries === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-6" />}
            title={d.noMessagesTitle}
            description={d.noMessagesBody}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              label={d.totalMessages}
              value={a.totalEnquiries}
              href="/dashboard/enquiries"
            />
            <StatTile
              label={d.newMessages}
              value={a.newEnquiries}
              tone={a.newEnquiries > 0 ? 'pending' : 'flat'}
              href="/dashboard/enquiries"
            />
          </div>
        )}
      </section>
    </div>
  );
}

/* ========================================================================== */
/* Master admin                                                               */
/* ========================================================================== */

async function AdminDashboard({
  days,
  vsBefore,
  t,
}: {
  days: number;
  vsBefore: string;
  t: Dict;
}) {
  const [a, growth] = await Promise.all([getPortfolioAnalytics(days), getPlatformGrowth(days)]);
  const d = t.dashboard;
  const c = d.charts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="label">Platform overview</h2>
        <RangeTabs current={days} basePath="/dashboard" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Property views"
          value={a.viewsThisPeriod}
          delta={a.viewsThisPeriod - a.viewsLastPeriod}
          deltaLabel={vsBefore}
          trend={a.views.slice(-12).map((point) => point.value)}
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
          href="/dashboard/listings"
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
          label="Waiting for review"
          value={a.counts.pendingReview}
          icon={ShieldCheck}
          tone={a.counts.pendingReview > 0 ? 'pending' : 'flat'}
          hint={a.counts.pendingReview > 0 ? 'Sellers are waiting on you' : 'Queue is clear'}
          href="/dashboard/admin/moderation"
        />
      </div>

      <ChartCard title={c.platformViewsTitle} subtitle={c.viewsSubtitle}>
        <TrendChart
          points={a.views}
          label={c.views}
          color={CHART.views}
          height={220}
          emptyMessage={c.noViewsYet}
        />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={c.newListingsTitle} subtitle="Every property added, draft or not.">
          <TrendChart
            points={growth.listings}
            label={c.newListingsTitle}
            color={CHART.enquiries}
            variant="column"
            emptyMessage="Nothing added yet"
          />
        </ChartCard>

        <ChartCard title={c.newPeopleTitle} subtitle="Accounts created, buyers and sellers together.">
          <TrendChart
            points={growth.people}
            label={c.newPeopleTitle}
            color={CHART.people}
            variant="column"
            emptyMessage="Nobody new yet"
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <ChartCard title="Every property on Kitta" subtitle={c.pipelineSubtitle}>
          <StatusPipeline
            total={a.counts.total}
            segments={pipelineSegments(a.counts, d)}
            emptyMessage="Nothing has been listed yet"
          />
        </ChartCard>

        <ChartCard title="Most looked at" subtitle={c.topSubtitle}>
          <RankedBars
            color={CHART.views}
            valueLabel={c.views}
            emptyMessage={c.noViewsYet}
            rows={a.top.map((row) => ({
              id: row.id,
              label: row.title,
              sublabel: `${row.referenceCode} · ${row.enquiries} ${row.enquiries === 1 ? 'enquiry' : 'enquiries'}`,
              value: row.views,
              href: `/dashboard/listings/${row.id}/analytics`,
            }))}
          />
        </ChartCard>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Sellers" value={growth.sellers} icon={Users} href="/dashboard/admin/users" />
        <StatTile label={d.totalMessages} value={a.totalEnquiries} icon={MessageSquare} href="/dashboard/enquiries" />
        <StatTile
          label="Sold or rented"
          value={a.counts.closed}
          tone="good"
          icon={Building2}
          href="/dashboard/admin/sales"
        />
      </section>
    </div>
  );
}

/* ========================================================================== */
/* Buyer                                                                      */
/* ========================================================================== */

async function BuyerDashboard({ t }: { t: Dict }) {
  const activity = await getBuyerActivity();
  const d = t.dashboard;
  const c = d.charts;

  return (
    <div className="space-y-6">
      <h2 className="label">{d.quickActions}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={d.savedProperties}
          value={activity.savedCount}
          icon={Heart}
          href="/dashboard/saved"
        />
        <StatTile
          label={d.savedSearches}
          value={activity.savedSearchCount}
          icon={Search}
          href="/dashboard/searches"
        />
        <StatTile
          label="Enquiries you sent"
          value={activity.enquiriesSent}
          icon={MessageSquare}
          href="/dashboard/enquiries"
        />
      </div>

      {activity.savedCount === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title={d.startTitle}
          description={d.startBody}
          action={
            <Button asChild>
              <Link href="/search">{d.startCta}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title={c.lookingFor}
            subtitle="Everything you have saved, grouped by what it is."
          >
            <RankedBars
              color={CHART.saved}
              valueLabel={c.saved}
              rows={activity.byCategory.map((row) => ({
                id: row.label,
                label: row.label,
                value: row.value,
                href: '/dashboard/saved',
              }))}
            />
          </ChartCard>

          <ChartCard title={c.recentlySaved} subtitle="The last few you kept.">
            <ul className="divide-y divide-ink-100">
              {activity.recent.map((row) => (
                <li key={row.id}>
                  <Link
                    href={
                      row.provinceSlug && row.locationSlug
                        ? `/properties/${row.provinceSlug}/${row.locationSlug}/${row.slug}`
                        : '/dashboard/saved'
                    }
                    className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900 group-hover:text-crimson-700">
                        {row.title}
                      </p>
                      <p className="nums mt-0.5 text-xs text-ink-500">
                        {formatPrice(row.price, {
                          period: row.pricePeriod as 'month' | 'year' | 'night' | null,
                        })}{' '}
                        · saved {formatRelative(row.savedAt)}
                      </p>
                    </div>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-crimson-600"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>
      )}

      {/* A customer can become a seller at any time. Surfacing it here beats
          hiding it in settings, since most people only realise later. */}
      <div className="ticked border border-ink-900 bg-sand-50 p-6">
        <p className="label">{d.sellingTitle}</p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">{d.sellingBody}</p>
        <Button asChild variant="secondary" size="sm" className="mt-5">
          <Link href="/dashboard/listings/new">
            {d.addProperty} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Stack order is the accessibility mechanism, not decoration: emerald and
 * marigold are hard to tell apart under protanopia, so "sold" sits between
 * them. Grey for "not finished" is deliberate — nothing has happened to those
 * yet — and it is always read with its label and count beside it.
 */
function pipelineSegments(
  counts: { published: number; closed: number; pendingReview: number; draft: number },
  d: Dict['dashboard'],
) {
  return [
    {
      key: 'published',
      label: d.liveNow,
      value: counts.published,
      color: CHART.live,
      href: '/dashboard/listings?status=published',
      note: 'Live on the site and findable in search.',
    },
    {
      key: 'closed',
      label: 'Sold or rented',
      value: counts.closed,
      color: CHART.closed,
      href: '/dashboard/listings?status=closed',
      note: 'Finished. Kept for your records.',
    },
    {
      key: 'pending_review',
      label: d.beingChecked,
      value: counts.pendingReview,
      color: CHART.checking,
      href: '/dashboard/listings?status=pending_review',
      note: 'With our team. This usually takes a day.',
    },
    {
      key: 'draft',
      label: d.notFinished,
      value: counts.draft,
      color: CHART.draft,
      href: '/dashboard/listings?status=draft',
      note: 'Not sent to us yet — open one to finish it.',
    },
  ];
}
