import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PropertyImage } from '@/components/media/PropertyImage';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/session';
import { formatDate, formatPrice } from '@/lib/format';
import { VerifiedMark, VerifyListingToggle } from '@/modules/admin/components/VerifyListingToggle';
import { getAllListings } from '@/modules/admin/master-queries';

import { PageHeader } from '../../components/PageHeader';

export const metadata: Metadata = { title: 'Listings', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Every listing, in every state, with the verified seal attached to it.
 *
 * The moderation queue answers "may this go live"; this screen answers "has
 * anybody actually checked it". They are different decisions made at different
 * times, which is why the seal lives here and not in the queue.
 */
export default async function AdminListingsPage() {
  const listings = await getAllListings();

  if (listings.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeader eyebrow="Platform" title="Listings" />
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="No listings yet"
          description="Every property posted on Kitta appears here, whatever state it is in."
        />
      </div>
    );
  }

  const published = listings.filter((listing) => listing.status === 'published');
  const verified = published.filter((listing) => listing.verified_at != null);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform"
        title="Listings"
        subtitle="Every property on Kitta. The verified seal is set here, and it is what lifts a listing to the top of the home page."
      />

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-soft sm:grid-cols-3">
        <Figure label="All listings" value={String(listings.length)} />
        <Figure label="Live" value={String(published.length)} />
        <Figure label="Verified" value={`${verified.length} of ${published.length}`} />
      </dl>

      <ul className="space-y-3">
        {listings.map((listing) => {
          const cover = listing.images?.find((image) => image.is_cover) ?? listing.images?.[0];
          const province = listing.location?.path?.split('.')[1] ?? 'nepal';
          const href = `/properties/${province}/${listing.location?.slug ?? 'nepal'}/${listing.slug}`;
          const isVerified = listing.verified_at != null;

          return (
            <li
              key={listing.id}
              className="grid gap-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft sm:grid-cols-[120px_1fr]"
            >
              <PropertyImage
                renditions={cover?.rendition_paths ?? undefined}
                storagePath={cover?.storage_path}
                alt={listing.title}
                width={400}
                height={300}
                sizes="120px"
                wrapperClassName="w-full rounded-lg border border-ink-200"
              />

              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="label">
                      {listing.reference_code} · {listing.location?.name_en ?? 'Location not set'}
                    </p>
                    <h2 className="mt-1.5 truncate font-semibold tracking-[-0.02em] text-ink-900">
                      {listing.status === 'published' ? (
                        <Link href={href} target="_blank" className="hover:text-royal-700">
                          {listing.title}
                        </Link>
                      ) : (
                        listing.title
                      )}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {isVerified && <VerifiedMark />}
                    <Badge tone={STATUS_TONE[listing.status] ?? 'pending'}>
                      {STATUS_LABEL[listing.status] ?? listing.status}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 border-t border-ink-100 pt-3">
                  <Fact label="Price" value={formatPrice(listing.price)} />
                  <Fact label="Photos" value={String(listing.images?.length ?? 0)} />
                  <Fact
                    label="Listed by"
                    value={`${listing.owner?.full_name ?? 'Unknown'} (${
                      ROLE_LABELS[listing.owner?.role as Role] ?? listing.owner?.role ?? 'unknown'
                    })`}
                  />
                  <Fact
                    label="Published"
                    value={listing.published_at ? formatDate(listing.published_at) : 'Not yet'}
                  />
                </dl>

                {listing.status === 'published' ? (
                  <div className="mt-4 border-t border-ink-100 pt-3">
                    <VerifyListingToggle propertyId={listing.id} verified={isVerified} />
                  </div>
                ) : (
                  <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-500">
                    A listing can be verified once it is live.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Waiting for review',
  published: 'Live',
  rejected: 'Sent back',
  sold: 'Sold',
  rented: 'Rented',
  archived: 'Archived',
};

const STATUS_TONE: Record<string, 'verified' | 'pending' | 'rejected'> = {
  published: 'verified',
  sold: 'verified',
  rented: 'verified',
  rejected: 'rejected',
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd className="nums mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="label">{label}</dt>
      <dd className="nums mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink-900">{value}</dd>
    </div>
  );
}
