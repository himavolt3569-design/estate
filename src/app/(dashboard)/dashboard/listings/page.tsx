import { ArrowRight, Building2, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { formatRelative, formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';


export const metadata: Metadata = { title: 'My Properties', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  published: 'verified',
  pending_review: 'pending',
  draft: 'neutral',
  sold: 'solid',
  rented: 'solid',
  rejected: 'rejected',
} as const;

export default async function DashboardListingsPage() {
  const [user, { t }] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) return null;

  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';
  
  if (!vendor && !admin) {
    return (
      <EmptyState
        icon={<Building2 className="size-6" />}
        title="Access Denied"
        description="You need to be a registered seller or agent to manage listings."
      />
    );
  }

  const supabase = await createClient();

  const { data: properties } = await supabase
    .from('properties')
    .select(`
      id, title, reference_code, price, transaction_type, status, created_at,
      location:locations!properties_location_id_fkey ( name_en )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const rows = properties ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            {admin ? 'All Properties' : t.dashboard.yourProperties}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {admin ? 'Manage all properties on the platform' : 'Manage your listed properties'}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/listings/new">
            <Plus aria-hidden /> Add property
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="No properties yet"
          description={admin ? "There are no properties on the platform." : "You haven't listed any properties yet."}
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">Add your first property</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto border border-ink-200">
          <table className="w-full min-w-3xl border-collapse bg-white text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <Th>Property</Th>
                <Th>Type</Th>
                <Th>Price</Th>
                <Th>Status</Th>
                <Th>Added</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((prop: any) => (
                <tr key={prop.id} className="group hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{prop.title}</p>
                    <p className="mt-0.5 text-2xs text-ink-500">
                      {prop.reference_code} • {prop.location?.name_en}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    <span className="capitalize">{prop.transaction_type.replace('_', ' ')}</span>
                  </td>
                  <td className="nums px-4 py-3 text-ink-900">
                    {formatPrice(prop.price)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[prop.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                      {prop.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="nums px-4 py-3 text-2xs text-ink-500">
                    {formatRelative(prop.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <Link href={`/dashboard/listings/${prop.id}/edit`}>
                        Edit <ArrowRight aria-hidden className="ml-1 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-2xs tracking-wide text-ink-400 uppercase ${className}`}>{children}</th>;
}
