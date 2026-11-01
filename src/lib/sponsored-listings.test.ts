import { describe, expect, it } from 'vitest';
import type { Listing } from './firebase/types';
import { listingCampaign, resolveListingCampaigns, uniqueCampaigns } from './sponsored-listings';

const ad = { id: 'campaign', title: 'Old headline', linkType: 'listing', listingId: 'land', status: 'active', imageUrls: ['old.jpg'], mobileImageUrl: 'old-mobile.jpg' };
const listing = { id: 'land', title: 'Current land title', roomType: 'land', status: 'active', transactionType: 'sale', salePrice: 8000000, rentPerMonth: 0, address: 'Patan', photoUrls: ['new.jpg'], land: { area: 4, areaUnit: 'aana' } } as Listing;
describe('automatic sponsored properties', () => {
  it('tracks current property content instead of stale campaign snapshots', () => {
    const resolved = listingCampaign(ad, listing);
    expect(resolved.title).toBe(listing.title);
    expect(resolved.subtitle).toContain('8,000,000 total asking price');
    expect(resolved.subtitle).toContain('4 Aana');
    expect(resolved.imageUrls).toEqual(['new.jpg']);
    expect(resolved.mobileImageUrl).toBe('');
    expect(listingCampaign(ad, { ...listing, transactionType: 'rent', rentPerMonth: 25000 }).subtitle).toContain('25,000 / month');
  });
  it('stops unavailable properties while leaving website campaigns available', () => {
    const external = { id: 'website', linkType: 'external', externalUrl: 'https://example.com' };
    expect(resolveListingCampaigns([ad, external], [{ ...listing, status: 'paused' }])).toEqual([external]);
    expect(resolveListingCampaigns([ad], [])).toEqual([]);
  });
  it('suppresses duplicate destinations and already displayed homepage campaigns', () => {
    const external = { id: 'one', linkType: 'external', externalUrl: 'https://example.com' };
    expect(uniqueCampaigns([external, { ...external, id: 'two' }, ad, { ...ad, id: 'copy' }])).toEqual([external, ad]);
    expect(uniqueCampaigns([external, ad], [external])).toEqual([ad]);
  });
});
