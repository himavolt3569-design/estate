'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ArrowRight, Bell, BookmarkPlus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton, Surface } from '@/components/ui/primitives';
import { db } from '@/lib/firebase/client';
import { useDocs } from '@/lib/firebase/hooks';
import type { Listing, SavedSearch } from '@/lib/firebase/types';
import { emptySearch, listingCreatedAt, matchesSearch, savedSearchFilters, savedSearchUrl, searchFilterLabels, timestampMillis, type SearchFilters } from '@/lib/listing-search';
import { useAuth } from './auth-provider';
import { useSignedInText } from './signed-in-copy';
import { SavedSearchForm } from './saved-search-form';
import { SavedSearchResults } from './saved-search-results';

type Props = {
  filters?: SearchFilters;
  listings?: Listing[];
  listingsLoading?: boolean;
  listingsError?: string;
  allowSave?: boolean;
  showResults?: boolean;
  activeSearchId?: string;
  landing?: boolean;
};

export function SavedSearchPanel({ filters = emptySearch, listings, listingsLoading = false, listingsError = '', allowSave = false, showResults = false, activeSearchId = '', landing = false }: Props) {
  const tr = useSignedInText();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const creator = useRef<HTMLDetailsElement>(null);
  const [formVersion, setFormVersion] = useState(0);
  const saved = useDocs<SavedSearch>(user ? `users/${user.uid}/savedSearches` : '');
  const rentals = useDocs<Listing>(user && !listings ? 'listings' : '', 'status', 'active');
  const available = listings ?? rentals.items;
  const loading = listings ? listingsLoading : rentals.loading;
  const error = listings ? listingsError : rentals.error;
  const searches = [...saved.items].sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt) || a.name.localeCompare(b.name));
  const active = searches.find(item => item.id === activeSearchId);

  const panelClassName = `overflow-hidden p-5 sm:p-6 ${landing ? 'border-royal-200 border-t-4 border-t-crimson-600 shadow-lg' : ''}`;
  const introduction = <div className="flex items-start gap-3">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-royal-50 text-royal-700"><Bell aria-hidden className="size-5" /></span>
    <div><h2 className={`font-semibold text-ink-900 ${landing ? 'text-xl sm:text-2xl' : 'text-lg'}`}>{tr('Saved searches & new matches')}</h2><p className="mt-1 max-w-xl text-sm text-ink-500">{tr(landing ? 'Save your area, budget and property type once. See matching rentals and what’s new each time you return.' : 'Live matches for your exact criteria. Open a search to explore its rentals.')}</p></div>
  </div>;

  if (!user) return landing ? <Surface className={panelClassName}>
    {introduction}
    {authLoading ? <div aria-label={tr('Loading saved searches…')} className="mt-5"><Skeleton className="h-12 w-full" /></div> : <div className="mt-5 rounded-xl bg-royal-50/60 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <p className="max-w-lg text-sm text-ink-600">{tr('Keep your searches in one place. New matches are highlighted when you return.')}</p>
      <Button asChild className="mt-4 h-auto min-h-11 w-full whitespace-normal py-3 text-center sm:mt-0 sm:w-auto sm:shrink-0"><Link href="/sign-in?next=%2F%23saved-searches"><BookmarkPlus aria-hidden className="size-4" />{tr('Sign in to save a search')}</Link></Button>
    </div>}
  </Surface> : allowSave ? <p className="text-sm text-ink-500">{tr('Sign in to save this search and see new matches here.')}</p> : null;

  const save = async (name: string, criteria: SearchFilters) => {
    if (busy || saved.loading || saved.error) return;
    const duplicate = searches.find(item => JSON.stringify(savedSearchFilters(item)).toLowerCase() === JSON.stringify(criteria).toLowerCase());
    if (duplicate) {
      toast(tr('You already saved this search.'), { action: { label: tr('View results'), onClick: () => router.push(savedSearchUrl(duplicate.id)) } });
      return;
    }
    setBusy(true);
    try {
      const item = await addDoc(collection(db(), 'users', user.uid, 'savedSearches'), {
        name, filters: criteria, criteriaVersion: 1,
        createdAt: serverTimestamp(), lastViewedAt: serverTimestamp(),
      });
      toast.success(tr('Search saved'));
      if (creator.current) creator.current.open = false;
      setFormVersion(value => value + 1);
      router.push(savedSearchUrl(item.id));
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : tr('Could not save search'));
    } finally { setBusy(false); }
  };

  const remove = async (item: SavedSearch) => {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      await deleteDoc(doc(db(), 'users', user.uid, 'savedSearches', item.id));
      if (activeSearchId === item.id) router.replace('/dashboard?tab=searches');
      toast.success(tr('Saved search deleted'));
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : tr('Could not delete search'));
    } finally { setDeletingId(''); }
  };

  return <div className="space-y-6">
    <Surface className={panelClassName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {introduction}
        {!showResults && <Link href="/dashboard?tab=searches" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-royal-700 hover:underline">{tr('Manage searches')} <ArrowRight aria-hidden className="size-4" /></Link>}
      </div>

      {allowSave && <details ref={creator} className="mt-5 rounded-xl border border-ink-200 bg-ink-50/40 p-4" open={(showResults || landing) && !saved.loading && !searches.length ? true : undefined}>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-royal-800"><BookmarkPlus aria-hidden className="size-4" />{tr('Create a saved search')}</summary>
        <div className="mt-4"><SavedSearchForm key={formVersion} initialFilters={filters} listings={available} loading={loading} error={error} busy={busy || saved.loading || Boolean(saved.error)} onSubmit={save} /></div>
      </details>}

      {saved.loading && <div aria-label={tr('Loading saved searches…')} className="mt-5 space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>}
      {saved.error && <p role="alert" className="mt-4 text-sm text-clay-700">{tr('Could not load saved searches')}: {saved.error}</p>}
      {!saved.loading && !saved.error && !searches.length && !(landing && allowSave) && <div className="mt-5 rounded-xl border border-dashed border-ink-200 p-5 text-center"><Search aria-hidden className="mx-auto size-6 text-ink-400" /><p className="mt-2 text-sm font-semibold">{tr('No saved searches yet.')}</p><p className="mt-1 text-sm text-ink-500">{tr('Save an area, budget, or property type to keep its matches in one place.')}</p></div>}
      {!saved.error && Boolean(searches.length) && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {searches.map(item => {
          const criteria = savedSearchFilters(item);
          const matches = available.filter(listing => matchesSearch(listing, criteria));
          const seenAt = timestampMillis(item.lastViewedAt) || timestampMillis(item.createdAt);
          const fresh = matches.filter(listing => listingCreatedAt(listing) > seenAt).length;
          const selected = showResults && activeSearchId === item.id;
          return <div key={item.id} data-saved-search={item.id} className={`relative flex rounded-xl border transition-colors ${selected ? 'border-royal-400 bg-royal-50/70 ring-1 ring-royal-200' : 'border-ink-200 bg-white hover:border-royal-300 hover:bg-royal-50/30'}`}>
            <Link href={savedSearchUrl(item.id)} aria-current={selected ? 'page' : undefined} className="min-w-0 flex-1 rounded-xl p-4 pr-2 focus-visible:outline-2 focus-visible:outline-royal-700">
              <span className="flex items-center gap-2 text-sm font-semibold text-royal-800"><span className="truncate">{item.name}</span><ArrowRight aria-hidden className="size-4 shrink-0" /></span>
              <span className="mt-2 block text-xs text-ink-500">{searchFilterLabels(criteria).map(tr).join(' · ')}</span>
              <span aria-live="polite" className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                {loading ? <span className="text-ink-500">{tr('Checking matches…')}</span> : error ? <span className="text-clay-700">{tr('Matches unavailable')}</span> : <><span className="rounded-md bg-ink-100 px-2 py-1 text-ink-700">{matches.length} {tr(matches.length === 1 ? 'match' : 'matches')}</span><span className={`rounded-md px-2 py-1 ${fresh ? 'bg-emerald-50 text-emerald-700' : 'text-ink-400'}`}>{fresh} {tr('new')}</span></>}
              </span>
            </Link>
            <button type="button" aria-label={`${tr('Delete saved search')}: ${item.name}`} disabled={Boolean(deletingId)} onClick={() => void remove(item)} className="m-2 flex size-11 shrink-0 items-center justify-center self-start rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-700 focus-visible:outline-2 focus-visible:outline-clay-700 disabled:opacity-50"><Trash2 aria-hidden className="size-4" /></button>
          </div>;
        })}
      </div>}
      {!loading && error && <p role="alert" className="mt-4 text-sm text-clay-700">{tr('Could not load matching rentals')}: {error}</p>}
    </Surface>

    {showResults && !saved.loading && !saved.error && (active ? <SavedSearchResults key={`${user.uid}:${active.id}`} search={active} uid={user.uid} listings={available} loading={loading} error={error} /> : <Surface id="saved-search-results" className="scroll-mt-24 p-8 text-center">
      <Search aria-hidden className="mx-auto size-8 text-royal-500" />
      <h2 className="mt-3 text-lg font-semibold">{tr(activeSearchId ? 'This saved search is unavailable.' : 'Your next place starts with a search')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{tr('Choose a saved search above to see only the rentals that match it, or create a new one.')}</p>
    </Surface>)}
  </div>;
}
