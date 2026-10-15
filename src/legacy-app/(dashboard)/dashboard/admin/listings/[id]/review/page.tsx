import { AlertTriangle, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Avatar } from '@/components/media/Avatar';
import { Badge, Surface } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { formatArea, formatPrice, formatDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { ModerationDecision } from '@/modules/admin/components/ModerationDecision';
import { MessageOwnerButton } from '@/modules/admin/components/MessageOwnerButton';
import { PropertyGallery } from '@/modules/discovery/components/PropertyGallery';
import { VerifyListingToggle } from '@/modules/admin/components/VerifyListingToggle';

export const metadata: Metadata = { title: 'Review Listing', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminListingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  
  if (!user || user.role !== 'platform_admin') redirect('/dashboard');

  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from('properties')
    .select(`
      *,
      location:locations!properties_location_id_fkey(name_en, slug),
      owner:profiles!properties_owner_id_fkey(id, full_name, role, avatar_url, created_at, phone),
      images:property_images(id, storage_path, rendition_paths, is_cover, is_360, hotspots),
      features:property_features(feature:features(label_en, icon))
    `)
    .eq('id', id)
    .single();

  if (error || !property) notFound();

  const isPublished = property.status === 'published';
  const isPending = property.status === 'pending_review';

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/dashboard/admin/listings">
              <ArrowLeft aria-hidden /> Back to listings
            </Link>
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
              {property.title}
            </h1>
            <Badge tone={isPublished ? 'verified' : isPending ? 'pending' : 'neutral'}>
              {property.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="nums mt-2 text-sm text-ink-500">
            {property.reference_code} · {property.location?.name_en}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="secondary">
            <Link href={`/dashboard/listings/${property.id}/edit`}>Edit Details</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8 min-w-0">
          <Surface className="overflow-hidden p-1">
            <PropertyGallery
              images={property.images.map((image: any) => ({
                id: image.id,
                renditions: image.rendition_paths,
                storagePath: image.storage_path,
                isCover: image.is_cover,
                is360: image.is_360,
                hotspots: image.hotspots,
                alt: property.title,
              }))}
              title={property.title}
            />
          </Surface>

          <Surface className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-ink-900 mb-6">Listing Details</h2>
            
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 border-b border-ink-100 pb-8 mb-8">
              <Fact label="Price" value={formatPrice(property.price)} />
              <Fact label="Area" value={formatArea(property.area_sqm, 'ropani')} />
              <Fact label="Category" value={property.category} />
              <Fact label="Subtype" value={property.subtype.replace('_', ' ')} />
              <Fact label="Bedrooms" value={property.bedrooms ?? '—'} />
              <Fact label="Bathrooms" value={property.bathrooms ?? '—'} />
              <Fact label="Floors" value={property.floors ?? '—'} />
            </dl>

            <div className="prose prose-sm max-w-none text-ink-700">
              <h3 className="text-sm font-semibold text-ink-900">Description</h3>
              <p className="whitespace-pre-wrap mt-2">{property.description || 'No description provided.'}</p>
            </div>
          </Surface>

          {property.features?.length > 0 && (
            <Surface className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-ink-900 mb-4">Features & Amenities</h2>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {property.features.map((f: any) => (
                  <li key={f.feature.label_en} className="flex items-center gap-2 text-sm text-ink-700">
                    <span className="size-1.5 rounded-full bg-ink-300" />
                    {f.feature.label_en}
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </div>

        <div className="space-y-6">
          <Surface className="p-6">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Moderation Action</h3>
            {isPending ? (
              <div className="space-y-4">
                <ModerationDecision propertyId={property.id} />
                <p className="text-xs text-ink-500 mt-2">
                  Approve to publish the listing, or reject with a reason to send it back to the owner for fixes.
                </p>
              </div>
            ) : isPublished ? (
              <div className="space-y-4">
                <VerifyListingToggle propertyId={property.id} verified={property.verified_at != null} />
                <p className="text-xs text-ink-500">
                  Verified listings get a blue seal and are boosted in search results.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
                <p className="text-sm text-ink-600 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-ink-400" />
                  This listing is currently <strong>{property.status.replace('_', ' ')}</strong>. It must be submitted for review before it can be published.
                </p>
              </div>
            )}
          </Surface>

          <Surface className="p-6">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Owner Information</h3>
            <div className="flex items-center gap-3 mb-6">
              <Avatar src={property.owner.avatar_url} name={property.owner.full_name} size="md" />
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{property.owner.full_name}</p>
                <p className="text-xs text-ink-500">{ROLE_LABELS[property.owner.role as keyof typeof ROLE_LABELS]}</p>
              </div>
            </div>

            <dl className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <dt className="text-ink-500">Phone</dt>
                <dd className="text-ink-900 nums">{property.owner.phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-ink-500">Joined</dt>
                <dd className="text-ink-900 nums">{formatDate(property.owner.created_at)}</dd>
              </div>
            </dl>

            <MessageOwnerButton propertyId={property.id} />
          </Surface>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="nums mt-1 font-medium text-ink-900">{value}</dd>
    </div>
  );
}
