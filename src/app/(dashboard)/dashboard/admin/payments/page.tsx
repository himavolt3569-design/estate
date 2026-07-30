import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatPrice, formatRelative } from '@/lib/format';
import { PaymentDecision } from '@/modules/admin/components/PaymentDecision';
import { ProofLink } from '@/modules/admin/components/ProofLink';
import { getPendingPayments } from '@/modules/admin/queries';

export const metadata: Metadata = { title: 'Payments', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Proof-of-payment review.
 *
 * No money moves through this platform, so this queue is not settling anything:
 * it is one person confirming that a screenshot matches what the other person
 * says they sent. The proof itself lives in a private bucket and is fetched
 * through a 60-second signed URL, never linked directly.
 */
export default async function AdminPaymentsPage() {
  const payments = await getPendingPayments();

  if (payments.length === 0) {
    return (
      <EmptyState
        title="No payments to check"
        description="When a buyer uploads proof of a payment, it appears here for you or the seller to confirm."
        icon={<CheckCircle2 className="size-6" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        {payments.length} payment{payments.length === 1 ? '' : 's'} waiting. Oldest first.
      </p>

      <ul className="space-y-4">
        {payments.map((payment) => (
          <li key={payment.id} className="border border-ink-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="label">
                  {payment.property?.reference_code ?? 'No listing'} · {payment.purpose}
                </p>
                <p className="nums mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink-900">
                  {formatPrice(payment.amount)}
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  {payment.property?.title ?? 'Listing removed'}
                </p>
              </div>
              <Badge tone="pending">Waiting</Badge>
            </div>

            <dl className="mt-4 grid gap-x-8 gap-y-2 border-t border-ink-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Row label="From" value={payment.payer?.full_name ?? 'Unknown'} />
              <Row label="To" value={payment.payee?.full_name ?? 'Unknown'} />
              <Row label="Reference" value={payment.reference ?? 'Not given'} />
              <Row label="Uploaded" value={formatRelative(payment.created_at)} />
            </dl>

            {payment.note && (
              <p className="mt-3 border-l-2 border-ink-200 pl-3 text-sm text-ink-600">
                {payment.note}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-ink-100 pt-4">
              <PaymentDecision paymentId={payment.id} />
              <ProofLink path={payment.proof_path} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd className="nums mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}
