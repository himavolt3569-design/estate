'use client';

import { useEffect, useId, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/primitives';
import type { Listing } from '@/lib/firebase/types';
import { matchesSearch, searchFilterLabels, type SearchFilters } from '@/lib/listing-search';
import { LAND_USES, ROAD_ACCESS, landLabel } from '@/lib/land';
import { useSiteLanguage } from './site-language';
import { useSignedInText } from './signed-in-copy';

export function SavedSearchForm({ initialFilters, initialName = '', listings, loading, error, busy, onSubmit, onCancel }: {
  initialFilters: SearchFilters;
  initialName?: string;
  listings: Listing[];
  loading: boolean;
  error: string;
  busy: boolean;
  onSubmit: (name: string, filters: SearchFilters) => Promise<void>;
  onCancel?: () => void;
}) {
  const tr = useSignedInText();
  const { locale } = useSiteLanguage();
  const id = useId();
  const [keyword, setKeyword] = useState(initialFilters.search);
  const [name, setName] = useState(initialName);
  const [criteria, setCriteria] = useState({ ...initialFilters, furnishing: initialFilters.roomType === 'land' ? '' : initialFilters.furnishing });
  const { search, roomType, minRent, maxRent, furnishing, facility, verifiedOnly, nearby, transactionType, landUse, roadAccess } = initialFilters;
  useEffect(() => {
    setKeyword(search);
    setCriteria({ search, roomType, minRent, maxRent, furnishing: roomType === 'land' ? '' : furnishing, facility, verifiedOnly, nearby, transactionType, landUse: landUse || '', roadAccess: roadAccess || '' });
  }, [search, roomType, minRent, maxRent, furnishing, facility, verifiedOnly, nearby, transactionType, landUse, roadAccess]);
  const next = { ...criteria, furnishing: criteria.roomType === 'land' ? '' : criteria.furnishing, search: keyword.trim(), facility: criteria.facility.trim() };
  const invalidBudget = Boolean(next.minRent && next.maxRent && Number(next.minRent) > Number(next.maxRent));
  const count = listings.filter(listing => matchesSearch(listing, next)).length;

  return <form onSubmit={event => {
    event.preventDefault();
    if (busy || invalidBudget) return;
    const label = name.trim() || next.search || searchFilterLabels(next).map(tr).join(' · ');
    void onSubmit(label.slice(0, 80), next);
  }} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-keyword`} className="text-sm font-medium text-ink-700">{tr('Location or keyword')}<Input id={`${id}-keyword`} placeholder={tr('e.g. Kapan, sunny flat, or Bhaktapur')} value={keyword} maxLength={160} onChange={event => setKeyword(event.target.value)} className="mt-1" /></label>
      <label htmlFor={`${id}-name`} className="text-sm font-medium text-ink-700">{tr('Search name (optional)')}<Input id={`${id}-name`} placeholder={tr('e.g. My next home')} value={name} maxLength={80} onChange={event => setName(event.target.value)} className="mt-1" /></label>
    </div>
    <details className="rounded-lg border border-ink-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium text-royal-700">{tr('Refine search criteria')}</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">{tr('Rent or buy')}<Select value={criteria.transactionType || 'all'} onChange={event => setCriteria({ ...criteria, transactionType: event.target.value as 'all' | 'rent' | 'sale' })} className="mt-1"><option value="all">{tr('All properties')}</option><option value="rent">{tr('Rent')}</option><option value="sale">{tr('Buy')}</option></Select></label><label className="text-sm font-medium">{tr('Property type')}<Select value={criteria.roomType} onChange={event => setCriteria({ ...criteria, roomType: event.target.value, furnishing: event.target.value === 'land' ? '' : criteria.furnishing, landUse: event.target.value === 'land' ? criteria.landUse || '' : '', roadAccess: event.target.value === 'land' ? criteria.roadAccess || '' : '' })} className="mt-1"><option value="">{tr('Any type')}</option>{['room', 'flat', 'apartment', 'house', 'office', 'shop', 'land'].map(type => <option key={type} value={type}>{tr(type)}</option>)}</Select></label>
        <label className="text-sm font-medium">{tr(criteria.transactionType === 'rent' ? 'Minimum rent (Rs.)' : 'Minimum price (Rs.)')}<Input type="number" min="0" value={criteria.minRent} onChange={event => setCriteria({ ...criteria, minRent: event.target.value })} className="mt-1" /></label>
        <label className="text-sm font-medium">{tr(criteria.transactionType === 'rent' ? 'Maximum rent (Rs.)' : 'Maximum price (Rs.)')}<Input type="number" min="0" value={criteria.maxRent} onChange={event => setCriteria({ ...criteria, maxRent: event.target.value })} className="mt-1" /></label>
        {criteria.roomType === 'land' ? <><label className="text-sm font-medium">{locale === 'ne' ? '\u091c\u0917\u094d\u0917\u093e\u0915\u094b \u092a\u094d\u0930\u092f\u094b\u0917' : 'Land use'}<Select aria-label={locale === 'ne' ? '\u091c\u0917\u094d\u0917\u093e\u0915\u094b \u092a\u094d\u0930\u092f\u094b\u0917' : 'Land use'} value={criteria.landUse || ''} onChange={event => setCriteria({ ...criteria, landUse: event.target.value })} className="mt-1"><option value="">{tr('Any use')}</option>{LAND_USES.map(value => <option key={value} value={value}>{landLabel(value, locale)}</option>)}</Select></label><label className="text-sm font-medium">{locale === 'ne' ? '\u092c\u093e\u091f\u094b\u0915\u094b \u092a\u0939\u0941\u0901\u091a' : 'Road access'}<Select aria-label={locale === 'ne' ? '\u092c\u093e\u091f\u094b\u0915\u094b \u092a\u0939\u0941\u0901\u091a' : 'Road access'} value={criteria.roadAccess || ''} onChange={event => setCriteria({ ...criteria, roadAccess: event.target.value })} className="mt-1"><option value="">{tr('Any access')}</option>{ROAD_ACCESS.map(value => <option key={value} value={value}>{landLabel(value, locale)}</option>)}</Select></label></> : <label className="text-sm font-medium">{tr('Furnishing')}<Select value={criteria.furnishing} onChange={event => setCriteria({ ...criteria, furnishing: event.target.value })} className="mt-1"><option value="">{tr('Any furnishing')}</option><option value="furnished">{tr('furnished')}</option><option value="semiFurnished">{tr('Semi furnished')}</option><option value="unfurnished">{tr('unfurnished')}</option></Select></label>}
        <label className="text-sm font-medium">{tr('Facility keyword')}<Input value={criteria.facility} maxLength={80} placeholder={tr('e.g. Parking')} onChange={event => setCriteria({ ...criteria, facility: event.target.value })} className="mt-1" /></label>
        <label className="flex items-center gap-2 self-end py-3 text-sm font-medium"><input type="checkbox" checked={criteria.verifiedOnly} onChange={event => setCriteria({ ...criteria, verifiedOnly: event.target.checked })} />{tr('Verified only')}</label>
        {criteria.nearby && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked onChange={() => setCriteria({ ...criteria, nearby: null })} />{tr('Within 10 km')}</label>}
      </div>
    </details>
    <div className="flex flex-wrap gap-2" aria-label={tr('Search criteria')}>{searchFilterLabels(next).map(label => <span key={label} className="rounded-md border border-royal-100 bg-royal-50 px-2.5 py-1 text-xs text-royal-800">{tr(label)}</span>)}</div>
    {invalidBudget && <p role="alert" className="text-sm text-clay-700">{tr('Maximum rent must be at least the minimum rent.')}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className="text-xs text-ink-500">{loading ? tr('Checking matches…') : error ? tr('Matches unavailable') : `${count} ${tr(count === 1 ? 'match right now' : 'matches right now')}`}</p>
      <div className="flex flex-wrap gap-2">{onCancel && <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{tr('Cancel')}</Button>}<Button type="submit" disabled={busy || invalidBudget}><BookmarkPlus aria-hidden className="size-4" />{tr(busy ? 'Saving…' : onCancel ? 'Save changes' : 'Save search')}</Button></div>
    </div>
  </form>;
}
