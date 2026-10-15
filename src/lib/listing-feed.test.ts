import { describe, expect, it } from 'vitest';
import { listingFeed } from './listing-feed';

describe('listingFeed', () => {
  it('puts a sponsor in the third slot after two regular listings', () => {
    expect(listingFeed(['A', 'B', 'C'], 'AD').map(slot => slot.kind)).toEqual(['listing', 'listing', 'sponsor', 'listing']);
    expect(listingFeed(['A', 'B'], 'AD').map(slot => slot.kind)).toEqual(['listing', 'listing', 'sponsor']);
  });

  it('keeps a natural listing grid when no sponsor is available', () => {
    expect(listingFeed(['A', 'B', 'C'], null).map(slot => slot.kind)).toEqual(['listing', 'listing', 'listing']);
  });
});
