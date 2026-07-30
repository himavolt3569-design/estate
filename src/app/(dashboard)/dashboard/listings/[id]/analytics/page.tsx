import { ArrowLeft, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatRelative } from '@/lib/format';

export const metadata: Metadata = { title: 'Listing Analytics', robots: { index: false } };
export const dynamic = 'force-dynamic';

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
      <div className="p-8 text-center text-ink-600">
        Property not found or you don't have access.
      </div>
    );
  }

  // Fetch views with viewer profiles if authenticated
  const { data: views } = await supabase
    .from('property_views')
    .select(`
      id, created_at, referrer, viewer_hash, view_date,
      viewer:profiles!property_views_viewer_id_fkey ( id, full_name, email, phone )
    `)
    .eq('property_id', id)
    .order('created_at', { ascending: false });

  const rows = views ?? [];
  const uniqueViews = new Set(rows.map(r => r.viewer_hash)).size;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/dashboard/listings">
              <ArrowLeft aria-hidden /> Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              Analytics: {property.title}
            </h1>
            <p className="mt-1 text-sm text-ink-600">
              {property.reference_code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 rounded-sm border border-ink-200 bg-white px-6 py-3">
          <div>
            <p className="label">Total Views</p>
            <p className="nums mt-1 text-2xl text-ink-900">{rows.length}</p>
          </div>
          <div className="h-10 w-px bg-ink-200" />
          <div>
            <p className="label">Unique Visitors</p>
            <p className="nums mt-1 text-2xl text-ink-900">{uniqueViews}</p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Eye className="size-6" />}
          title="No views yet"
          description="Your property hasn't been viewed by anyone yet."
        />
      ) : (
        <div className="overflow-x-auto border border-ink-200 bg-white">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left bg-ink-50/50">
                <Th>Date & Time</Th>
                <Th>Viewer</Th>
                <Th>Contact Information</Th>
                <Th>Source (Referrer)</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((view: any) => (
                <tr key={view.id} className="group hover:bg-ink-50">
                  <td className="px-4 py-3 whitespace-nowrap text-ink-600 nums">
                    {formatRelative(view.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {view.viewer ? (
                      <span className="font-medium text-ink-900">{view.viewer.full_name || 'Registered User'}</span>
                    ) : (
                      <span className="text-ink-500 italic">Anonymous Guest</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {view.viewer ? (
                      <div className="space-y-1">
                        {view.viewer.email && <div className="text-ink-600">{view.viewer.email}</div>}
                        {view.viewer.phone && <div className="text-ink-500 text-xs">{view.viewer.phone}</div>}
                      </div>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-500 text-xs truncate max-w-[200px]" title={view.referrer}>
                    {view.referrer || 'Direct / Unknown'}
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
