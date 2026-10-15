'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowRight, Pencil, Search, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, Skeleton, Surface } from '@/components/ui/primitives';
import { db } from '@/lib/firebase/client';
import type { Listing, SavedSearch } from '@/lib/firebase/types';
import { listingCreatedAt, matchesSearch, savedSearchFilters, searchFilterLabels, searchUrl, timestampMillis } from '@/lib/listing-search';
import { ListingCard } from './listing-card';
import { SavedSearchForm } from './saved-search-form';
import { useSignedInText } from './signed-in-copy';

export function SavedSearchResults({ search, uid, listings, loading, error }: { search: SavedSearch; uid: string; listings: Listing[]; loading: boolean; error: string }) {
  const tr = useSignedInText();
  const section = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);
  const [seenAt] = useState(() => timestampMillis(search.lastViewedAt) || timestampMillis(search.createdAt));
  const [newOnly, setNewOnly] = useState(false);
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(9);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const criteria = savedSearchFilters(search);
  const matches = listings.filter(listing => matchesSearch(listing, criteria));
  const fresh = matches.filter(listing => listingCreatedAt(listing) > seenAt);
  const results = (newOnly ? fresh : matches).sort((a, b) => {
    if (sort === 'rent-low') return a.rentPerMonth - b.rentPerMonth;
    if (sort === 'rent-high') return b.rentPerMonth - a.rentPerMonth;
    return listingCreatedAt(b) - listingCreatedAt(a) || a.id.localeCompare(b.id);
  });
  const signature = JSON.stringify(criteria);
  useEffect(() => { setLimit(9); setNewOnly(false); }, [signature]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (loading || error || viewed.current) return;
    viewed.current = true;
    void updateDoc(doc(db(), 'users', uid, 'savedSearches', search.id), { lastViewedAt: serverTimestamp() }).catch(() => {
      toast.error(tr('Could not mark search as viewed'));
    });
  }, [loading, error, search.id, uid, tr]);

  return <div ref={section} id="saved-search-results" tabIndex={-1} aria-labelledby="saved-search-results-title" className="scroll-mt-24 focus-visible:outline-2 focus-visible:outline-royal-500"><Surface className="p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><p className="label text-crimson-700">{tr('Your search results')}</p><h2 id="saved-search-results-title" className="mt-2 break-words text-2xl font-semibold text-ink-900 sm:text-3xl">{search.name}</h2><p className="mt-2 text-sm text-ink-500">{tr('Only active rentals matching every saved criterion appear here.')}</p></div>
      <Button type="button" variant="secondary" onClick={() => setEditing(!editing)} aria-expanded={editing}><Pencil aria-hidden className="size-4" />{tr(editing ? 'Cancel' : 'Edit search')}</Button>
    </div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label={tr('Search criteria')}>{searchFilterLabels(criteria).map(label => <span key={label} className="rounded-md border border-royal-100 bg-royal-50 px-3 py-1.5 text-xs font-medium text-royal-800">{tr(label)}</span>)}</div>
    {editing && <div className="mt-5 rounded-xl border border-ink-200 bg-ink-50/40 p-4"><SavedSearchForm key={signature} initialFilters={criteria} initialName={search.name} listings={listings} loading={loading} error={error} busy={saving} onCancel={() => setEditing(false)} onSubmit={async (name, filters) => {
      if (saving) return;
      setSaving(true);
      try {
        await updateDoc(doc(db(), 'users', uid, 'savedSearches', search.id), { name, filters, criteriaVersion: 1 });
        setEditing(false);
        toast.success(tr('Search updated'));
      } catch (failure) { toast.error(failure instanceof Error ? failure.message : tr('Could not save search')); }
      finally { setSaving(false); }
    }} /></div>}
    <div className="my-6 flex flex-wrap items-center justify-between gap-4 border-y border-ink-100 py-4">
      <div className="flex flex-wrap items-center gap-2" aria-label={tr('Filter results')}>
        <Button type="button" size="sm" variant={newOnly ? 'secondary' : 'royal'} aria-pressed={!newOnly} disabled={loading || Boolean(error)} onClick={() => { setNewOnly(false); setLimit(9); }}>{tr('All matches')}{!loading && !error ? ` (${matches.length})` : ''}</Button>
        <Button type="button" size="sm" variant={newOnly ? 'royal' : 'secondary'} aria-pressed={newOnly} disabled={loading || Boolean(error)} onClick={() => { setNewOnly(true); setLimit(9); }}>{tr('New since last visit')}{!loading && !error ? ` (${fresh.length})` : ''}</Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-500"><SlidersHorizontal aria-hidden className="size-4 shrink-0" /><span className="sr-only">{tr('Sort matching rentals')}</span><Select aria-label={tr('Sort matching rentals')} value={sort} onChange={event => { setSort(event.target.value); setLimit(9); }} className="h-10 w-44"><option value="newest">{tr('Newest first')}</option><option value="rent-low">{tr('Lowest rent first')}</option><option value="rent-high">{tr('Highest rent first')}</option></Select></label>
    </div>
    {error ? <p role="alert" className="rounded-xl bg-clay-50 p-4 text-sm text-clay-700">{tr('Could not load matching rentals')}: {error}</p> : loading ? <div aria-label={tr('Loading matching rentals…')} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-72" />)}</div> : results.length ? <>
      <p role="status" className="mb-4 text-sm text-ink-500">{results.length} {tr(results.length === 1 ? 'matching rental' : 'matching rentals')}</p>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" data-search-results>{results.slice(0, limit).map(listing => <div key={listing.id} className="relative">{listingCreatedAt(listing) > seenAt && <span className="pointer-events-none absolute left-3 top-12 z-30 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">{tr('New since last visit')}</span>}<ListingCard listing={listing} /></div>)}</div>
      {limit < results.length && <div className="mt-6 text-center"><Button type="button" variant="secondary" onClick={() => setLimit(value => value + 9)}>{tr('Show more matches')} <ArrowRight aria-hidden className="size-4" /></Button></div>}
    </> : <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-5 py-10 text-center">
      <Search aria-hidden className="mx-auto size-8 text-ink-400" />
      <h3 className="mt-3 text-lg font-semibold">{tr(newOnly ? 'You’re up to date' : 'No matching rentals yet')}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{tr(newOnly ? 'There are no new rentals since your last visit. You can still browse all matches.' : 'This search is saved. Matching rentals will appear here as they become available. Try adjusting the area or budget to broaden it.')}</p>
      <Button type="button" variant="secondary" className="mt-5" onClick={() => newOnly ? setNewOnly(false) : setEditing(true)}>{tr(newOnly ? 'See all matches' : 'Adjust criteria')}</Button>
    </div>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4"><p className="text-xs text-ink-500">{tr('Matches update while MeroKotha is open.')}</p><Link href={searchUrl(criteria)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-royal-700 hover:underline">{tr('Explore this search')} <ArrowRight aria-hidden className="size-4" /></Link></div>
  </Surface></div>;
}
