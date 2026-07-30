import 'server-only';

import { LISTED_BY_LABELS } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/session';
import { formatArea, formatAreaSecondary, formatDistance, formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { decodeCursor, encodeCursor } from '@/lib/utils';

import type { PropertyCardDTO, SearchFilters, SearchResult } from './types';

const PAGE_SIZE = 24;

type SearchRow = {
  id: string;
  reference_code: string;
  slug: string;
  title: string;
  category: PropertyCardDTO['category'];
  subtype: string;
  transaction_type: PropertyCardDTO['transactionType'];
  price: number;
  price_period: 'month' | 'year' | 'night' | null;
  area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  address_line: string | null;
  location_name: string;
  location_slug: string;
  province_slug: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  cover: {
    renditions?: { thumb?: string; card?: string; full?: string };
    blurhash?: string | null;
    alt?: string | null;
  } | null;
  verified: boolean;
  listed_by_role: Role;
  published_at: string;
  favorite_count: number;
};

function toCardDTO(row: SearchRow): PropertyCardDTO {
  const province = row.province_slug ?? 'nepal';
  return {
    id: row.id,
    referenceCode: row.reference_code,
    slug: row.slug,
    title: row.title,
    href: `/properties/${province}/${row.location_slug}/${row.slug}`,

    category: row.category,
    subtype: row.subtype,
    transactionType: row.transaction_type,

    priceFormatted: formatPrice(row.price, { period: row.price_period }),
    priceRaw: row.price,

    // Land in the terai is quoted in bigha, elsewhere in ropani. Showing a
    // buyer the unit they think in is the difference between a listing that
    // reads as local and one that reads as imported.
    areaDisplay: formatArea(row.area_sqm, row.category === 'land' ? 'ropani' : 'ropani'),
    areaSecondary: formatAreaSecondary(row.area_sqm),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,

    locality: row.location_name,
    addressLine: row.address_line,
    lat: row.lat,
    lng: row.lng,
    distanceLabel: formatDistance(row.distance_m),

    cover: row.cover?.renditions
      ? {
          renditions: row.cover.renditions,
          blurhash: row.cover.blurhash ?? null,
          alt: row.cover.alt ?? null,
        }
      : null,

    verified: row.verified,
    listedByLabel: LISTED_BY_LABELS[row.listed_by_role] ?? 'Listed by owner',
    publishedAt: row.published_at,
    favoriteCount: row.favorite_count,
  };
}

/**
 * The single search entry point. Everything (the search page, the map, the home
 * page rails, similar listings) goes through search_properties() so there is
 * one query plan to optimise and one place where the published/deleted predicate
 * is applied.
 */
export async function searchProperties(
  filters: SearchFilters,
  cursor?: string | null,
  limit = PAGE_SIZE,
): Promise<SearchResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('search_properties', {
    p_filters: filters as never,
    p_cursor: (decodeCursor(cursor) ?? null) as never,
    p_limit: limit,
  });

  if (error) {
    // Surfacing the raw Postgres message to a visitor tells them nothing useful
    // and tells an attacker about our schema.
    console.error('[search_properties]', error.message);
    return { items: [], nextCursor: null };
  }

  const rows = (data ?? []) as unknown as SearchRow[];
  const items = rows.map(toCardDTO);

  // The cursor is built from the last row of a FULL page. A short page means we
  // are at the end, so there is nothing to page to.
  let nextCursor: string | null = null;
  if (rows.length === limit) {
    const last = rows[rows.length - 1]!;
    const sort = filters.sort ?? 'newest';
    nextCursor = encodeCursor({
      id: last.id,
      ...(sort === 'price_asc' || sort === 'price_desc'
        ? { price: last.price }
        : sort === 'distance' && last.distance_m != null
          ? { distance: last.distance_m }
          : { published_at: last.published_at }),
    });
  }

  return { items, nextCursor };
}

/** Capped at 1000. See count_properties() in 0011 for why an exact count is not worth it. */
export async function countProperties(filters: SearchFilters): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('count_properties', { p_filters: filters as never });
  if (error) return 0;
  return (data as unknown as number) ?? 0;
}

/** The safe public projection. /properties/* reads this, never the table. */
export async function getPropertyBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_property_public', { p_slug: slug });
  if (error || !data) return null;
  return data as unknown as PropertyDetail;
}

export type PropertyDetail = {
  id: string;
  referenceCode: string;
  slug: string;
  title: string;
  description: string;
  category: PropertyCardDTO['category'];
  subtype: string;
  transactionType: PropertyCardDTO['transactionType'];
  price: number;
  pricePeriod: 'month' | 'year' | 'night' | null;
  priceNegotiable: boolean;
  serviceCharge: number | null;
  areaSqm: number | null;
  areaUnitEntered: string;
  areaRaw: Record<string, number>;
  builtAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  parking: number | null;
  addressLine: string | null;
  lat: number;
  lng: number;
  geomPrecision: 'exact' | 'approximate';
  verifiedAt: string | null;
  publishedAt: string;
  viewCount: number;
  favoriteCount: number;
  listedByRole: Role;
  /** Availability flags only. Values require a reveal_contact() call. */
  contact: { phone: boolean; email: boolean; whatsapp: boolean };
  showPaymentInfo: boolean;
  location: {
    id: string;
    nameEn: string;
    nameNe: string | null;
    slug: string;
    level: string;
    path: string;
    ancestors: Array<{ nameEn: string; slug: string; level: string }>;
  } | null;
  vendor: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    role: Role;
    identityVerified: boolean;
    memberSince: string;
    agency: { id: string; name: string; slug: string; logoUrl: string | null; verified: boolean } | null;
  } | null;
  images: Array<{
    id: string;
    renditions: { thumb?: string; card?: string; full?: string };
    blurhash: string | null;
    width: number | null;
    height: number | null;
    alt: string | null;
    isCover: boolean;
  }>;
  videos: Array<{ id: string; kind: string; externalId: string | null; url: string | null; title: string | null }>;
  floorPlans: Array<{ id: string; path: string }>;
  attributes: Record<string, string | number | boolean>;
  features: Array<{ key: string; labelEn: string; labelNe: string | null; icon: string | null }>;
  trustLedger: Array<{ event: string; at: string; detail: Record<string, unknown> }>;
};

export async function getSimilarProperties(propertyId: string, limit = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('similar_properties', {
    p_property_id: propertyId,
    p_limit: limit,
  });
  if (error || !data) return [];
  return data as unknown as Array<Record<string, unknown>>;
}
