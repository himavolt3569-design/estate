import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatRelative } from '@/lib/format';
import { ReportDecision } from '@/modules/admin/components/ReportDecision';
import { getReports } from '@/modules/admin/queries';

export const metadata: Metadata = { title: 'Reports', robots: { index: false } };
export const dynamic = 'force-dynamic';

const REASON_LABEL: Record<string, string> = {
  fraud: 'Possible fraud',
  duplicate: 'Duplicate listing',
  wrong_location: 'Wrong location',
  sold_already: 'Already sold',
  offensive: 'Offensive content',
  spam: 'Spam',
  misleading_price: 'Misleading price',
  not_owner: 'Lister is not the owner',
  other: 'Something else',
};

/**
 * The report queue, ordered by SLA rather than by recency.
 *
 * Reports carry a due_at from the moment they are filed. Sorting by "newest"
 * would quietly bury the oldest complaint, which is exactly the one most likely
 * to have a real problem behind it.
 */
export default async function AdminReportsPage() {
  const reports = await getReports();

  if (reports.length === 0) {
    return (
      <EmptyState
        title="No open reports"
        description="When somebody reports a listing, a review or another user, it lands here with a deadline attached."
        icon={<ShieldCheck className="size-6" />}
      />
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        {reports.length} open report{reports.length === 1 ? '' : 's'}. Most urgent first.
      </p>

      <ul className="space-y-4">
        {reports.map((report) => {
          const overdue = new Date(report.due_at).getTime() < now;

          return (
            <li
              key={report.id}
              className={`border bg-white p-5 ${overdue ? 'border-clay-600' : 'border-ink-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label">
                    {report.target_type} · filed {formatRelative(report.created_at)}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink-900">
                    {REASON_LABEL[report.reason] ?? report.reason}
                  </h2>
                </div>
                <Badge tone={overdue ? 'rejected' : 'pending'}>
                  {overdue ? 'Past due' : `Due ${formatRelative(report.due_at)}`}
                </Badge>
              </div>

              {report.detail && (
                <p className="mt-3 border-l-2 border-ink-200 pl-3 text-sm leading-relaxed text-ink-600">
                  {report.detail}
                </p>
              )}

              <p className="mt-3 text-2xs text-ink-400">
                Reported by {report.reporter?.full_name ?? 'someone not signed in'}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-ink-100 pt-4">
                <ReportDecision reportId={report.id} status={report.status} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
