import { Clock } from 'lucide-react';
import type { Metadata } from 'next';

import { PropertyImage } from '@/components/media/PropertyImage';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatPrice, formatRelative } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/session';
import { ModerationDecision } from '@/modules/admin/components/ModerationDecision';
import { getModerationQueue } from '@/modules/admin/queries';

export const metadata: Metadata = { title: 'Moderation', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * The queue, oldest first.
 *
 * Nothing on this platform reaches a buyer without passing through this screen,
 * so it shows the things a decision actually rests on: who is listing it and in
 * what capacity, how many photos there are, the price, and the exact location
 * text. The listing itself opens in a new tab rather than replacing the queue.
 */
export default async function ModerationPage() {
  const queue = await getModerationQueue();

  if (queue.length === 0) {
    return (
      <EmptyState
        title="Nothing waiting"
        description="Every submitted listing has been reviewed. New submissions appear here straight away."
        icon={<Clock className="size-6" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        {queue.length} listing{queue.length === 1 ? '' : 's'} waiting. Oldest first.
      </p>

      <ul className="space-y-4">
        {queue.map((item) => {
          const cover = item.images?.find((image) => image.is_cover) ?? item.images?.[0];

          return (
            <li key={item.id} className="ticked border border-ink-200 bg-white">
              <div className="grid gap-5 p-5 sm:grid-cols-[160px_1fr]">
                <PropertyImage
                  renditions={cover?.rendition_paths ?? undefined}
                  alt={item.title}
                  width={400}
                  height={300}
                  sizes="160px"
                  wrapperClassName="w-full border border-ink-200"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="label">
                        {item.reference_code} · {item.location?.name_en ?? 'Location not set'}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink-900">
                        {item.title}
                      </h2>
                    </div>
                    <Badge tone="pending">Waiting</Badge>
                  </div>

                  <dl className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-ink-100 pt-3">
                    <Fact label="Price" value={formatPrice(item.price)} />
                    <Fact label="Type" value={item.subtype.replace(/_/g, ' ')} />
                    <Fact label="Photos" value={String(item.images?.length ?? 0)} />
                    <Fact
                      label="Listed by"
                      value={`${item.owner?.full_name ?? 'Unknown'} (${
                        ROLE_LABELS[item.owner?.role as Role] ?? item.owner?.role ?? 'unknown'
                      })`}
                    />
                    <Fact label="Submitted" value={formatRelative(item.created_at)} />
                  </dl>

                  {item.address_line && (
                    <p className="mt-3 text-sm text-ink-600">{item.address_line}</p>
                  )}

                  {/* Fewer than five photos should never reach this queue: a
                      trigger blocks the status change. If one does, the rule
                      has a hole and the reviewer needs to see that. */}
                  {(item.images?.length ?? 0) < 5 && (
                    <p className="mt-3 border-l-2 border-clay-600 pl-3 text-xs text-clay-700">
                      Only {item.images?.length ?? 0} photos. The minimum is five, so this should
                      not have been submittable. Worth checking before you approve.
                    </p>
                  )}

                  <div className="mt-5 border-t border-ink-100 pt-4">
                    <ModerationDecision propertyId={item.id} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd className="nums mt-0.5 text-sm text-ink-900 capitalize">{value}</dd>
    </div>
  );
}
