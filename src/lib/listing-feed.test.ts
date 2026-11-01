import { describe, expect, it } from 'vitest';
import { listingFeed } from './listing-feed';

describe('listingFeed', () => {
  it('uses campaigns once after four rentals without replacing or duplicating rentals', () => {
    const listings = Array.from({ length: 11 }, (_, index) => index);
    const feed = listingFeed(listings, ['AD']);
    expect(feed.filter(slot => slot.kind === 'listing').map(slot => slot.listing)).toEqual(listings);
    expect(feed.map((slot, index) => slot.kind === 'sponsor' ? index : -1).filter(index => index >= 0)).toEqual([4]);
    expect(listingFeed(['A', 'B', 'C', 'D'], ['AD']).at(-1)?.kind).toBe('listing');
  });

  it('supports configured spacing and clamps unsafe values to three through five', () => {
    const rentals = [1, 2, 3, 4, 5, 6];
    expect(listingFeed(rentals, ['AD'], 3)[3]?.kind).toBe('sponsor');
    expect(listingFeed(rentals, ['AD'], 100)[5]?.kind).toBe('sponsor');
    expect(listingFeed([], ['AD'])).toEqual([]);
  });

  it('uses separate campaigns in order without cycling them', () => {
    const feed = listingFeed(Array.from({ length: 20 }, (_, i) => i), ['A', 'B']);
    expect(feed.flatMap(slot => slot.kind === 'sponsor' ? [slot.ad] : [])).toEqual(['A', 'B']);
  });

  it('keeps a natural listing grid when no sponsor is available', () => {
    expect(listingFeed(['A', 'B', 'C'], null).map(slot => slot.kind)).toEqual(['listing', 'listing', 'listing']);
  });
});
