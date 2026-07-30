import { ArrowRight, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, EmptyState } from '@/components/ui/primitives';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { formatRelative } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  new: 'pending',
  read: 'neutral',
  responded: 'verified',
  archived: 'neutral',
} as const;

export default async function DashboardEnquiriesPage() {
  const [user] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) redirect('/login');

  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';
  
  if (!vendor && !admin) {
    return (
      <EmptyState
        icon={<MessageSquare className="size-6" />}
        title="Access Denied"
        description="Only property owners and agents have an inbox."
      />
    );
  }

  const supabase = await createClient();

  // The 'enquiries: participants read' policy ensures vendors see only their own.
  // The master admin will need a policy to see all enquiries.
  const { data: enquiries } = await supabase
    .from('enquiries')
    .select(`
      id, contact_name, contact_email, contact_phone, message, status, created_at,
      property:properties!enquiries_property_id_fkey ( title, reference_code )
    `)
    .order('created_at', { ascending: false });

  const rows = enquiries ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {admin ? 'All Enquiries (Master Admin)' : 'Messages'}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          {admin ? 'View all enquiries on the platform' : 'Manage enquiries from potential buyers or tenants'}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="No messages yet"
          description="When someone enquires about a property, it will appear here."
        />
      ) : (
        <div className="overflow-x-auto border border-ink-200">
          <table className="w-full min-w-3xl border-collapse bg-white text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <Th>Sender</Th>
                <Th>Property</Th>
                <Th>Message</Th>
                <Th>Status</Th>
                <Th>Received</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((enq: any) => (
                <tr key={enq.id} className="group hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{enq.contact_name}</p>
                    <p className="text-2xs text-ink-500">
                      {enq.contact_email || enq.contact_phone}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-600 max-w-[200px] truncate">
                    {enq.property?.title}
                    <div className="text-2xs text-ink-400">{enq.property?.reference_code}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-600 max-w-xs truncate">
                    {enq.message}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[enq.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                      {enq.status}
                    </Badge>
                  </td>
                  <td className="nums px-4 py-3 text-2xs text-ink-500">
                    {formatRelative(enq.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="h-8 px-2 text-xs font-medium text-royal-700 hover:text-royal-900">
                      View <ArrowRight aria-hidden className="inline ml-1 size-3" />
                    </button>
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
