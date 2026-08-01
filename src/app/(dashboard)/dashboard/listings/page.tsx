import { Building2, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { formatPrice, formatRelative } from '@/lib/format';
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

export default async function DashboardListingsPage() {
  const user = await getSessionUser();
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

  const rows = await getListings();

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

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title={admin ? 'Nothing has been listed yet' : 'You have not listed anything yet'}
          description={
            admin
              ? 'When somebody puts a property up it appears here straight away, draft or not.'
              : 'It takes six short steps, and you can stop halfway and come back to it.'
          }
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">Put your first property up</Link>
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
                  {admin && <Th>Listed by</Th>}
                  <Th>Price</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Interest</Th>
                  <Th>Added</Th>
                  <Th className="text-right">Manage</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((row) => {
                  const photosShort = Math.max(0, MIN_IMAGES - (row.images?.length ?? 0));

                  return (
                    <tr key={row.id} className="transition-colors hover:bg-ink-50/60">
                      <td className="px-4 py-3">
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
                      </td>

                      {admin && (
                        <td className="px-4 py-3 text-ink-600">
                          <p>{row.owner?.full_name ?? 'Unnamed account'}</p>
                          {row.owner?.phone && (
                            <p className="nums mt-0.5 text-xs text-ink-500">{row.owner.phone}</p>
                          )}
                        </td>
                      )}

                      <td className="nums px-4 py-3 text-ink-900">
                        {formatPrice(row.price, {
                          period: row.price_period as 'month' | 'year' | 'night' | null,
                        })}
                      </td>

                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                          {STATUS_LABEL[row.status] ?? row.status.replace('_', ' ')}
                        </Badge>
                      </td>

                      <td className="nums px-4 py-3 text-right text-xs text-ink-500">
                        {row.view_count} views
                        <br />
                        {row.enquiry_count} enquiries
                      </td>

                      <td className="nums px-4 py-3 text-xs text-ink-500">
                        {formatRelative(row.created_at)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
                          <Link href={`/dashboard/listings/${row.id}/edit`}>
                            {row.status === 'draft' ? 'Finish it' : 'Edit'}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
