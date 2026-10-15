import { describe, expect, it } from 'vitest';
import { emptySearch, listingCreatedAt, matchesSearch, savedSearchFilters, savedSearchUrl, searchFromUrl, searchUrl, timestampMillis } from './listing-search';
import type { Listing } from './firebase/types';

const rental = { id: 'a', ownerId: 'u', ownerName: 'Owner', title: 'Sunny flat', roomType: 'flat', rentPerMonth: 24000, status: 'active', furnishing: 'furnished', facilities: ['Parking', 'Water'], verificationStatus: 'verified', address: 'Patan' } as Listing;

describe('listing searches', () => {
  it('matches combined filters and excludes unavailable rentals', () => {
    const filters = { ...emptySearch, search: 'patan', minRent: '20000', maxRent: '25000', furnishing: 'furnished', facility: 'park', verifiedOnly: true };
    expect(matchesSearch(rental, filters)).toBe(true);
    expect(matchesSearch({ ...rental, status: 'paused' }, filters)).toBe(false);
    expect(matchesSearch({ ...rental, facilities: ['Water'] }, filters)).toBe(false);
    expect(matchesSearch({ ...rental, verificationStatus: 'pending' }, filters)).toBe(false);
  });

  it('round trips a saved search URL including nearby location', () => {
    const filters = { ...emptySearch, search: 'New Baneshwor', roomType: 'room', minRent: '10000', verifiedOnly: true, nearby: { lat: 27.69, lng: 85.34 } };
    expect(searchFromUrl(new URL(searchUrl(filters), 'https://example.test').search)).toEqual(filters);
  });

  it('recovers the location keyword from old empty-filter saves and gives each a real count', () => {
    const listings = [
      { ...rental, id: 'janakpur', address: 'Janakpur' },
      { ...rental, id: 'bhaktapur-1', address: 'Bhaktapur' },
      { ...rental, id: 'bhaktapur-2', address: 'Bhaktapur' },
      { ...rental, id: 'paused', address: 'Kapan', status: 'paused' },
      { ...rental, id: 'patan', address: 'Patan' },
    ];
    const counts = ['janakpur', 'bhaktapur', 'kapan'].map(name => {
      const filters = savedSearchFilters({ name, filters: emptySearch });
      return listings.filter(listing => matchesSearch(listing, filters)).length;
    });
    expect(counts).toEqual([1, 2, 0]);
  });

  it('keeps a display name separate from explicit criteria, including all-rentals searches', () => {
    expect(savedSearchFilters({ name: 'My next home', filters: { ...emptySearch, search: 'Patan', maxRent: '25000' } }).search).toBe('Patan');
    expect(savedSearchFilters({ name: 'Every rental', filters: emptySearch, criteriaVersion: 1 })).toEqual(emptySearch);
    expect(savedSearchFilters({ name: '  Kapan  ' }).search).toBe('Kapan');
    expect(savedSearchFilters({ name: 'Budget places', filters: { maxRent: '20000' } }).search).toBe('');
  });

  it('matches every keyword regardless of case, whitespace, or word order', () => {
    expect(matchesSearch(rental, { ...emptySearch, search: ' PATAN   sunny\nflat ' })).toBe(true);
    expect(matchesSearch(rental, { ...emptySearch, search: 'Sunny Bhaktapur' })).toBe(false);
    expect(matchesSearch({ ...rental, description: 'Quiet balcony near the river' }, { ...emptySearch, search: 'balcony Patan' })).toBe(true);
    expect(matchesSearch({ ...rental, address: 'कपन काठमाडौं' }, { ...emptySearch, search: 'काठमाडौं कपन' })).toBe(true);
  });

  it('combines nearby, room type, and price constraints with the same matching logic', () => {
    const local = { ...rental, geoPoint: { latitude: 27.69, longitude: 85.34 } } as Listing;
    const filters = { ...emptySearch, search: 'Patan', roomType: 'flat', minRent: '20000', maxRent: '25000', nearby: { lat: 27.69, lng: 85.34 } };
    expect(matchesSearch(local, filters)).toBe(true);
    expect(matchesSearch({ ...local, rentPerMonth: 26000 }, filters)).toBe(false);
    expect(matchesSearch({ ...local, roomType: 'room' }, filters)).toBe(false);
    expect(matchesSearch({ ...local, geoPoint: { latitude: 26.73, longitude: 85.92 } } as Listing, filters)).toBe(false);
    expect(matchesSearch({ ...local, geoPoint: null }, filters)).toBe(false);
  });

  it('uses timestamp values to count only matches posted after the last visit', () => {
    const seenAt = timestampMillis({ seconds: 100 });
    const listings = [99, 100, 101].map(seconds => ({ ...rental, createdAt: { seconds } }) as Listing);
    expect(listings.filter(listing => listingCreatedAt(listing) > seenAt)).toHaveLength(1);
    expect(timestampMillis({ toMillis: () => 123456 })).toBe(123456);
    expect(timestampMillis(new Date(123456))).toBe(123456);
    expect(timestampMillis(undefined)).toBe(0);
  });

  it('links to the selected saved search instead of the generic rental feed', () => {
    const url = new URL(savedSearchUrl('city & budget'), 'https://example.test');
    expect(url.pathname).toBe('/dashboard');
    expect(url.searchParams.get('tab')).toBe('searches');
    expect(url.searchParams.get('search')).toBe('city & budget');
    expect(url.hash).toBe('#saved-search-results');
  });
});
