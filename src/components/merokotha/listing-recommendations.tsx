'use client';

import { useMemo } from 'react';
import { recommendListings } from '@/lib/recommendations';
import { useDocs } from '@/lib/firebase/hooks';
import type { Listing } from '@/lib/firebase/types';
import { ListingCard } from './listing-card';
import { isForSale } from '@/lib/listing-commerce';
import { useSiteLanguage } from './site-language';

export function ListingRecommendations({ listing }: { listing: Listing }) {
  const { locale } = useSiteLanguage();
  const { items, loading, error } = useDocs<Listing>('listings', 'status', 'active');
  const matches = useMemo(() => recommendListings(listing, items), [listing, items]);
  if (!matches.length && !loading) return null;
  return <section className="mt-14 border-t border-ink-100 pt-10" aria-labelledby="recommendations-title">
    <h2 id="recommendations-title" className="text-2xl font-semibold tracking-tight">{locale === 'ne' ? 'तपाईंका लागि मिल्दाजुल्दा घरहरू' : 'More places that fit'}</h2>
    <p className="mt-2 max-w-2xl text-sm text-ink-600">{locale === 'ne' ? 'स्थान, भाडा र सुविधाका आधारमा छानिएका विकल्पहरू।' : (isForSale(listing) ? 'Selected by location, asking price and shared property features.' : 'Selected by location, monthly rent and shared property features.')}</p>
    {loading ? <p className="mt-5 text-sm text-ink-500">Finding similar rentals…</p> : error ? <p className="mt-5 text-sm text-ink-600">Similar rentals are temporarily unavailable.</p> : <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{matches.map(match => <div key={match.listing.id} className="recommendation-tile"><p className="mb-2 text-xs font-medium text-royal-700">{match.reasons.join(' · ')}</p><ListingCard listing={match.listing} /></div>)}</div>}
  </section>;
}
