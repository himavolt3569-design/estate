import { describe, expect, it } from 'vitest';
import { canSell, isForSale, listingPrice, validListingPrice } from './listing-commerce';
import { emptySearch, matchesSearch, searchFromUrl, searchUrl } from './listing-search';
import { generateListingDetails, type ListingDetailsDraft } from './listing-details';
import type { Listing } from './firebase/types';

const rental: Listing = { id: 'rental', ownerId: 'owner', ownerName: 'Owner', title: 'Patan house', roomType: 'house', rentPerMonth: 25000, status: 'active' };
const sale: Listing = { ...rental, id: 'sale', transactionType: 'sale', rentPerMonth: 0, salePrice: 25000000 };
describe('rent and sale offers', () => {
  it('preserves legacy rental pricing and reads sale asking prices separately', () => {
    expect(isForSale(rental)).toBe(false);
    expect(listingPrice(rental)).toBe(25000);
    expect(isForSale(sale)).toBe(true);
    expect(listingPrice(sale)).toBe(25000000);
  });
  it('allows every requested sale type except flats and rejects invalid prices', () => {
    for (const type of ['room', 'apartment', 'house', 'office', 'shop', 'land']) expect(validListingPrice(type, 'sale', 100)).toBe(true);
    expect(canSell('flat')).toBe(false);
    expect(validListingPrice('flat', 'sale', 100)).toBe(false);
    expect(validListingPrice('flat', 'rent', 100)).toBe(true);
    expect(validListingPrice('house', 'sale', NaN)).toBe(false);
    expect(validListingPrice('house', 'rent', 0)).toBe(false);
  });
  it('filters Rent and Buy by the appropriate price and round trips saved criteria', () => {
    const filters = { ...emptySearch, transactionType: 'sale' as const, minRent: '20000000', maxRent: '30000000' };
    expect(matchesSearch(sale, filters)).toBe(true);
    expect(matchesSearch(rental, filters)).toBe(false);
    expect(matchesSearch(sale, { ...emptySearch, transactionType: 'rent' })).toBe(false);
    expect(searchFromUrl(new URL(searchUrl(filters), 'https://example.test').search)).toEqual(filters);
  });
  it('generates sale copy without calling the asking price monthly rent', () => {
    const draft: ListingDetailsDraft = { type: 'house', transactionType: 'sale', rent: '25000000', deposit: '50000', floor: '2', totalFloors: '4', furnishing: 'unfurnished', availableFrom: '2026-10-31', address: 'Patan', nearbyLandmarks: '', facilities: [] };
    const copy = generateListingDetails(draft, 0, 'en');
    expect(copy.title).toContain('for sale');
    expect(copy.description).toContain('Asking price:');
    expect(copy.description).not.toContain('Monthly rent:');
    expect(copy.description).not.toContain('Deposit:');
  });
});
