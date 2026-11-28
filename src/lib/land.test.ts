import { describe, expect, it } from 'vitest';
import {
  formatDualLength,
  landArea,
  landAreaDual,
  landAreaSqm,
  landFacts,
  landFromForm,
  landLabel,
  landMeasurementFacts,
} from './land';
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

  it('computes dual Nepali+Metric land sizes and dual m+ft boundary lengths cleanly', () => {
    expect(landLabel('hectare', 'en')).toBe('Hectare');
    expect(landLabel('hectare', 'ne')).toBe('हेक्टर');

    const fourAana = landFromForm(form({ landArea: '4', landAreaUnit: 'aana', roadWidth: '20', frontage: '30', landLengthUnit: 'ft' }))!;
    const sqm = landAreaSqm(fourAana);
    expect(sqm).toBeCloseTo(4 * 342.25 * 0.09290304, 10);

    const dual = landAreaDual(fourAana, 'en');
    expect(dual).not.toBeNull();
    expect(dual!.entered).toBe('4 Aana');
    expect(dual!.sqm).toBeCloseTo(127.18426176, 8);
    expect(dual!.metricShort).toBe('127.18 m²');
    expect(dual!.nepaliShort).toBe('4 Aana');
    expect(dual!.compact).toBe('4 Aana · 127.18 m²');

    const dualNe = landAreaDual(fourAana, 'ne');
    expect(dualNe!.metricShort).toBe('१२७.१८ m²');
    expect(dualNe!.nepaliShort).toBe('४ आना');

    const bighaPlot = landFromForm(form({ landArea: '1', landAreaUnit: 'bigha' }))!;
    expect(landAreaDual(bighaPlot, 'en')!.nepaliShort).toBe('1 Bigha');

    const sqmPlot = landFromForm(form({ landArea: '500', landAreaUnit: 'sqm' }))!;
    const sqmDual = landAreaDual(sqmPlot, 'en')!;
    expect(sqmDual.compact).toContain('500 m²');
    expect(sqmDual.compact).not.toContain('sq m');

    expect(landAreaSqm(undefined)).toBeNull();
    expect(landAreaSqm({ area: 0, areaUnit: 'aana' })).toBeNull();
    expect(landAreaDual(null)).toBeNull();

    expect(formatDualLength(30, 'ft', 'en')).toBe('9.14 m (30 ft)');
    expect(formatDualLength(10, 'm', 'en')).toBe('10 m (32.81 ft)');
    expect(formatDualLength(30, 'ft', 'ne')).toBe('९.१४ मिटर (३० फुट)');
    expect(formatDualLength(undefined, 'ft')).toBe('');
    expect(formatDualLength(0, 'm')).toBe('');

    const facts = landMeasurementFacts(fourAana, 'en');
    expect(facts.some(f => f.label === 'Land area')).toBe(false);
    expect(facts).toContainEqual({ label: 'Road width', value: '6.1 m (20 ft)' });
    expect(facts).toContainEqual({ label: 'Frontage', value: '9.14 m (30 ft)' });
    expect(facts).toContainEqual({ label: 'Land use', value: 'Residential' });
    expect(facts).toContainEqual({ label: 'Road access', value: 'Motorable road' });
    expect(facts).toContainEqual({ label: 'Facing', value: 'East' });

    const noRoad = landFromForm(form({ roadAccess: 'none' }))!;
    expect(landMeasurementFacts(noRoad, 'en').some(f => f.label === 'Road width')).toBe(false);
    expect(landMeasurementFacts(undefined)).toEqual([]);
  });
});
