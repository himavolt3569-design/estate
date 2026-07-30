import { cn } from '@/lib/utils';
import { formatDate, formatPrice } from '@/lib/format';

import { Seal } from './Seal';

/**
 * THE TRUST LEDGER: the signature element of this product.
 *
 * Nepali property changes hands in a market where brokers carry a poor
 * reputation and buyers have no way to check a claim. Every other listing site
 * answers that with a "Verified" badge, which is a claim about a claim.
 *
 * This answers it with a record instead: an append-only extract of everything
 * that has happened to the listing, including the parts a seller would rather
 * not show: that the price was raised twice, that it has been relisted three
 * times, that someone reported it. The database makes that honest (trust_events
 * is append-only for every role, including admins), and this component makes it
 * legible.
 *
 * It is designed to look like a registry extract, not a feature card: a full-ink
 * rule with registration ticks, dates set extra-light in a fixed column, and no
 * colour except where a check passed or a flag was raised. The boldness here is
 * in being plainer than everything around it.
 */

type TrustEvent = {
  event:
    | 'listed'
    | 'published'
    | 'price_changed'
    | 'relisted'
    | 'identity_verified'
    | 'document_sighted'
    | 'gps_confirmed'
    | 'reported'
    | 'report_resolved'
    | 'verification_revoked';
  at: string;
  detail: Record<string, unknown>;
};

const EVENT_COPY: Record<TrustEvent['event'], { label: string; tone: 'plain' | 'good' | 'flag' }> = {
  listed: { label: 'Listed', tone: 'plain' },
  published: { label: 'Published', tone: 'plain' },
  relisted: { label: 'Relisted', tone: 'flag' },
  price_changed: { label: 'Price changed', tone: 'plain' },
  identity_verified: { label: 'Lister identity verified', tone: 'good' },
  document_sighted: { label: 'Ownership certificate sighted', tone: 'good' },
  gps_confirmed: { label: 'Location confirmed on site', tone: 'good' },
  reported: { label: 'Reported by a user', tone: 'flag' },
  report_resolved: { label: 'Report resolved', tone: 'plain' },
  verification_revoked: { label: 'Verification withdrawn', tone: 'flag' },
};

function describe(event: TrustEvent): string | null {
  const d = event.detail ?? {};

  if (event.event === 'price_changed') {
    const from = typeof d['from'] === 'number' ? d['from'] : null;
    const to = typeof d['to'] === 'number' ? d['to'] : null;
    if (from == null || to == null) return null;
    const direction = to > from ? 'raised' : 'reduced';
    return `${direction} from ${formatPrice(from)} to ${formatPrice(to)}`;
  }

  if (event.event === 'reported' && typeof d['reason'] === 'string') {
    return `reason: ${d['reason'].replace(/_/g, ' ')}`;
  }

  if (event.event === 'report_resolved' && typeof d['outcome'] === 'string') {
    return String(d['outcome']);
  }

  if (event.event === 'listed' && typeof d['reference_code'] === 'string') {
    return String(d['reference_code']);
  }

  return null;
}

export function TrustLedger({
  events,
  referenceCode,
  className,
}: {
  events: TrustEvent[];
  referenceCode: string;
  className?: string;
}) {
  const verifiedCount = events.filter((e) => EVENT_COPY[e.event]?.tone === 'good').length;
  const relistCount = events.filter((e) => e.event === 'relisted').length;

  return (
    <section
      aria-labelledby="trust-ledger-heading"
      className={cn('ticked border border-ink-900 bg-white', className)}
    >
      <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
        <div>
          <p className="label">Record of this listing</p>
          <h2
            id="trust-ledger-heading"
            className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink-900"
          >
            Trust ledger
          </h2>
        </div>
        {verifiedCount > 0 && <Seal size={28} title={`${verifiedCount} checks completed`} />}
      </header>

      <p className="border-b border-ink-200 px-5 py-3 text-xs leading-relaxed text-ink-500">
        Everything below is written automatically and cannot be edited or removed, not by the
        lister and not by us.
      </p>

      <ol className="divide-y divide-ink-100">
        {events.map((event, index) => {
          const copy = EVENT_COPY[event.event];
          if (!copy) return null;
          const detail = describe(event);

          return (
            <li key={`${event.event}-${event.at}-${index}`} className="flex gap-4 px-5 py-3">
              <time
                dateTime={event.at}
                className="nums w-24 shrink-0 text-2xs font-extralight text-ink-400"
              >
                {formatDate(event.at)}
              </time>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm',
                    copy.tone === 'good' && 'text-emerald-800',
                    copy.tone === 'flag' && 'text-clay-700',
                    copy.tone === 'plain' && 'text-ink-700',
                  )}
                >
                  {copy.label}
                </p>
                {detail && (
                  <p className="mt-0.5 nums text-2xs text-ink-400">{detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-3">
        <span className="label">Ref {referenceCode}</span>
        {relistCount > 0 && (
          <span className="text-2xs text-ink-500">
            Relisted {relistCount} {relistCount === 1 ? 'time' : 'times'}
          </span>
        )}
      </footer>
    </section>
  );
}

/** Compact form for search cards: the count of completed checks, nothing more. */
export function TrustMark({
  verified,
  label = 'Checked',
  className,
}: {
  verified: boolean;
  label?: string;
  className?: string;
}) {
  if (!verified) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-2xs font-medium text-emerald-800',
        className,
      )}
    >
      <Seal size={13} title={label} />
      {label}
    </span>
  );
}
