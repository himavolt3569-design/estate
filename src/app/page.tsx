'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Home as HomeIcon, LayoutGrid, MapPin, ShieldCheck, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { ListingCard, money } from '@/components/merokotha/listing-card';
import { AdCarousel } from '@/components/merokotha/sponsor-card';
import { useCampaigns } from '@/components/merokotha/ad-provider';
import { LandingPromos } from '@/components/merokotha/landing-promos';
import { HomeMotion } from '@/components/merokotha/home-motion';
import { RentalFilters, propertyTypes } from '@/components/merokotha/rental-filters';
import { useSiteLanguage } from '@/components/merokotha/site-language';
import { SavedSearchPanel } from '@/components/merokotha/saved-search-panel';
import { useDocs } from '@/lib/firebase/hooks';
import type { Listing } from '@/lib/firebase/types';
import { emptySearch, listingCreatedAt, matchesSearch, searchFromUrl, type SearchFilters } from '@/lib/listing-search';
import { listingFeed } from '@/lib/listing-feed';
import { isForSale, listingPrice } from '@/lib/listing-commerce';
import type { MapArea } from '@/components/merokotha/map-view';

const MapView = dynamic(() => import('@/components/merokotha/map-view'), { ssr: false, loading: () => <Skeleton className="h-[340px] w-full rounded-xl" /> });

