import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { emptyContactNumber } from '@/modules/listings/contact-numbers';
import { ListingWizard } from '@/modules/listings/components/ListingWizard';
import {
  getFeatureOptions,
  getListingForEdit,
  getLocationOptions,
  getPostableOwners,
} from '@/modules/listings/queries';
import { paisaToRupees } from '@/lib/format';
import { AREA_UNITS } from '@/modules/listings/schema';

export const metadata: Metadata = { title: 'Edit property', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  published: 'verified',
  pending_review: 'pending',
  draft: 'neutral',
  sold: 'solid',
  rented: 'solid',
  rejected: 'rejected',
  archived: 'neutral',
} as const;

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/dashboard/listings/${id}/edit`);

  const admin = user.role === 'platform_admin';
  if (!isVendor(user.role) && !admin) redirect('/dashboard');

  const listing = await getListingForEdit(id);
  if (!listing) notFound();

  const [{ provinces, districts }, features, owners] = await Promise.all([
    getLocationOptions(),
    getFeatureOptions(),
    admin ? getPostableOwners() : Promise.resolve([]),
  ]);

  // area_raw is {unit: value}; the form edits one unit at a time, so the first
  // entry is what the seller originally typed.
  const [areaUnit, areaValue] = Object.entries(listing.area_raw ?? {})[0] ?? [];

  const supabase = await createClient();
  const publicUrl = (path: string) =>
    supabase.storage.from('property-media').getPublicUrl(path).data.publicUrl;

  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-16">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/listings">
            <ArrowLeft aria-hidden /> My properties
          </Link>
        </Button>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
            {listing.title}
          </h1>
          <Badge tone={STATUS_TONE[listing.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
            {listing.status.replace('_', ' ')}
          </Badge>
        </div>
        <p className="nums mt-2 text-sm text-ink-500">{listing.reference_code}</p>
      </div>

      <ListingWizard
        provinces={provinces}
        districts={districts}
        features={features}
        owners={owners}
        isAdmin={admin}
        existing={{
          id: listing.id,
          status: listing.status,
          images: listing.images
            .sort((a, b) => a.position - b.position)
            .map((image) => ({
              id: image.id,
              storagePath: image.storage_path,
              url: publicUrl(image.storage_path),
              isCover: image.is_cover,
            })),
          draft: {
            category: listing.category as never,
            subtype: listing.subtype as never,
            transactionType: listing.transaction_type as never,
            price: String(Math.round(paisaToRupees(listing.price))),
            pricePeriod: listing.price_period as never,
            priceNegotiable: listing.price_negotiable,

            provinceId: listing.location?.parent_id ?? '',
            locationId: listing.location_id,
            addressLine: listing.address_line ?? '',
            lat: listing.point?.lat ?? 27.7172,
            lng: listing.point?.lng ?? 85.324,
            geomPrecision: listing.geom_precision,

            title: listing.title,
            description: listing.description,

            areaValue: areaValue != null ? String(areaValue) : '',
            areaUnit: (AREA_UNITS as readonly string[]).includes(areaUnit ?? '')
              ? (areaUnit as never)
              : 'ropani',
            bedrooms: listing.bedrooms == null ? '' : String(listing.bedrooms),
            bathrooms: listing.bathrooms == null ? '' : String(listing.bathrooms),
            floors: listing.floors == null ? '' : String(listing.floors),
            parking: listing.parking == null ? '' : String(listing.parking),
            roadAccessFt: listing.road_access_ft == null ? '' : String(listing.road_access_ft),
            featureIds: listing.features.map((feature) => feature.feature_id),
            showPhone: listing.show_phone,
            showEmail: listing.show_email,
            showWhatsapp: listing.show_whatsapp,
            // Shown back in the national form the seller typed, not as +977...
            contactNumbers:
              listing.contacts && listing.contacts.length > 0
                ? [...listing.contacts]
                    .sort((a, b) => a.position - b.position)
                    .map((contact) => ({
                      phone: contact.phone_e164.replace(/^\+977/, ''),
                      label: contact.label ?? '',
                      isWhatsapp: contact.is_whatsapp,
                    }))
                : [emptyContactNumber()],

            ownerId: listing.owner_id,
          },
        }}
      />
    </div>
  );
}
