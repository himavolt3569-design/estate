import { Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { LISTED_BY_LABELS } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatArea, formatAreaSecondary, formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { PropertyCardGrid } from '@/modules/discovery/components/PropertyCard';
import type { PropertyCardDTO } from '@/modules/discovery/types';

import { PageHeader } from '../components/PageHeader';

export const metadata: Metadata = { title: 'Saved properties', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardSavedPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/dashboard/saved');

  const supabase = await createClient();

  /*
   * This query used to ask for `area_display` and `verified`, neither of which
   * is a column on properties — the real ones are area_sqm and verified_at. The
   * whole select failed, `favorites` came back null, and the page told every
   * user they had saved nothing. It had never worked.
   */
  const { data: favorites, error } = await supabase
    .from('favorites')
    .select(
      `
      created_at,
      property:properties!favorites_property_id_fkey (
        id, title, reference_code, slug, price, price_period, transaction_type,
        category, subtype, bedrooms, bathrooms, area_sqm, address_line,
        verified_at, listed_by_role, published_at, favorite_count,
        location:locations!properties_location_id_fkey ( name_en, slug, path ),
        images:property_images ( storage_path, rendition_paths, is_cover )
      )
    `,
    )
    .order('created_at', { ascending: false });

  if (error) console.error('[saved]', error.message);

  const properties: PropertyCardDTO[] = (favorites ?? [])
    .map((row: Record<string, unknown>) => row.property as Record<string, unknown> | null)
    .filter((property): property is Record<string, unknown> => Boolean(property))
    .map((property) => {
      const location = property.location as { name_en: string; slug: string; path: string } | null;
      const images = (property.images ?? []) as Array<{
        storage_path: string;
        rendition_paths: Record<string, string> | null;
        is_cover: boolean;
      }>;
      const cover = images.find((image) => image.is_cover) ?? images[0];
      const province = location?.path?.split('.')[1] ?? 'nepal';

      return {
        id: property.id as string,
        referenceCode: property.reference_code as string,
        slug: property.slug as string,
        title: property.title as string,
        href: `/properties/${province}/${location?.slug ?? 'nepal'}/${property.slug}`,
        category: property.category as PropertyCardDTO['category'],
        subtype: property.subtype as string,
        transactionType: property.transaction_type as PropertyCardDTO['transactionType'],
        priceFormatted: formatPrice(property.price as number, {
          period: property.price_period as 'month' | 'year' | 'night' | null,
        }),
        priceRaw: property.price as number,
        areaDisplay: formatArea(property.area_sqm as number | null),
        areaSecondary: formatAreaSecondary(property.area_sqm as number | null),
        bedrooms: property.bedrooms as number | null,
        bathrooms: property.bathrooms as number | null,
        locality: location?.name_en ?? 'Nepal',
        addressLine: property.address_line as string | null,
        lat: 0,
        lng: 0,
        distanceLabel: null,
        cover: cover
          ? {
              renditions: cover.rendition_paths ?? {},
              storagePath: cover.storage_path,
              blurhash: null,
              alt: property.title as string,
            }
          : null,
        verified: property.verified_at != null,
        listedByLabel:
          LISTED_BY_LABELS[property.listed_by_role as keyof typeof LISTED_BY_LABELS] ??
          'Listed by owner',
        publishedAt: (property.published_at ?? property.created_at) as string,
        favoriteCount: (property.favorite_count as number) ?? 0,
      } satisfies PropertyCardDTO;
    });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your account"
        title="Saved properties"
        subtitle="Everything you have tapped the heart on. Nobody else can see this list."
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title="Nothing saved yet"
          description="Tap the heart on any property and it will wait for you here."
          action={
            <Button asChild>
              <Link href="/search">Browse properties</Link>
            </Button>
          }
        />
      ) : (
        <PropertyCardGrid properties={properties} />
      )}
    </div>
  );
}
