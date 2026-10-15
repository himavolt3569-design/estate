import { ArrowLeft, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/primitives';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatRelative } from '@/lib/format';

export const metadata: Metadata = { title: 'Listing Analytics', robots: { index: false } };
export const dynamic = 'force-dynamic';

type ViewRow = {
  id: number | string;
  created_at: string;
  referrer: string | null;
  viewer_hash: string;
  viewer: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

export default async function PropertyAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) redirect('/login');

  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';
  if (!vendor && !admin) redirect('/dashboard');

  const supabase = await createClient();

  // Validate ownership/admin rights
  const { data: property } = await supabase
    .from('properties')
    .select('id, title, reference_code')
    .eq('id', id)
    .single();

  if (!property) {
    return (
      <EmptyState
        icon={<Eye className="size-6" />}
        title="Property not found"
        description="It may have been removed, or this account may not have access to it."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/listings">Back to properties</Link>
          </Button>
        }
      />
    );
  }

  // Fetch views with viewer profiles if authenticated
  const { data: views } = await supabase
    .from('property_views')
    .select(
      `
      id, created_at, referrer, viewer_hash, view_date,
      viewer:profiles!property_views_viewer_id_fkey ( id, full_name, email, phone )
    `,
    )
    .eq('property_id', id)
    .order('created_at', { ascending: false });

  const rows = (views ?? []) as unknown as ViewRow[];
  const uniqueViews = new Set(rows.map((row) => row.viewer_hash)).size;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/listings">
            <ArrowLeft aria-hidden /> Back to properties
          </Link>
        </Button>

        {/*
          The title used to sit in a nowrap flex row beside the two figures, so
          a long property name pushed the header past the screen on a phone.
          It stacks now, and the figures become a full-width pair below it.
        */}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="label mb-2 text-crimson-600">Who has looked</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {property.title}
            </h1>
            <p className="nums mt-1 text-sm text-ink-500">{property.reference_code}</p>
          </div>

          <dl className="flex w-full shrink-0 divide-x divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft sm:w-auto">
            <div className="flex-1 px-5 py-3 sm:flex-none">
              <dt className="label">Total views</dt>
              <dd className="nums mt-1 text-2xl font-semibold text-ink-900">
                {rows.length.toLocaleString('en-IN')}
              </dd>
            </div>
            <div className="flex-1 px-5 py-3 sm:flex-none">
              <dt className="label">Unique visitors</dt>
              <dd className="nums mt-1 text-2xl font-semibold text-ink-900">
                {uniqueViews.toLocaleString('en-IN')}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Eye className="size-6" />}
          title="No views yet"
          description="Nobody has opened this property yet. Views appear here the moment somebody does."
        />
      ) : (
        <DataTable
          caption="Every view of this property"
          rows={rows}
          rowKey={(row) => String(row.id)}
          columns={[
            {
              key: 'viewer',
              header: 'Viewer',
              role: 'title',
              cell: (row) =>
                row.viewer ? (
                  <span className="font-medium text-ink-900">
                    {row.viewer.full_name || 'Registered user'}
                  </span>
                ) : (
                  <span className="text-ink-500 italic">Anonymous guest</span>
                ),
            },
            {
              key: 'when',
              header: 'When',
              cell: (row) => (
                <span className="nums text-xs text-ink-600">{formatRelative(row.created_at)}</span>
              ),
            },
            {
              key: 'contact',
              header: 'Contact',
              cell: (row) =>
                row.viewer && (row.viewer.email || row.viewer.phone) ? (
                  <div className="min-w-0 space-y-0.5">
                    {row.viewer.email && (
                      <p className="truncate text-xs text-ink-600" title={row.viewer.email}>
                        {row.viewer.email}
                      </p>
                    )}
                    {row.viewer.phone && (
                      <p className="nums text-xs text-ink-500">{row.viewer.phone}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-ink-400">—</span>
                ),
            },
            {
              key: 'source',
              header: 'Came from',
              wide: true,
              className: 'max-w-56',
              cell: (row) => (
                <span className="block truncate text-xs text-ink-500" title={row.referrer ?? ''}>
                  {row.referrer || 'Direct / unknown'}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
