'use client';

import { useState } from 'react';
import { ArrowDownUp, BriefcaseBusiness, Building, Building2, DoorOpen, House, LandPlot, LocateFixed, Map, Search, ShieldCheck, SlidersHorizontal, Store, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import type { SearchFilters } from '@/lib/listing-search';
import { useSiteLanguage } from './site-language';

export const propertyTypes = [
  { value: 'house', label: 'Houses', ne: 'घर', icon: House },
  { value: 'apartment', label: 'Apartments', ne: 'अपार्टमेन्ट', icon: Building2 },
  { value: 'flat', label: 'Flats', ne: 'फ्ल्याट', icon: Building },
  { value: 'room', label: 'Rooms', ne: 'कोठा', icon: DoorOpen },
  { value: 'office', label: 'Offices', ne: 'अफिस', icon: BriefcaseBusiness },
  { value: 'shop', label: 'Shops', ne: 'पसल', icon: Store },
  { value: 'land', label: 'Land', ne: 'जग्गा', icon: LandPlot },
];

type Props = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
  canReset: boolean;
  sort: string;
  onSortChange: (value: string) => void;
  showMap: boolean;
  onToggleMap: () => void;
  onToggleNearby: () => void;
  count: number;
  loading: boolean;
};

export function RentalFilters({ filters, onChange, onReset, canReset, sort, onSortChange, showMap, onToggleMap, onToggleNearby, count, loading }: Props) {
  const { locale, ui } = useSiteLanguage();
  const ne = locale === 'ne';
  const [expanded, setExpanded] = useState(false);
  const change = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch });
  const rentalBudget = filters.transactionType === 'rent';
  const invalidBudget = Boolean(filters.minRent && filters.maxRent && Number(filters.minRent) > Number(filters.maxRent));
  const extraCount = [filters.minRent, filters.maxRent, filters.furnishing, filters.facility.trim(), filters.verifiedOnly, filters.nearby].filter(Boolean).length;
  const furnishingOptions = [{ value: '', label: ui.anyFurnishing }, { value: 'furnished', label: ui.furnished }, { value: 'semiFurnished', label: ui.semiFurnished }, { value: 'unfurnished', label: ui.unfurnished }];
  const price = (value: string) => `Rs. ${Number(value).toLocaleString(ne ? 'ne-NP' : 'en-NP')}`;
  const chips = [
    ...(filters.minRent ? [{ key: 'min', label: `${ne ? 'न्यूनतम' : 'Min'}: ${price(filters.minRent)}`, remove: () => change({ minRent: '' }) }] : []),
    ...(filters.maxRent ? [{ key: 'max', label: `${ne ? 'अधिकतम' : 'Max'}: ${price(filters.maxRent)}`, remove: () => change({ maxRent: '' }) }] : []),
    ...(filters.furnishing ? [{ key: 'furnishing', label: furnishingOptions.find(item => item.value === filters.furnishing)?.label || filters.furnishing, remove: () => change({ furnishing: '' }) }] : []),
    ...(filters.facility.trim() ? [{ key: 'facility', label: filters.facility.trim(), remove: () => change({ facility: '' }) }] : []),
    ...(filters.verifiedOnly ? [{ key: 'verified', label: ui.verifiedOnly, remove: () => change({ verifiedOnly: false }) }] : []),
    ...(filters.nearby ? [{ key: 'nearby', label: ui.nearby, remove: () => change({ nearby: null }) }] : []),
  ];

  return <>
    <section className="rental-filters discovery-filters" aria-label={ne ? 'घरजग्गा फिल्टर' : 'Property filters'}>
      <div className="discovery-searchbar">
        <div className="discovery-purpose" role="group" aria-label={ne ? 'भाडा वा खरिद' : 'Rent or buy'}>
          {([{ value: 'all', label: ne ? 'सबै' : 'All' }, { value: 'rent', label: ne ? 'भाडा' : 'Rent' }, ...(filters.roomType === 'flat' ? [] : [{ value: 'sale', label: ne ? 'खरिद' : 'Buy' }])] as const).map(option => <button key={option.value} type="button" aria-pressed={(filters.transactionType || 'all') === option.value} onClick={() => change({ transactionType: option.value as 'all' | 'rent' | 'sale', minRent: '', maxRent: '' })}>{option.label}</button>)}
        </div>
        <div className="discovery-location"><Search aria-hidden size={18} /><label htmlFor="filter-location" className="sr-only">{ui.locationTitle}</label><input id="filter-location" type="search" value={filters.search} onChange={event => change({ search: event.target.value })} placeholder={ne ? 'ठाउँ वा घरजग्गा खोज्नुहोस्' : 'Search a place or property…'} />{filters.search && <button type="button" aria-label={ne ? 'खोज खाली गर्नुहोस्' : 'Clear search'} onClick={() => change({ search: '' })}><X aria-hidden size={16} /></button>}</div>
        <button type="button" className="discovery-filter-toggle" aria-expanded={expanded} aria-controls="property-filter-options" onClick={() => setExpanded(value => !value)}><SlidersHorizontal aria-hidden size={17} /><span>{ne ? 'फिल्टर' : 'Filters'}</span>{extraCount > 0 && <span className="discovery-filter-count">{extraCount}</span>}</button>
      </div>
      {expanded && <div id="property-filter-options" className="discovery-filter-options">
        <div className="discovery-filter-options__heading"><h3>{ne ? 'खोज परिमार्जन गर्नुहोस्' : 'Refine your search'}</h3><button type="button" aria-label={ne ? 'फिल्टर बन्द गर्नुहोस्' : 'Close filters'} onClick={() => setExpanded(false)}><X size={18} aria-hidden /></button></div>
        <div className="discovery-filter-fields">
          <div><label htmlFor="filter-min-price">{ne ? 'न्यूनतम रकम' : rentalBudget ? 'Minimum rent' : 'Minimum price'}</label><Input id="filter-min-price" type="number" min="0" inputMode="numeric" value={filters.minRent} onChange={event => change({ minRent: event.target.value })} placeholder="Rs. 0" /></div>
          <div><label htmlFor="filter-max-price">{ne ? 'अधिकतम रकम' : rentalBudget ? 'Maximum rent' : 'Maximum price'}</label><Input id="filter-max-price" type="number" min="0" inputMode="numeric" value={filters.maxRent} onChange={event => change({ maxRent: event.target.value })} placeholder={ne ? 'सीमा छैन' : 'No limit'} aria-invalid={invalidBudget || undefined} aria-describedby={invalidBudget ? 'filter-budget-error' : undefined} /></div>
          <div><label htmlFor="filter-furnishing">{ui.furnishing}</label><SelectMenu id="filter-furnishing" value={filters.furnishing} onValueChange={value => change({ furnishing: value })} options={furnishingOptions} /></div>
          <div><label htmlFor="filter-facility">{ui.facilityContains}</label><Input id="filter-facility" value={filters.facility} onChange={event => change({ facility: event.target.value })} placeholder={ui.facilityHint} /></div>
        </div>
        {invalidBudget && <p id="filter-budget-error" className="rental-filters__error" role="alert">{ne ? 'न्यूनतम रकम अधिकतम रकमभन्दा बढी हुन सक्दैन।' : 'The minimum amount must not exceed the maximum.'}</p>}
        <div className="discovery-filter-options__actions"><label className="rental-filters__verified"><input type="checkbox" checked={filters.verifiedOnly} onChange={event => change({ verifiedOnly: event.target.checked })} /><ShieldCheck aria-hidden size={16} />{ui.verifiedOnly}</label><button type="button" className="discovery-nearby" onClick={onToggleNearby} aria-pressed={Boolean(filters.nearby)}><LocateFixed aria-hidden size={16} />{filters.nearby ? ne ? 'नजिकको फिल्टर हटाउनुहोस्' : 'Clear nearby' : ui.nearby}</button><button type="button" className="discovery-reset" disabled={!canReset} onClick={onReset}>{ui.clearFilters}</button><Button type="button" variant="royal" disabled={invalidBudget} onClick={() => setExpanded(false)}>{ne ? 'नतिजा हेर्नुहोस्' : 'Show results'}</Button></div>
      </div>}
      {chips.length > 0 && <div className="rental-filter-chips discovery-chips" aria-label={ne ? 'लागू गरिएका फिल्टरहरू' : 'Active filters'}>{chips.map(chip => <button key={chip.key} type="button" onClick={chip.remove} aria-label={`${ne ? 'फिल्टर हटाउनुहोस्' : 'Remove filter'}: ${chip.label}`}><span>{chip.label}</span><X aria-hidden size={13} /></button>)}</div>}
    </section>
    <div className="discovery-results-toolbar"><p role="status" aria-live="polite">{loading ? ui.loading : <><strong>{count}</strong> {ne ? 'घरजग्गा भेटिए' : 'properties found'}</>}</p><div><button type="button" className="discovery-map-toggle" aria-expanded={showMap} aria-controls="rental-map-filter" onClick={onToggleMap}><Map aria-hidden size={16} /><span>{showMap ? ne ? 'नक्सा बन्द' : 'Hide map' : ne ? 'नक्सा' : 'Map'}</span></button><ArrowDownUp aria-hidden size={14} className="discovery-sort-icon" /><SelectMenu id="filter-sort" value={sort} onValueChange={onSortChange} ariaLabel={ui.sortBy} className="discovery-sort" options={[{ value: 'recommended', label: ui.sortRecommended }, { value: 'newest', label: ui.sortNewest }, { value: 'rent-low', label: ne ? 'मूल्य: कमदेखि धेरै' : 'Price: low to high' }, { value: 'rent-high', label: ne ? 'मूल्य: धेरैदेखि कम' : 'Price: high to low' }]} /></div></div>
  </>;
}
