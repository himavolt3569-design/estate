'use client';

import { useState } from 'react';
import { Input, Select } from '@/components/ui/primitives';
import type { Listing } from '@/lib/firebase/types';
import { isForSale, listingPrice } from '@/lib/listing-commerce';
import { landArea } from '@/lib/land';

export function SponsoredListingPicker({ listings, loading, error, value, onSelect }: { listings: Listing[]; loading: boolean; error: string; value: string; onSelect: (listing: Listing) => void }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [limit, setLimit] = useState(12);
  const matches = listings.filter(listing => (!type || listing.roomType === type) && (!purpose || (isForSale(listing) ? 'sale' : 'rent') === purpose) && [listing.title, listing.address, listing.id].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const selected = listings.find(listing => listing.id === value);
  return <fieldset className="min-w-0 space-y-3 rounded-xl bg-ink-50 p-4 sm:col-span-2">
    <legend className="px-1 font-semibold">Choose a property to sponsor</legend>
    <p className="text-sm leading-relaxed text-ink-600">Photos, title, price and location stay in sync with the listing. The ad stops showing when the property is no longer active.</p>
    <label htmlFor="sponsored-property-search" className="sr-only">Search active properties</label><Input id="sponsored-property-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(12); }} placeholder="Search by title, location or listing ID" />
    <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="sponsored-property-type" className="mb-1 block text-xs font-medium">Property type</label><Select id="sponsored-property-type" value={type} onChange={event => { setType(event.target.value); setLimit(12); }}><option value="">All types</option>{['flat', 'room', 'apartment', 'house', 'office', 'shop', 'land'].map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</Select></div><div><label htmlFor="sponsored-property-purpose" className="mb-1 block text-xs font-medium">Purpose</label><Select id="sponsored-property-purpose" value={purpose} onChange={event => { setPurpose(event.target.value); setLimit(12); }}><option value="">Rent & sale</option><option value="rent">For rent</option><option value="sale">For sale</option></Select></div></div>
    {error ? <p role="alert" className="text-sm text-clay-700">Properties could not be loaded. Reload to try again.</p> : loading ? <p role="status" className="text-sm text-ink-600">Loading active properties…</p> : <>
      <p role="status" className="text-xs text-ink-600">{matches.length} active {matches.length === 1 ? 'property' : 'properties'} found</p>
      <div className="max-h-80 space-y-2 overflow-y-auto p-1" role="group" aria-label="Active properties">
        {matches.slice(0, limit).map(listing => <label key={listing.id} className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg p-3 ${listing.id === value ? 'bg-royal-100' : 'bg-white hover:bg-royal-50'}`}>
          <input type="radio" name="sponsoredProperty" value={listing.id} checked={listing.id === value} onChange={() => onSelect(listing)} className="size-4 shrink-0 accent-royal-700" />
          {listing.photoUrls?.[0] && <img src={listing.photoUrls[0]} alt="" loading="lazy" className="h-14 w-16 shrink-0 rounded-md object-cover" />}
          <span className="min-w-0"><span className="block break-words text-sm font-semibold text-ink-900">{listing.title}</span><span className="mt-1 block text-xs text-ink-600">{isForSale(listing) ? 'For sale' : 'For rent'} · {listing.roomType} · Rs. {listingPrice(listing).toLocaleString('en-NP')}{isForSale(listing) ? '' : ' / month'}</span><span className="mt-1 block break-words text-xs text-ink-600">{[listing.address, listing.roomType === 'land' && landArea(listing.land)].filter(Boolean).join(' · ')}</span></span>
        </label>)}
        {!matches.length && <p className="py-5 text-sm text-ink-600">No properties match. Try another location or clear the filters.</p>}
      </div>
      {limit < matches.length && <button type="button" className="min-h-11 text-sm font-semibold text-royal-700 underline underline-offset-4" onClick={() => setLimit(current => current + 12)}>Show more properties</button>}
    </>}
    {selected ? <p className="break-words text-sm font-medium text-royal-800">Selected: {selected.title}</p> : value ? <p role="alert" className="text-sm text-clay-700">This property is no longer active. Choose another property before saving.</p> : <p className="text-sm text-ink-600">Select a property above to generate the ad.</p>}
  </fieldset>;
}
