import { describe, expect, it } from 'vitest';
import { landArea, landFacts, landFromForm } from './land';
import { emptySearch, matchesSearch, searchFromUrl, searchUrl } from './listing-search';
import { generateListingDetails } from './listing-details';
import type { Listing } from './firebase/types';

const form = (patch: Record<string, string> = {}) => {
  const data = new FormData();
  Object.entries({ landArea: '4.5', landAreaUnit: 'aana', landUse: 'residential', roadAccess: 'motorable', roadWidth: '20', frontage: '30', landLengthUnit: 'ft', landFacing: 'east', ...patch }).forEach(([key, value]) => data.set(key, value));
  return data;
};
describe('land records', () => {
  it('preserves local units, optional measurements and legacy records', () => {
    const land = landFromForm(form())!;
    expect(landArea(land)).toBe('4.5 Aana');
    expect(landFacts(land)).toContainEqual({ label: 'Road width', value: '20 ft' });
    expect(landFromForm(new FormData(), false)).toBeNull();
    expect(landFacts(undefined)).toEqual([]);
    expect(landFromForm(form({ roadAccess: 'none' }))).not.toHaveProperty('roadWidth');
    expect(landFromForm(form({ roadWidth: '', frontage: '' }))).not.toHaveProperty('frontage');
  });
  it('rejects invalid area, units and supplied measurements', () => {
    for (const patch of [{ landArea: '0' }, { landArea: '-1' }, { landArea: 'Infinity' }, { landAreaUnit: 'invented' }, { roadWidth: '-20' }, { frontage: '0' }, { landUse: 'invented' }] as Record<string, string>[]) expect(() => landFromForm(form(patch))).toThrow();
  });
  it('supports land filters, saved URLs and land keywords', () => {
    const listing = { id: 'land', status: 'active', roomType: 'land', title: 'Test land', rentPerMonth: 0, transactionType: 'sale', salePrice: 5000000, land: landFromForm(form()) } as Listing;
    const filters = { ...emptySearch, roomType: 'land', landUse: 'residential', roadAccess: 'motorable', transactionType: 'sale' as const, search: '4.5 aana' };
    expect(matchesSearch(listing, filters)).toBe(true);
    expect(matchesSearch({ ...listing, land: undefined }, filters)).toBe(false);
    expect(matchesSearch(listing, { ...filters, roadAccess: 'footpath' })).toBe(false);
    expect(matchesSearch(listing, { ...emptySearch, furnishing: 'furnished' })).toBe(false);
    expect(searchFromUrl(new URL(searchUrl(filters), 'https://example.test').search)).toEqual(filters);
  });
  it('adds entered land facts to suggested descriptions without building facts', () => {
    const result = generateListingDetails({ type: 'land', transactionType: 'sale', rent: '5000000', deposit: '0', floor: '2', totalFloors: '5', furnishing: 'furnished', availableFrom: '', address: 'Patan', nearbyLandmarks: '', facilities: [], land: landFromForm(form()) });
    expect(result.description).toContain('Land area: 4.5 Aana.');
    expect(result.description).toContain('Frontage: 30 ft.');
    expect(result.description).not.toMatch(/Furnishing:|Floor:/);
  });
});
