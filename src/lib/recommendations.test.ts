import { describe, expect, it } from 'vitest';
import type { Listing } from './firebase/types';
import { recommendListings } from './recommendations';

const home = (id: string, overrides: Partial<Listing> = {}): Listing => ({ id, title: 'Sunny flat in Patan', ownerId: 'owner', ownerName: 'Owner', roomType: 'flat', rentPerMonth: 20000, facilities: ['Parking', 'Water'], status: 'active', ...overrides });
describe('content-based rental recommendations', () => {
  it('prefers similar budget and property features to an unrelated newer rental', () => {
    const current = home('current');
    const result = recommendListings(current, [home('unrelated', { roomType: 'office', title: 'Commercial warehouse', rentPerMonth: 90000, facilities: [], createdAt: new Date() }), home('similar', { rentPerMonth: 21000 })]);
    expect(result[0]?.listing.id).toBe('similar');
    expect(result[0]?.reasons).toContain('Similar budget');
  });
  it('excludes the current and unavailable properties and never invents filler records', () => {
    const current = home('current');
    const items = [current, home('paused', { status: 'paused' }), home('match')];
    expect(recommendListings(current, items).map(match => match.listing.id)).toEqual(['match']);
    expect(recommendListings(current, [current])).toEqual([]);
    expect(recommendListings(current, Array.from({ length: 12 }, (_, i) => home(`home-${i}`)), 20)).toHaveLength(5);
  });
});
