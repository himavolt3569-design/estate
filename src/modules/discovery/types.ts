/**
 * DTOs: the shape the UI consumes.
 *
 * Queries return these, never raw database rows. Formatting (price, area) is
 * done on the server so the formatting code never enters the client bundle, and
 * a column rename does not ripple into thirty components.
 */

export type PropertyCardDTO = {
  id: string;
  referenceCode: string;
  slug: string;
  title: string;
  href: string;

  category: 'residential' | 'land' | 'commercial';
  subtype: string;
  transactionType: 'sale' | 'rent' | 'lease' | 'short_stay';

  priceFormatted: string;
  priceRaw: number;

  areaDisplay: string;
  areaSecondary: string | null;
  bedrooms: number | null;
  bathrooms: number | null;

  locality: string;
  addressLine: string | null;
  lat: number;
  lng: number;
  distanceLabel: string | null;

  cover: {
    renditions: { thumb?: string; card?: string; full?: string };
    /** The uploaded object, used wherever a rendition is missing. */
    storagePath: string | null;
    blurhash: string | null;
    alt: string | null;
  } | null;

  verified: boolean;
  listedByLabel: string;
  publishedAt: string;
  favoriteCount: number;
};

export type SearchFilters = {
  q?: string;
  category?: 'residential' | 'land' | 'commercial';
  transaction_type?: 'sale' | 'rent' | 'lease' | 'short_stay';
  subtypes?: string[];
  price_min?: number;
  price_max?: number;
  bedrooms_min?: number;
  bathrooms_min?: number;
  area_min_sqm?: number;
  area_max_sqm?: number;
  features?: string[];
  location_path?: string;
  lat?: number;
  lng?: number;
  radius_m?: number;
  verified_only?: boolean;
  listed_after?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'distance' | 'verified_first';
};

export type SearchResult = {
  items: PropertyCardDTO[];
  nextCursor: string | null;
  /** True when the query itself failed, as opposed to matching nothing. */
  error?: boolean;
};
