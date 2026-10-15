import { Building2, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { formatPrice, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getListings } from '@/modules/listings/queries';
import { MIN_IMAGES } from '@/modules/listings/schema';

import { PageHeader } from '../components/PageHeader';

export const metadata: Metadata = { title: 'My properties', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  published: 'verified',
  pending_review: 'pending',
  draft: 'neutral',
  sold: 'solid',
  rented: 'solid',
  rejected: 'rejected',
  archived: 'neutral',
} as const;

/** Plain words for a status. "pending_review" is a column name, not an answer. */
const STATUS_LABEL: Record<string, string> = {
  published: 'Live',
  pending_review: 'Being checked',
  draft: 'Not finished',
  sold: 'Sold',
  rented: 'Rented',
  rejected: 'Sent back',
  archived: 'Removed',
};

/**
 * The filters the dashboard's status bar links into. "closed" covers both sold
 * and rented, because from the seller's side they are the same event.
 */
const FILTERS: Array<{ key: string; label: string; matches: (status: string) => boolean }> = [
  { key: 'all', label: 'All', matches: () => true },
  { key: 'published', label: 'Live', matches: (status) => status === 'published' },
  { key: 'pending_review', label: 'Being checked', matches: (status) => status === 'pending_review' },
  { key: 'draft', label: 'Not finished', matches: (status) => status === 'draft' },
  { key: 'closed', label: 'Sold or rented', matches: (status) => status === 'sold' || status === 'rented' },
  { key: 'rejected', label: 'Sent back', matches: (status) => status === 'rejected' },
];

export default async function DashboardListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams]);
  if (!user) redirect('/login?next=/dashboard/listings');

  const admin = user.role === 'platform_admin';

  if (!isVendor(user.role) && !admin) {
    return (
      <div className="space-y-7">
        <PageHeader eyebrow="Your account" title="My properties" />
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="Your account is set up for buying"
          description="Switch to a seller account and you can put a property up. Everything you have saved stays where it is."
          action={
            <Button asChild>
              <Link href="/dashboard/settings?become=seller">Switch to a seller account</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const all = await getListings();
  const filter = FILTERS.find((entry) => entry.key === params.status) ?? FILTERS[0]!;
  const rows = all.filter((row) => filter.matches(row.status));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={admin ? 'Platform' : 'Your account'}
        title={admin ? 'All properties' : 'My properties'}
        subtitle={
          admin
            ? 'Every property on Kitta, whoever posted it. Open any one to edit it.'
            : 'Everything you have listed, including the ones you have not finished.'
        }
        action={
          <Button asChild>
            <Link href="/dashboard/listings/new">
              <Plus aria-hidden /> Add a property
            </Link>
          </Button>
        }
      />

      {all.length > 0 && (
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {FILTERS.map((entry) => {
            const count = all.filter((row) => entry.matches(row.status)).length;
            const selected = entry.key === filter.key;

            return (
              <Link
                key={entry.key}
                href={entry.key === 'all' ? '/dashboard/listings' : `/dashboard/listings?status=${entry.key}`}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  selected
                    ? 'border-royal-800 bg-royal-800 text-white'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
                )}
              >
                {entry.label}
                <span className={cn('nums ml-1.5', selected ? 'text-royal-200' : 'text-ink-400')}>
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title={
            all.length > 0
              ? `Nothing is ${filter.label.toLowerCase()} right now`
              : admin
                ? 'Nothing has been listed yet'
                : 'You have not listed anything yet'
          }
          description={
            all.length > 0
              ? 'Try another status above, or add a property.'
              : admin
                ? 'When somebody puts a property up it appears here straight away, draft or not.'
                : 'It takes six short steps, and you can stop halfway and come back to it.'
          }
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">
                {all.length > 0 ? 'Add a property' : 'Put your first property up'}
              </Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          caption={admin ? 'All properties' : 'My properties'}
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'property',
              header: 'Property',
              role: 'title',
              cell: (row) => {
                const photosShort = Math.max(0, MIN_IMAGES - (row.images?.length ?? 0));
                return (
                  <>
                    <Link
                      href={`/dashboard/listings/${row.id}/edit`}
                      className="font-medium text-ink-900 hover:text-crimson-700"
                    >
                      {row.title}
                    </Link>
                    <p className="nums mt-0.5 text-xs text-ink-500">
                      {row.reference_code}
                      {row.location?.name_en ? ` · ${row.location.name_en}` : ''}
                    </p>
                    {row.status === 'draft' && photosShort > 0 && (
                      <p className="mt-1 text-xs text-marigold-700">
                        Needs {photosShort} more {photosShort === 1 ? 'photo' : 'photos'}
                      </p>
                    )}
                  </>
                );
              },
            },
            {
              key: 'status',
              header: 'Status',
              role: 'badge',
              cell: (row) => (
                <Badge tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                  {STATUS_LABEL[row.status] ?? row.status.replace('_', ' ')}
                </Badge>
              ),
            },
            ...(admin
              ? [
                  {
                    key: 'owner',
                    header: 'Listed by',
                    cell: (row: (typeof rows)[number]) => (
                      <>
                        <p className="truncate text-ink-700">
                          {row.owner?.full_name ?? 'Unnamed account'}
                        </p>
                        {row.owner?.phone && (
                          <p className="nums mt-0.5 text-xs text-ink-500">{row.owner.phone}</p>
                        )}
                      </>
                    ),
                  },
                ]
              : []),
            {
              key: 'price',
              header: 'Price',
              cell: (row) => (
                <span className="nums font-medium text-ink-900">
                  {formatPrice(row.price, {
                    period: row.price_period as 'month' | 'year' | 'night' | null,
                  })}
                </span>
              ),
            },
            {
              key: 'interest',
              header: 'Interest',
              align: 'right',
              cell: (row) => (
                <span className="nums text-xs text-ink-500">
                  {row.view_count} views · {row.enquiry_count} enquiries
                </span>
              ),
            },
            {
              key: 'added',
              header: 'Added',
              cell: (row) => (
                <span className="nums text-xs text-ink-500">{formatRelative(row.created_at)}</span>
              ),
            },
            {
              key: 'manage',
              header: 'Manage',
              role: 'action',
              align: 'right',
              cell: (row) => (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/dashboard/listings/${row.id}/edit`}>
                    {row.status === 'draft' ? 'Finish it' : 'Edit'}
                  </Link>
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
