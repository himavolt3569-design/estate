import { Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { getTranslation } from '@/i18n';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PropertyCardGrid } from '@/modules/discovery/components/PropertyCard';
import type { PropertyCardDTO } from '@/modules/discovery/types';
import { formatPrice } from '@/lib/format';

export const metadata: Metadata = { title: 'Saved Properties', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardSavedPage() {
  const [user] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: favorites } = await supabase
    .from('favorites')
    .select(`
      property:properties (
        id, title, reference_code, slug, price, transaction_type, category, subtype, bedrooms, bathrooms, area_display,
        location:locations!properties_location_id_fkey ( name_en, name_ne ),
        images:property_images ( storage_path, rendition_paths, is_cover ),
        verified, created_at, listed_by_role
      )
    `)
    .order('created_at', { ascending: false });

  // Map to PropertyCardDTO so we can reuse the beautiful UI
  // Note: the `areaDisplay` and other formatting normally happens in a query layer, doing a quick map here.
  const properties: PropertyCardDTO[] = (favorites ?? [])
    .map(f => f.property as any)
    .filter(Boolean)
    .map((prop: any) => ({
      id: prop.id,
      referenceCode: prop.reference_code,
      slug: prop.slug,
      title: prop.title,
      href: `/properties/${prop.location?.name_en?.toLowerCase() || 'location'}/${prop.slug}`,
      category: prop.category,
      subtype: prop.subtype,
      transactionType: prop.transaction_type,
      priceFormatted: formatPrice(prop.price),
      priceRaw: prop.price,
      areaDisplay: prop.area_display || 'Area not stated',
      areaSecondary: null,
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      locality: prop.location?.name_en || 'Unknown',
      addressLine: null,
      lat: 0,
      lng: 0,
      distanceLabel: null,
      cover: prop.images?.[0] ? {
        renditions: prop.images[0].rendition_paths || {},
        blurhash: null,
        alt: prop.title
      } : null,
      verified: prop.verified || false,
      listedByLabel: 'Listed by Kitta',
      publishedAt: prop.created_at,
      favoriteCount: 1
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Saved Properties
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Properties you have favorited
        </p>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title="No saved properties"
          description="When you favorite a property in search, it will appear here."
          action={
            <Button asChild>
              <Link href="/search">Start searching</Link>
            </Button>
          }
        />
      ) : (
        <PropertyCardGrid properties={properties} />
      )}
    </div>
  );
}
