import { TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DataTable } from '@/components/ui/data-table';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatDate, formatPrice } from '@/lib/format';
import { getSales } from '@/modules/admin/master-queries';

import { PageHeader } from '../../components/PageHeader';

export const metadata: Metadata = { title: 'Sales', robots: { index: false } };
export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  agency_manager: 'Agency manager',
  agent: 'Agent',
  property_owner: 'Owner',
  customer: 'Owner',
  platform_admin: 'Kitta',
};

/**
 * What sold, for how much, and who sold it.
 *
 * The owner asked for this to be fully transparent, so nothing here is
 * aggregated away: every closed listing is its own row with the seller named
 * and a link through to the listing itself.
 */
export default async function AdminSalesPage() {
  const sales = await getSales();

  const sold = sales.filter((row) => row.status === 'sold');
  const rented = sales.filter((row) => row.status === 'rented');
  const total = sales.reduce((sum, row) => sum + (row.price ?? 0), 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform"
        title="Sales"
        subtitle="Every property that has changed hands on Kitta, and who handled it."
      />

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-soft sm:grid-cols-3">
        <Figure label="Sold" value={sold.length.toLocaleString('en-IN')} />
        <Figure label="Rented or leased" value={rented.length.toLocaleString('en-IN')} />
        <Figure label="Total value closed" value={formatPrice(total)} tone="warm" />
      </dl>

      {sales.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          title="Nothing has closed yet"
          description="When a seller marks a property as sold or rented, it appears here with the full detail."
        />
      ) : (
        <DataTable
          caption="Properties that have changed hands"
          rows={sales}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'property',
              header: 'Property',
              role: 'title',
              cell: (row) => (
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
                </>
              ),
            },
            {
              key: 'outcome',
              header: 'Outcome',
              role: 'badge',
              cell: (row) => (
                <Badge tone={row.status === 'sold' ? 'verified' : 'royal'}>{row.status}</Badge>
              ),
            },
            {
              key: 'price',
              header: 'Price',
              align: 'right',
              cell: (row) => (
                <span className="nums font-medium text-ink-900">{formatPrice(row.price)}</span>
              ),
            },
            {
              key: 'closed',
              header: 'Closed',
              cell: (row) => (
                <span className="nums text-xs text-ink-500">{formatDate(row.updated_at)}</span>
              ),
            },
            {
              key: 'seller',
              header: 'Sold by',
              cell: (row) => (
                <>
                  <p className="truncate text-ink-900">{row.owner?.full_name ?? 'Unnamed account'}</p>
                  <p className="nums mt-0.5 text-xs text-ink-500">
                    {ROLE_LABEL[row.owner?.role ?? ''] ?? row.owner?.role}
                    {row.owner?.phone ? ` · ${row.owner.phone}` : ''}
                  </p>
                </>
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
          ]}
        />
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warm';
}) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="label">{label}</dt>
      <dd
        className={`figure mt-2 text-3xl ${tone === 'warm' ? 'text-marigold-800' : 'text-ink-900'}`}
      >
        {value}
      </dd>
    </div>
  );
}
