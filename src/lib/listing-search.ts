import type { Listing } from './firebase/types';

export type SearchFilters = {
  search: string;
  roomType: string;
  minRent: string;
  maxRent: string;
  furnishing: string;
  facility: string;
  verifiedOnly: boolean;
  nearby: { lat: number; lng: number } | null;
};

export const emptySearch: SearchFilters = {
  search: '', roomType: '', minRent: '', maxRent: '', furnishing: '', facility: '', verifiedOnly: false, nearby: null,
};

export function listingCreatedAt(listing: Listing): number {
  return timestampMillis(listing.createdAt);
}

export function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const timestamp = value as { toMillis?: () => number; seconds?: number } | null;
  return timestamp?.toMillis?.() || Number(timestamp?.seconds || 0) * 1000;
}

export function hasSearchFilters(filters: SearchFilters): boolean {
  return Boolean(filters.search.trim() || filters.roomType || filters.minRent || filters.maxRent
    || filters.furnishing || filters.facility.trim() || filters.verifiedOnly || filters.nearby);
}

// Older saves stored the input as a name and accidentally kept empty criteria.
// Recover those keywords at read time; new saves explicitly allow an all-rentals search.
export function savedSearchFilters(item: { name: string; filters?: Partial<SearchFilters>; criteriaVersion?: number }): SearchFilters {
  const filters = { ...emptySearch, ...item.filters };
  if (!item.criteriaVersion && !hasSearchFilters(filters)) filters.search = item.name.trim();
  return filters;
}

export function savedSearchUrl(id: string): string {
  return `/dashboard?tab=searches&search=${encodeURIComponent(id)}#saved-search-results`;
}

export function searchFilterLabels(filters: SearchFilters): string[] {
  const labels: string[] = [];
  if (filters.search.trim()) labels.push(`“${filters.search.trim()}”`);
  if (filters.roomType) labels.push(filters.roomType);
  const money = (value: string) => `Rs. ${Number(value).toLocaleString('en-NP')}`;
  if (filters.minRent && filters.maxRent) labels.push(`${money(filters.minRent)} – ${money(filters.maxRent)} / month`);
  else if (filters.minRent) labels.push(`From ${money(filters.minRent)} / month`);
  else if (filters.maxRent) labels.push(`Up to ${money(filters.maxRent)} / month`);
  if (filters.furnishing) labels.push(filters.furnishing === 'semiFurnished' ? 'Semi furnished' : filters.furnishing);
  if (filters.facility.trim()) labels.push(filters.facility.trim());
  if (filters.verifiedOnly) labels.push('Verified only');
  if (filters.nearby) labels.push('Within 10 km');
  return labels.length ? labels : ['All active rentals'];
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchesSearch(listing: Listing, filters: SearchFilters) {
  if (listing.status !== 'active') return false;
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const text = normalize([listing.title, listing.address, listing.nearbyLandmarks, listing.description].filter(Boolean).join(' '));
  const keywords = normalize(filters.search).split(' ').filter(Boolean);
  return keywords.every(keyword => text.includes(keyword))
    && (!filters.roomType || listing.roomType === filters.roomType)
    && (!filters.minRent || listing.rentPerMonth >= Number(filters.minRent))
    && (!filters.maxRent || listing.rentPerMonth <= Number(filters.maxRent))
    && (!filters.furnishing || listing.furnishing === filters.furnishing)
    && (!filters.facility || (listing.facilities || []).some(value => value.toLowerCase().includes(filters.facility.trim().toLowerCase())))
    && (!filters.verifiedOnly || listing.verificationStatus === 'verified')
    && (!filters.nearby || Boolean(listing.geoPoint && distanceKm(filters.nearby.lat, filters.nearby.lng, listing.geoPoint.latitude, listing.geoPoint.longitude) <= 10));
}

export function searchUrl(filters: SearchFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'nearby' || !value) continue;
    params.set(key, String(value));
  }
  if (filters.nearby) { params.set('lat', String(filters.nearby.lat)); params.set('lng', String(filters.nearby.lng)); }
  return `/?${params.toString()}#rentals`;
}

export function searchFromUrl(search: string): SearchFilters {
  const params = new URLSearchParams(search);
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  return {
    search: params.get('search') || '', roomType: params.get('roomType') || '',
    minRent: params.get('minRent') || '', maxRent: params.get('maxRent') || '',
    furnishing: params.get('furnishing') || '', facility: params.get('facility') || '',
    verifiedOnly: params.get('verifiedOnly') === 'true',
    nearby: params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
  };
}