export default function Home() {
  const { ui, locale } = useSiteLanguage();
  const { items, error, loading } = useDocs<Listing>('listings', 'status', 'active');
  const { campaigns: landingAds, settings } = useCampaigns('landing');
  const { campaigns: feedAds } = useCampaigns('listings');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [transactionType, setTransactionType] = useState<'all' | 'rent' | 'sale'>('all');
  const [max, setMax] = useState('');
  const [min, setMin] = useState('');
  const [furnishing, setFurnishing] = useState('');
  const [facility, setFacility] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [showMap, setShowMap] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapArea | null>(null);
  const [area, setArea] = useState<MapArea | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [nearby, setNearby] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const filters: SearchFilters = { search, roomType: type, minRent: min, maxRent: max, furnishing, facility, verifiedOnly, nearby, transactionType };
  useEffect(() => {
    if (window.location.search) {
      const next = searchFromUrl(window.location.search);
      setSearch(next.search); setType(next.roomType); setMin(next.minRent); setMax(next.maxRent); setFurnishing(next.furnishing); setFacility(next.facility); setVerifiedOnly(next.verifiedOnly); setNearby(next.nearby); setTransactionType(next.transactionType || 'all');
    }
  }, []);
  const searched = useMemo(() => items.filter(item => matchesSearch(item, filters)).sort((a, b) => {
    if (sort === 'rent-low') return listingPrice(a) - listingPrice(b);
    if (sort === 'rent-high') return listingPrice(b) - listingPrice(a);
    if (sort === 'newest') return listingCreatedAt(b) - listingCreatedAt(a);
    return Number(b.verificationStatus === 'verified') - Number(a.verificationStatus === 'verified') || listingCreatedAt(b) - listingCreatedAt(a);
  }), [items, search, type, min, max, furnishing, facility, verifiedOnly, nearby, sort, transactionType]);
  const filtered = useMemo(() => searched.filter(item => !area || Boolean(item.geoPoint && item.geoPoint.latitude >= area.south && item.geoPoint.latitude <= area.north && item.geoPoint.longitude >= area.west && item.geoPoint.longitude <= area.east)), [searched, area]);
  useEffect(() => setVisibleCount(12), [search, type, min, max, furnishing, facility, verifiedOnly, nearby, sort, area, transactionType]);
  const availableAds = (ads: typeof landingAds) => ads.filter(ad => ad.linkType !== 'listing' || items.some(item => item.id === ad.listingId));
  const heroAds = availableAds(landingAds);
  const inlineAds = availableAds(feedAds);
  const visible = filtered.slice(0, visibleCount);
  const filtersActive = Boolean(search || type || min || max || furnishing || facility || verifiedOnly || nearby || area || transactionType !== 'all');
  const jump = () => document.getElementById('rentals')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  const changeFilters = (next: SearchFilters) => { setSearch(next.search); setType(next.roomType); setMin(next.minRent); setMax(next.maxRent); setFurnishing(next.furnishing); setFacility(next.facility); setVerifiedOnly(next.verifiedOnly); setNearby(next.nearby); setTransactionType(next.transactionType || 'all'); };
  const applyFilters = (next: SearchFilters) => { changeFilters(next); setArea(null); jump(); };
  const locate = () => {
    if (nearby) { setNearby(null); return; }
    if (!navigator.geolocation) { toast.error('Your browser does not support location. Search by address instead.'); return; }
    navigator.geolocation.getCurrentPosition(position => { setNearby({ lat: position.coords.latitude, lng: position.coords.longitude }); setArea(null); setShowMap(true); }, () => toast.error('Location is unavailable. Search by address or move the map.'), { timeout: 10000 });
  };
  const selected = filtered.find(item => item.id === selectedId);
  const mapPreviews = selected ? [selected, ...filtered.filter(item => item.id !== selected.id)].slice(0, 3) : filtered.slice(0, 3);
  return <>
    <HomeMotion />
    <section className="home-discovery" aria-labelledby="home-heading">
      <div className="home-discovery__intro"><div><h1 id="home-heading">{ui.heroTitle}</h1><p>{locale === 'ne' ? 'तपाईंको ठाउँ। तपाईंको बजेट। तपाईंको नयाँ सुरुवात।' : 'Your place. Your budget. Your next chapter.'}</p></div><Link href="#saved-searches" className="home-matches-link" onClick={() => { const panel = document.getElementById('saved-search-disclosure'); if (panel instanceof HTMLDetailsElement) panel.open = true; }}>{ui.seeMyMatches}<ArrowRight aria-hidden size={16} /></Link></div>
      {heroAds.length > 0 && <div className="home-partners home-partners--discovery"><LandingPromos ads={heroAds} interval={settings.rotationSeconds} /></div>}
      <div className="property-categories" role="group" aria-label={locale === 'ne' ? 'घरजग्गाका प्रकारहरू' : 'Property types'}>
        <button type="button" aria-pressed={!type} onClick={() => setType('')}><LayoutGrid aria-hidden /><span>{locale === 'ne' ? 'सबै' : 'All properties'}</span></button>
        {propertyTypes.map(item => <button key={item.value} type="button" aria-pressed={type === item.value} onClick={() => { setType(item.value); if (item.value === 'flat') { setTransactionType('rent'); setMin(''); setMax(''); } }}><item.icon aria-hidden /><span>{locale === 'ne' ? item.ne : item.label}</span></button>)}
      </div>
    </section>
    <section id="rentals" aria-label={locale === 'ne' ? 'उपलब्ध घरजग्गा' : 'Available properties'} className="home-listings">
      <RentalFilters filters={filters} onChange={changeFilters} onReset={() => { changeFilters(emptySearch); setArea(null); }} canReset={filtersActive} sort={sort} onSortChange={setSort} showMap={showMap} onToggleMap={() => setShowMap(value => !value)} onToggleNearby={locate} count={filtered.length} loading={loading} />
      {showMap && <section id="rental-map-filter" className="mb-7 space-y-4" aria-label="Filter rentals by map">

        {area && <button type="button" className="inline-flex min-h-10 items-center gap-2 text-sm text-royal-700 underline underline-offset-4" onClick={() => setArea(null)}><X aria-hidden className="size-4" />Clear map boundary</button>}
        <MapView listings={searched} selectedId={selectedId} onSelect={setSelectedId} onBoundsChange={setMapBounds} />

        <Button type="button" variant="royal" disabled={!mapBounds} onClick={() => { setArea(mapBounds); setSelectedId(undefined); }}>Search this area</Button>
        {!loading && searched.length > 0 && !searched.some(item => item.geoPoint) && <p className="text-sm text-ink-600">These rentals do not have map coordinates yet. Their details are available below.</p>}
        {mapPreviews.length > 0 && <div className="map-preview-rail" aria-label="Rentals on the map">{mapPreviews.map(item => <article key={item.id} className={`map-preview-card ${item.id === selectedId ? 'is-selected' : ''}`}><button type="button" className="map-preview-card__image" aria-label={`Show ${item.title} on map`} onClick={() => setSelectedId(item.id)}>{item.photoUrls?.[0] ? <img src={item.photoUrls[0]} alt={item.title} loading="lazy" /> : <HomeIcon aria-hidden className="m-auto size-8 text-ink-400" />}</button><div className="min-w-0 p-3"><Link href={`/listing/${item.id}`} className="line-clamp-1 text-sm font-semibold text-ink-900 hover:text-royal-700">{item.title}</Link><p className="mt-1 text-xs font-semibold text-royal-700">{money(listingPrice(item))} {isForSale(item) ? 'asking price' : ui.month}</p></div></article>)}</div>}
      </section>}
      {error && <div role="alert" className="mb-5 rounded-xl bg-clay-50 px-4 py-3 text-sm text-clay-700">Could not load listings. Refresh the page to try again.</div>}
      {loading ? <div className="rental-grid" aria-label={ui.loading}>{Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-ink-100"><Skeleton className="listing-card-media rounded-none" /><div className="space-y-3 p-5"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-6 w-1/3" /></div></div>)}</div> : filtered.length ? <><div className="rental-grid">{listingFeed(visible, inlineAds.length ? inlineAds : null, settings.feedInterval).map((slot, index) => slot.kind === 'sponsor' ? <div key={`campaign-${index}`} className="rental-grid__ad"><AdCarousel ads={slot.ad} placement="listings" compact interval={settings.rotationSeconds} /></div> : <ListingCard key={slot.listing.id} listing={slot.listing} />)}</div>{visibleCount < filtered.length && <div className="mt-8 flex justify-center"><Button type="button" variant="secondary" onClick={() => setVisibleCount(count => count + 12)}>{ui.showMore}<ArrowRight aria-hidden className="size-4" /></Button></div>}</> : !error && <div className="rounded-2xl bg-ink-50 px-5 py-12 text-center"><h3 className="text-lg font-semibold">{ui.noMatches}</h3><p className="mt-2 text-sm text-ink-600">{ui.tryAgain}</p>{filtersActive && <Button type="button" variant="secondary" className="mt-5" onClick={() => applyFilters(emptySearch)}>{ui.clearFilters}</Button>}</div>}
      {!filtered.length && inlineAds.length > 0 && <div className="mt-6"><AdCarousel ads={inlineAds} placement="listings" compact interval={settings.rotationSeconds} /></div>}
    </section>
    <section id="saved-searches" aria-label={ui.savedSearchesTitle} className="home-saved-searches"><details id="saved-search-disclosure" className="saved-search-disclosure"><summary>{ui.savedSearchesTitle}<span aria-hidden>+</span></summary><div className="pt-4"><SavedSearchPanel filters={filters} listings={items} listingsLoading={loading} listingsError={error} allowSave landing /></div></details></section>
    <section id="trust" className="border-t border-ink-100 bg-ink-50"><div className="mx-auto grid max-w-8xl gap-7 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">{[{ icon: ShieldCheck, title: ui.reviewed, text: ui.reviewedText }, { icon: UserCheck, title: ui.agentChecks, text: ui.agentChecksText }, { icon: MapPin, title: ui.searchArea, text: ui.searchAreaText }].map((item, index) => <div key={index}><item.icon aria-hidden className="size-6 text-royal-700" /><h3 className="mt-3 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-600">{item.text}</p></div>)}</div></section>
  </>;
}
