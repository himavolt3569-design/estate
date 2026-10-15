import { ArrowRight, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { PageHeader } from '../components/PageHeader';
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

/** The column values are database words. These are the ones a seller reads. */
const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  read: 'Read',
  responded: 'Replied',
  archived: 'Archived',
};

type Enquiry = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  property: { title: string | null; reference_code: string | null } | null;
};

export default async function DashboardEnquiriesPage() {
  const [user] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) redirect('/login');

  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';

  if (!vendor && !admin) {
    return (
      <EmptyState
        icon={<MessageSquare className="size-6" />}
        title="Only sellers have an inbox"
        description="Messages arrive here once you have a property listed."
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
    <div className="space-y-7">
      <PageHeader
        eyebrow={admin ? 'Platform' : 'Your account'}
        title={admin ? 'All messages' : 'Messages'}
        subtitle={
          admin
            ? 'Every enquiry sent through Kitta, to any seller.'
            : 'People who have asked about one of your properties.'
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="No messages yet"
          description="When somebody asks about one of your properties, it lands here and you get an email."
        />
      ) : (
        <DataTable
          caption={admin ? 'All enquiries' : 'Enquiries about your properties'}
          rows={rows as Enquiry[]}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'sender',
              header: 'Sender',
              role: 'title',
              cell: (row) => (
                <>
                  <p className="font-medium text-ink-900">{row.contact_name}</p>
                  {/* An email address is one unbroken token and was pushing the
                      cell wider than the screen. It wraps now. */}
                  <p className="text-2xs break-all text-ink-500">
                    {row.contact_email || row.contact_phone}
                  </p>
                </>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              role: 'badge',
              cell: (row) => (
                <Badge tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </Badge>
              ),
            },
            {
              key: 'property',
              header: 'Property',
              className: 'max-w-56',
              cell: (row) => (
                <>
                  <p className="truncate text-ink-700">{row.property?.title ?? '—'}</p>
                  {row.property?.reference_code && (
                    <p className="nums text-2xs text-ink-400">{row.property.reference_code}</p>
                  )}
                </>
              ),
            },
            {
              key: 'received',
              header: 'Received',
              cell: (row) => (
                <span className="nums text-xs text-ink-500">{formatRelative(row.created_at)}</span>
              ),
            },
            {
              key: 'message',
              header: 'Message',
              wide: true,
              className: 'max-w-80',
              cell: (row) => (
                <p className="line-clamp-3 text-ink-600 lg:line-clamp-2">{row.message}</p>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              role: 'action',
              align: 'right',
              cell: (row) =>
                row.contact_email ? (
                  <Button asChild variant="secondary" size="sm">
                    <a href={`mailto:${row.contact_email}`}>
                      Reply by email <ArrowRight aria-hidden />
                    </a>
                  </Button>
                ) : row.contact_phone ? (
                  <Button asChild variant="secondary" size="sm">
                    <a href={`tel:${row.contact_phone}`}>
                      Call <ArrowRight aria-hidden />
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-ink-400">No contact details</span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
