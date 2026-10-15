import { Clock } from 'lucide-react';
import type { Metadata } from 'next';

import { PropertyImage } from '@/components/media/PropertyImage';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatPrice, formatRelative } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/session';
import { getModerationQueue } from '@/modules/admin/queries';
import { MIN_IMAGES } from '@/modules/listings/schema';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { PageHeader } from '../../components/PageHeader';

const SUBTITLE =
  'Listings submitted before publishing became automatic. Anything here is still waiting on a decision from you.';

export const metadata: Metadata = { title: 'Moderation', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * The queue, oldest first.
 *
 * This used to be the gate every listing passed through before a buyer could
 * see it. Since migration 0032 a seller publishes their own work, so the queue
 * only holds what was submitted before that — it drains and then stays empty,
 * and the page says so rather than implying sellers are still waiting.
 *
 * It still shows what a decision rests on: who is listing it and in what
 * capacity, how many photos there are, the price, and the exact location text.
 */
export default async function ModerationPage() {
  const queue = await getModerationQueue();

  if (queue.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeader eyebrow="Platform" title="Moderation" subtitle={SUBTITLE} />
        <EmptyState
          title="Nothing waiting"
          description="Listings go live on their own now, so this queue only ever holds the ones submitted before that changed."
          icon={<Clock className="size-6" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Platform" title="Moderation" subtitle={SUBTITLE} />

      <p className="text-sm text-ink-600">
        {queue.length} listing{queue.length === 1 ? '' : 's'} waiting. Oldest first.
      </p>

      <ul className="space-y-4">
        {queue.map((item) => {
          const cover = item.images?.find((image) => image.is_cover) ?? item.images?.[0];

          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft"
            >
              {/* The image column was a hard 160px beside `1fr` from sm up. On a
                  phone it stacked to full width at a 4:3 ratio, which gave a
                  thumbnail 280px tall above every row in the queue. */}
              <div className="grid gap-4 p-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5 sm:p-5">
                <PropertyImage
                  renditions={cover?.rendition_paths ?? undefined}
                  storagePath={cover?.storage_path}
                  alt={item.title}
                  width={400}
                  height={300}
                  sizes="(max-width: 640px) 100vw, 160px"
                  wrapperClassName="w-full overflow-hidden rounded-xl border border-ink-100"
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

                  {/* Fewer than the minimum should never reach this queue: a
                      trigger blocks the status change. If one does, the rule
                      has a hole and the reviewer needs to see that.

                      This said "the minimum is five" and tested `< 5`. Migration
                      0020 moved the minimum to three, so it was flagging every
                      correctly-submitted three- and four-photo listing as a bug
                      in the rules. It reads MIN_IMAGES now, like everything
                      else that depends on that number. */}
                  {(item.images?.length ?? 0) < MIN_IMAGES && (
                    <p className="mt-3 border-l-2 border-clay-600 pl-3 text-xs text-clay-700">
                      Only {item.images?.length ?? 0} photos. The minimum is {MIN_IMAGES}, so this
                      should not have been submittable. Worth checking before you approve.
                    </p>
                  )}

                  <div className="mt-5 border-t border-ink-100 pt-4 flex items-center justify-end">
                    <Button asChild>
                      <Link href={`/dashboard/admin/listings/${item.id}/review`}>
                        Review Listing
                      </Link>
                    </Button>
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
