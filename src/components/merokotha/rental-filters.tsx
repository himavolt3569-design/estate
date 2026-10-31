'use client';

import { ArrowDownUp, Building2, ChevronDown, Home, LandPlot, Map, MapPin, RotateCcw, Search, ShieldCheck, Store, Warehouse, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import type { SearchFilters } from '@/lib/listing-search';
import { useSiteLanguage } from './site-language';

export const propertyTypes = [
  { value: 'room', label: 'Rooms', ne: 'कोठा', icon: Home },
  { value: 'flat', label: 'Flats', ne: 'फ्ल्याट', icon: Building2 },
  { value: 'apartment', label: 'Apartments', ne: 'अपार्टमेन्ट', icon: Warehouse },
  { value: 'house', label: 'Houses', ne: 'घर', icon: Home },
  { value: 'office', label: 'Offices', ne: 'अफिस', icon: Building2 },
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
  const change = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch });
  const rentalBudget = filters.transactionType === 'rent';
  const invalidBudget = Boolean(filters.minRent && filters.maxRent && Number(filters.minRent) > Number(filters.maxRent));
  const preferences = Number(Boolean(filters.furnishing)) + Number(Boolean(filters.facility.trim())) + Number(filters.verifiedOnly);
  const furnishingOptions = [{ value: '', label: ui.anyFurnishing }, { value: 'furnished', label: ui.furnished }, { value: 'semiFurnished', label: ui.semiFurnished }, { value: 'unfurnished', label: ui.unfurnished }];
  const selectedType = propertyTypes.find(item => item.value === filters.roomType);
  const price = (value: string) => `Rs. ${Number(value).toLocaleString(ne ? 'ne-NP' : 'en-NP')}`;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.search.trim() ? [{ key: 'location', label: filters.search.trim(), remove: () => change({ search: '' }) }] : []),
    ...(selectedType ? [{ key: 'type', label: ne ? selectedType.ne : selectedType.label, remove: () => change({ roomType: '' }) }] : []),
    ...(filters.minRent ? [{ key: 'minimum', label: `${ne ? 'न्यूनतम' : 'Min'}: ${price(filters.minRent)}`, remove: () => change({ minRent: '' }) }] : []),
    ...(filters.maxRent ? [{ key: 'maximum', label: `${ne ? 'अधिकतम' : 'Max'}: ${price(filters.maxRent)}`, remove: () => change({ maxRent: '' }) }] : []),
    ...(filters.furnishing ? [{ key: 'furnishing', label: furnishingOptions.find(item => item.value === filters.furnishing)?.label || filters.furnishing, remove: () => change({ furnishing: '' }) }] : []),
    ...(filters.facility.trim() ? [{ key: 'facility', label: filters.facility.trim(), remove: () => change({ facility: '' }) }] : []),
    ...(filters.verifiedOnly ? [{ key: 'verification', label: ui.verifiedOnly, remove: () => change({ verifiedOnly: false }) }] : []),
  ];

  return <>
    <section className="rental-filters" aria-labelledby="rental-filters-title">
      <div className="rental-filters__heading">
        <div><h3 id="rental-filters-title">{ne ? 'घरजग्गा फिल्टर गर्नुहोस्' : 'Filter properties'}</h3><p>{ne ? 'फिल्टर परिवर्तन गर्दा नतिजा आफैँ अपडेट हुन्छ।' : 'Results update as you refine your search.'}</p></div>
        <button type="button" className="rental-filters__reset" disabled={!canReset} onClick={onReset}><RotateCcw aria-hidden className="size-3.5" />{ui.clearFilters}</button>
      </div>
      <fieldset className="rental-filters__purpose">
        <legend>{ne ? 'म चाहन्छु' : 'I want to'}</legend>
        <div className="rental-purpose-control" aria-label="Rent or buy">
          {([{ value: 'all', label: ne ? 'सबै हेर्नुहोस्' : 'View all' }, { value: 'rent', label: ne ? 'भाडामा लिनुहोस्' : 'Rent' }, ...(filters.roomType === 'flat' ? [] : [{ value: 'sale', label: ne ? 'किन्नुहोस्' : 'Buy' }])] as const).map(option => <button key={option.value} type="button" aria-pressed={filters.transactionType === option.value} onClick={() => change({ transactionType: option.value as 'all' | 'rent' | 'sale', minRent: '', maxRent: '' })}>{option.label}</button>)}
        </div>
      </fieldset>
      <div className="rental-filters__fields">
        <div className="rental-filters__location"><label htmlFor="filter-location">{ui.locationTitle}</label><div className="relative"><Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" /><Input id="filter-location" value={filters.search} onChange={event => change({ search: event.target.value })} placeholder={ui.locationHint} className="pl-9" /></div></div>
        <div className="rental-filters__type"><label htmlFor="filter-property-type">{ui.propertyType}</label><SelectMenu id="filter-property-type" value={filters.roomType} onValueChange={value => change({ roomType: value, ...(value === 'flat' ? { transactionType: 'rent', minRent: '', maxRent: '' } : {}) })} options={[{ value: '', label: ne ? 'सबै प्रकार' : 'All property types' }, ...propertyTypes.map(item => ({ value: item.value, label: ne ? item.ne : item.label }))]} /></div>
        <div><label htmlFor="filter-min-price">{ne ? rentalBudget ? 'न्यूनतम भाडा' : 'न्यूनतम मूल्य' : rentalBudget ? 'Minimum rent' : 'Minimum price'}</label><Input id="filter-min-price" type="number" min="0" inputMode="numeric" value={filters.minRent} onChange={event => change({ minRent: event.target.value })} placeholder="Rs. 0" /></div>
        <div><label htmlFor="filter-max-price">{ne ? rentalBudget ? 'अधिकतम भाडा' : 'अधिकतम मूल्य' : rentalBudget ? 'Maximum rent' : 'Maximum price'}</label><Input id="filter-max-price" type="number" min="0" inputMode="numeric" value={filters.maxRent} onChange={event => change({ maxRent: event.target.value })} placeholder={ne ? 'सीमा छैन' : 'No limit'} aria-invalid={invalidBudget || undefined} aria-describedby={invalidBudget ? 'filter-budget-error' : undefined} /></div>
      </div>
      {invalidBudget && <p id="filter-budget-error" className="rental-filters__error" role="alert">{ne ? 'न्यूनतम रकम अधिकतम रकमभन्दा बढी हुन सक्दैन।' : 'The minimum amount must not exceed the maximum.'}</p>}
      <details className="rental-preferences">
        <summary><span>{ne ? 'घरजग्गाका प्राथमिकताहरू' : 'Property preferences'}{preferences > 0 && <span className="rental-preferences__count">{preferences} {ne ? 'छानिएका' : 'selected'}</span>}</span><ChevronDown aria-hidden className="size-4" /></summary>
        <div className="rental-preferences__fields">
          <div><label htmlFor="filter-furnishing">{ui.furnishing}</label><SelectMenu id="filter-furnishing" value={filters.furnishing} onValueChange={value => change({ furnishing: value })} options={furnishingOptions} /></div>
          <div><label htmlFor="filter-facility">{ui.facilityContains}</label><Input id="filter-facility" value={filters.facility} onChange={event => change({ facility: event.target.value })} placeholder={ui.facilityHint} /></div>
          <label className="rental-filters__verified"><input type="checkbox" checked={filters.verifiedOnly} onChange={event => change({ verifiedOnly: event.target.checked })} /><ShieldCheck aria-hidden className="size-4" />{ui.verifiedOnly}</label>
        </div>
      </details>
      {chips.length > 0 && <div className="rental-filter-chips" aria-label={ne ? 'लागू गरिएका फिल्टरहरू' : 'Active filters'}>{chips.map(chip => <button key={chip.key} type="button" onClick={chip.remove} aria-label={`${ne ? 'फिल्टर हटाउनुहोस्' : 'Remove filter'}: ${chip.label}`}><span>{chip.label}</span><X aria-hidden className="size-3.5 shrink-0" /></button>)}</div>}
    </section>
    <div className="rental-results-toolbar">
      <div className="rental-results-toolbar__map">
        <Button type="button" variant={showMap ? 'royal' : 'secondary'} onClick={onToggleMap} aria-expanded={showMap} aria-controls="rental-map-filter"><Map aria-hidden className="size-4" />{ne ? 'नक्सा फिल्टर' : 'Map filter'}</Button>
        <Button type="button" variant={filters.nearby ? 'royal' : 'secondary'} onClick={onToggleNearby} aria-pressed={Boolean(filters.nearby)}><MapPin aria-hidden className="size-4" />{filters.nearby ? ne ? 'नजिकको फिल्टर हटाउनुहोस्' : 'Clear nearby' : ui.nearby}</Button>
      </div>
      <div className="rental-results-toolbar__sort"><label htmlFor="filter-sort"><ArrowDownUp aria-hidden className="size-4" /><span>{ne ? 'क्रम मिलाउनुहोस्' : 'Sort by'}</span></label><SelectMenu id="filter-sort" value={sort} onValueChange={onSortChange} ariaLabel={ui.sortBy} options={[{ value: 'recommended', label: ui.sortRecommended }, { value: 'newest', label: ui.sortNewest }, { value: 'rent-low', label: ne ? 'मूल्य: कमदेखि धेरै' : 'Price: low to high' }, { value: 'rent-high', label: ne ? 'मूल्य: धेरैदेखि कम' : 'Price: high to low' }]} /></div>
      <p className="rental-results-toolbar__count" role="status" aria-live="polite">{loading ? ui.loading : `${count} ${ui.found}`}</p>
    </div>
  </>;
}
