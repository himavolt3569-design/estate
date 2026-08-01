import { Building2, Eye, Heart, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { formatDate, formatPrice } from '@/lib/format';
import { getListings } from '@/modules/listings/queries';
import { redirect } from 'next/navigation';

import { PageHeader } from '../../components/PageHeader';

export const metadata: Metadata = { title: 'How your listings are doing', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * The overview page has always linked here from its "people looked" tile, and
 * the route did not exist — a 404 from the seller's own dashboard. Per-listing
 * detail already lives at /dashboard/listings/[id]/analytics; this is the
 * summary across all of them.
 */
export default async function ListingsAnalyticsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/dashboard/listings/analytics');

  const admin = user.role === 'platform_admin';
  if (!isVendor(user.role) && !admin) redirect('/dashboard');

  const listings = await getListings();
  const live = listings.filter((row) => row.status === 'published');

  const views = listings.reduce((sum, row) => sum + (row.view_count ?? 0), 0);
  const enquiries = listings.reduce((sum, row) => sum + (row.enquiry_count ?? 0), 0);
  const favourites = listings.reduce((sum, row) => sum + (row.favorite_count ?? 0), 0);

  // Best-performing first: a seller opens this to find out which listing is
  // working, not to read them in the order they were created.
  const ranked = [...listings].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={admin ? 'Platform' : 'Your properties'}
        title="How your listings are doing"
        subtitle="Views are counted once per person per day, so refreshing a page does not inflate them."
      />

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Live listings" value={live.length} icon={Building2} />
        <Figure label="Times viewed" value={views} icon={Eye} />
        <Figure label="Enquiries" value={enquiries} icon={MessageSquare} tone="warm" />
        <Figure label="Saved by buyers" value={favourites} icon={Heart} />
      </dl>

      {listings.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="Nothing to measure yet"
          description="Once a listing is live, this page shows how many people looked at it and how many got in touch."
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">Put a property up</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/70 text-left">
                  <Th>Property</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Views</Th>
                  <Th className="text-right">Enquiries</Th>
                  <Th className="text-right">Saved</Th>
                  <Th>Live since</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {ranked.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/listings/${row.id}/analytics`}
                        className="font-medium text-ink-900 hover:text-crimson-700"
                      >
                        {row.title}
                      </Link>
                      <p className="nums mt-0.5 text-xs text-ink-500">
                        {row.reference_code} · {formatPrice(row.price)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status === 'published' ? 'verified' : 'neutral'}>
                        {row.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="nums px-4 py-3 text-right text-ink-900">{row.view_count ?? 0}</td>
                    <td className="nums px-4 py-3 text-right text-marigold-800">
                      {row.enquiry_count ?? 0}
                    </td>
                    <td className="nums px-4 py-3 text-right text-ink-600">
                      {row.favorite_count ?? 0}
                    </td>
                    <td className="nums px-4 py-3 text-xs text-ink-500">
                      {row.published_at ? formatDate(row.published_at) : 'Not live yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: 'warm';
}) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="flex items-center gap-2 text-ink-400">
        <Icon aria-hidden className="size-3.5" />
        <span className="label">{label}</span>
      </dt>
      <dd
        className={`figure mt-2.5 text-4xl ${tone === 'warm' ? 'text-marigold-800' : 'text-ink-900'}`}
      >
        {value.toLocaleString('en-IN')}
      </dd>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-2xs tracking-wide text-ink-400 uppercase ${className}`}>
      {children}
    </th>
  );
}
