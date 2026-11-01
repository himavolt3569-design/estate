import { landFacts } from './land';
import type { Listing } from './firebase/types';
import { listingCreatedAt } from './listing-search';
import { isForSale, listingPrice } from './listing-commerce';

const tokens = (listing: Listing) => new Set([listing.title, listing.description, listing.address, ...(listing.facilities || []), ...(listing.roomType === 'land' ? landFacts(listing.land).map(fact => fact.value) : [])].join(' ').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
const distance = (a: NonNullable<Listing['geoPoint']>, b: NonNullable<Listing['geoPoint']>) => {
  const radians = (n: number) => n * Math.PI / 180;
  const h = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
};

/** Content-based recommender: corpus-weighted cosine similarity, price and proximity.
 * Uses only property attributes; no account identity or personal characteristics.
 */
export function recommendListings(current: Listing, listings: Listing[], count = 5) {
  const candidates = listings.filter(item => item.id !== current.id && item.status === 'active' && isForSale(item) === isForSale(current));
  const documents = [current, ...candidates].map(tokens);
  const frequency = new Map<string, number>();
  documents.forEach(document => document.forEach(word => frequency.set(word, (frequency.get(word) || 0) + 1)));
  const weight = (word: string) => 1 + Math.log((documents.length + 1) / ((frequency.get(word) || 0) + 1));
  const norm = (document: Set<string>) => Math.sqrt([...document].reduce((sum, word) => sum + weight(word) ** 2, 0));
  const source = documents[0]!;
  return candidates.map((listing, index) => {
    const document = documents[index + 1]!;
    const denominator = norm(source) * norm(document);
    const similarity = denominator ? [...source].reduce((sum, word) => sum + (document.has(word) ? weight(word) ** 2 : 0), 0) / denominator : 0;
    const sameType = listing.roomType === current.roomType;
    const price = Math.max(0, 1 - Math.abs(listingPrice(listing) - listingPrice(current)) / Math.max(listingPrice(current), 1));
    const km = current.geoPoint && listing.geoPoint ? distance(current.geoPoint, listing.geoPoint) : null;
    const score = similarity * 30 + Number(sameType) * 25 + price * 25 + (km !== null ? Math.max(0, 1 - km / 15) * 20 : 0);
    const reasons = [sameType ? 'Same property type' : '', price > 0.8 ? 'Similar budget' : '', km !== null && km < 5 ? 'Nearby location' : ''].filter(Boolean);
    return { listing, score, reasons: reasons.length ? reasons : ['Similar property details'] };
  }).sort((a, b) => b.score - a.score || listingCreatedAt(b.listing) - listingCreatedAt(a.listing) || a.listing.id.localeCompare(b.listing.id)).slice(0, Math.max(0, Math.min(count, 5)));
}
