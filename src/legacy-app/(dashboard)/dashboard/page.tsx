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
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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
import { cn } from '@/lib/utils';
import { getBuyerActivity, getPortfolioAnalytics } from '@/modules/analytics/queries';

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

  // The master admin's overview is the control centre. Rendering a second,
  // different platform dashboard here meant two screens claiming to be "the
  // overview" and disagreeing about what was on them.
  if (user.role === 'platform_admin') redirect('/dashboard/admin');

  const d = t.dashboard;
  const c = d.charts;
  const vendor = isVendor(user.role);

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
    <div className="space-y-6 pb-4 sm:space-y-8">
      {/* Rounded rather than a full-bleed slab: inside `main` it has the page
          gutter either side of it anyway, so square corners just read as a
          panel that failed to get its radius. */}
      <header className="relative overflow-hidden rounded-2xl bg-royal-900 text-white shadow-raised">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-5 sm:gap-6 sm:p-8">
          <div className="min-w-0">
            <p className="label label-light">{today}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:mt-3 sm:text-4xl">
              {d.greeting}
              {firstName ? `, ${firstName}` : ''}
            </h1>
          </div>

          {/* Full width on a phone. A 200px button floating on the right of a
              375px card is the shape that makes a dashboard feel cramped. */}
          <Button asChild variant="inverse" size="lg" className="w-full sm:w-auto">
            <Link href={vendor ? '/dashboard/listings/new' : '/search'}>
              {vendor ? <Plus aria-hidden /> : <Search aria-hidden />}
              {vendor ? d.addProperty : d.startCta}
            </Link>
          </Button>
        </div>
      </header>

      {vendor ? (
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
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

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-5">
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
/* Buyer                                                                      */
/* ========================================================================== */

/**
 * The buyer's dashboard.
 *
 * It used to be three counters and a bar chart of categories, which told the
 * buyer things they already knew — they are aware they saved six properties.
 * What they cannot see without opening all six is the shape of their own
 * shortlist: what it costs, where it is, and how much of it anybody has
 * actually checked. That is what this answers, and every panel is a way back
 * into a property rather than a read-only figure.
 */
async function BuyerDashboard({ t }: { t: Dict }) {
  const activity = await getBuyerActivity();
  const d = t.dashboard;
  const c = d.charts;

  if (activity.savedCount === 0 && activity.savedSearchCount === 0) {
    return (
      <div className="space-y-6">
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
        <BecomeASeller d={d} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="label">Your shortlist</h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label={d.savedProperties}
          value={activity.savedCount}
          icon={Heart}
          href="/dashboard/saved"
        />
        <StatTile
          label="Checked by us"
          value={activity.verifiedSaved}
          icon={ShieldCheck}
          tone="good"
          hint={
            activity.savedCount === 0
              ? undefined
              : `of ${activity.savedCount} you have saved`
          }
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

      {/* The budget band. Rents are excluded upstream, so this is only ever a
          range of asking prices and never a house against a monthly rent. */}
      {activity.priceBand && (
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6">
          <h3 className="text-sm font-semibold text-ink-900">What you are looking at</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            The asking prices across everything you have saved to buy.
          </p>

          <dl className="mt-4 grid grid-cols-3 gap-3 sm:gap-6">
            <div className="min-w-0">
              <dt className="label">Lowest</dt>
              <dd className="nums mt-1.5 truncate text-lg font-semibold text-ink-900 sm:text-xl">
                {formatPrice(activity.priceBand.min)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="label text-crimson-600">Typical</dt>
              <dd className="nums mt-1.5 truncate text-lg font-semibold text-ink-900 sm:text-xl">
                {formatPrice(activity.priceBand.median)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="label">Highest</dt>
              <dd className="nums mt-1.5 truncate text-lg font-semibold text-ink-900 sm:text-xl">
                {formatPrice(activity.priceBand.max)}
              </dd>
            </div>
          </dl>

          <Button asChild variant="ghost" size="sm" className="mt-4 -ml-3">
            {/* price_min/price_max are paisa in the URL, which is what the
                price column already holds — no conversion. */}
            <Link
              href={`/search?price_min=${activity.priceBand.min}&price_max=${activity.priceBand.max}`}
            >
              See everything in this range <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {activity.byLocality.length > 0 && (
          <ChartCard title="Where you are looking" subtitle="Your saved properties by district.">
            <RankedBars
              color={CHART.saved}
              valueLabel={c.saved}
              rows={activity.byLocality.map((row) => ({
                id: row.label,
                label: row.label,
                value: row.value,
                href: '/dashboard/saved',
              }))}
            />
          </ChartCard>
        )}

        <ChartCard
          title={c.lookingFor}
          subtitle="Everything you have saved, grouped by what it is."
        >
          <RankedBars
            color={CHART.views}
            valueLabel={c.saved}
            emptyMessage="Nothing saved yet"
            rows={activity.byCategory.map((row) => ({
              id: row.label,
              label: row.label,
              value: row.value,
              href: '/dashboard/saved',
            }))}
          />
        </ChartCard>
      </div>

      {activity.recent.length > 0 && (
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
                  className="group flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900 group-hover:text-crimson-700">
                      <span className="truncate">{row.title}</span>
                      {row.verified && (
                        <ShieldCheck
                          aria-label="Checked by our team"
                          className="size-3.5 shrink-0 text-emerald-600"
                        />
                      )}
                    </p>
                    <p className="nums mt-0.5 truncate text-xs text-ink-500">
                      {formatPrice(row.price, {
                        period: row.pricePeriod as 'month' | 'year' | 'night' | null,
                      })}
                      {row.locality ? ` · ${row.locality}` : ''} · saved{' '}
                      {formatRelative(row.savedAt)}
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
      )}

      {/* Saved searches were a bare count with no way through to any of them.
          A saved search is a standing instruction; it should be one tap away. */}
      {activity.searches.length > 0 && (
        <ChartCard
          title={d.savedSearches}
          subtitle="We watch these for you and tell you when something new matches."
        >
          <ul className="divide-y divide-ink-100">
            {activity.searches.map((row) => (
              <li key={row.id}>
                <Link
                  href="/dashboard/searches"
                  className="group flex items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 group-hover:text-crimson-700">
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      row.notify ? 'text-emerald-700' : 'text-ink-400',
                    )}
                  >
                    {row.notify ? `Alerts ${row.frequency ?? 'on'}` : 'Alerts off'}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-crimson-600"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      <BecomeASeller d={d} />
    </div>
  );
}

/** A customer can become a seller at any time; most only realise later. */
function BecomeASeller({ d }: { d: Dict['dashboard'] }) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-sand-50 p-5 sm:p-6">
      <p className="label">{d.sellingTitle}</p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">{d.sellingBody}</p>
      <Button asChild variant="secondary" size="sm" className="mt-5">
        <Link href="/dashboard/listings/new">
          {d.addProperty} <ArrowRight aria-hidden />
        </Link>
      </Button>
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
      note: 'Submitted before listings went live automatically. Our team still has these.',
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
