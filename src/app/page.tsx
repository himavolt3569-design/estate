'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ArrowRight, Building2, Home as HomeIcon, LandPlot, MapPin, Search, ShieldCheck, Store, UserCheck, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Skeleton } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { ListingCard, money } from '@/components/merokotha/listing-card';
import { HeroHomeScene } from '@/components/merokotha/hero-home-scene';
import { SponsorCard, activeSponsors, type SponsorAd } from '@/components/merokotha/sponsor-card';
import { useSiteLanguage } from '@/components/merokotha/site-language';
import { SavedSearchPanel } from '@/components/merokotha/saved-search-panel';
import { useDocs } from '@/lib/firebase/hooks';
import type { Listing } from '@/lib/firebase/types';
import { emptySearch, listingCreatedAt, matchesSearch, searchFromUrl, type SearchFilters } from '@/lib/listing-search';
import { listingFeed } from '@/lib/listing-feed';

const MapView = dynamic(() => import('@/components/merokotha/map-view'), { ssr: false });
const propertyTypes = [
  { value: 'room', label: 'Rooms', ne: 'कोठा', note: 'A place of your own', icon: HomeIcon, color: 'bg-royal-50 text-royal-600' },
  { value: 'flat', label: 'Flats', ne: 'फ्ल्याट', note: 'Room to settle in', icon: Building2, color: 'bg-crimson-50 text-crimson-600' },
  { value: 'apartment', label: 'Apartments', ne: 'अपार्टमेन्ट', note: 'City living', icon: Warehouse, color: 'bg-emerald-50 text-emerald-600' },
  { value: 'house', label: 'Houses', ne: 'घर', note: 'Space for everyone', icon: HomeIcon, color: 'bg-marigold-50 text-marigold-700' },
  { value: 'office', label: 'Offices', ne: 'अफिस', note: 'A better workday', icon: Building2, color: 'bg-sand-100 text-sand-700' },
  { value: 'shop', label: 'Shops', ne: 'पसल', note: 'Find your storefront', icon: Store, color: 'bg-ink-100 text-ink-600' },
  { value: 'land', label: 'Land', ne: 'जग्गा', note: 'Room to build', icon: LandPlot, color: 'bg-royal-50 text-royal-700' },
] as const;

export default function Home() {
  const { ui, locale } = useSiteLanguage();
  const { items, error, loading } = useDocs<Listing>('listings', 'status', 'active');
  const { items: ads } = useDocs<SponsorAd>('ads');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [max, setMax] = useState('');
  const [min, setMin] = useState('');
  const [furnishing, setFurnishing] = useState('');
  const [facility, setFacility] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [showMap, setShowMap] = useState(false);
  const [nearby, setNearby] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(9);
  const filters: SearchFilters = { search, roomType: type, minRent: min, maxRent: max, furnishing, facility, verifiedOnly, nearby };

  useEffect(() => {
    const fromUrl = searchFromUrl(window.location.search);
    if (window.location.search) {
      setSearch(fromUrl.search); setType(fromUrl.roomType); setMin(fromUrl.minRent); setMax(fromUrl.maxRent);
      setFurnishing(fromUrl.furnishing); setFacility(fromUrl.facility); setVerifiedOnly(fromUrl.verifiedOnly); setNearby(fromUrl.nearby);
    }
  }, []);

  const filtered = useMemo(() => items.filter(item => matchesSearch(item, filters)).sort((a, b) => {
    if (sort === 'rent-low') return a.rentPerMonth - b.rentPerMonth;
    if (sort === 'rent-high') return b.rentPerMonth - a.rentPerMonth;
    if (sort === 'newest') return listingCreatedAt(b) - listingCreatedAt(a);
    return Number(b.verificationStatus === 'verified') - Number(a.verificationStatus === 'verified') || listingCreatedAt(b) - listingCreatedAt(a);
  }), [items, search, type, min, max, furnishing, facility, verifiedOnly, nearby, sort]);

  useEffect(() => setVisibleCount(9), [search, type, min, max, furnishing, facility, verifiedOnly, nearby, sort]);

  const featured = items.find(item => item.verificationStatus === 'verified') || items[0];
  const availableSponsor = (ad: SponsorAd) => ad.linkType !== 'listing' || items.some(item => item.id === ad.listingId);
  const landingSponsors = activeSponsors(ads, 'landing').filter(availableSponsor).slice(0, 2);
  const listingSponsors = activeSponsors(ads, 'listings').filter(availableSponsor).slice(0, 1);
  const inlineSponsor = listingSponsors[0] || landingSponsors[0] || null;
  const remainingLandingSponsors = landingSponsors.filter(ad => ad.id !== inlineSponsor?.id);
  const visibleListings = filtered.slice(0, visibleCount);
  const filtersActive = Boolean(search || type || min || max || furnishing || facility || verifiedOnly || nearby);
  const typeOptions = [
    { value: '', label: ui.anyType },
    ...propertyTypes.map(item => ({ value: item.value, label: locale === 'ne' ? item.ne : item.label })),
  ];
  const sortOptions = [
    { value: 'recommended', label: ui.sortRecommended },
    { value: 'newest', label: ui.sortNewest },
    { value: 'rent-low', label: ui.sortLow },
    { value: 'rent-high', label: ui.sortHigh },
  ];

  const jumpToListings = () => document.getElementById('rentals')?.scrollIntoView({ behavior: 'smooth' });
  const toggleNearby = () => {
    if (nearby) { setNearby(null); return; }
    navigator.geolocation.getCurrentPosition(
      position => setNearby({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => toast.error('Location is unavailable. Check your browser permission and try again.'),
    );
  };
  const applyFilters = (next: SearchFilters) => { setSearch(next.search); setType(next.roomType); setMin(next.minRent); setMax(next.maxRent); setFurnishing(next.furnishing); setFacility(next.facility); setVerifiedOnly(next.verifiedOnly); setNearby(next.nearby); jumpToListings(); };
  const clearFilters = () => applyFilters(emptySearch);

  return <>
    <section className="relative isolate flex flex-col items-center justify-center pb-8 pt-10 sm:pt-14 lg:min-h-[650px] lg:pb-28">
      <div className="absolute inset-0 z-0">
        <Image src="/images/hero-bg.png" alt="" fill priority sizes="100vw" className="object-cover brightness-[0.8]" />
        <div className="absolute inset-0 bg-gradient-to-r from-royal-950/95 via-royal-950/65 to-royal-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-royal-950/80 via-transparent to-royal-950/20" />
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-8xl items-center gap-2 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-5 lg:px-8">
        <div className="relative z-10 flex flex-col items-start">
          <h1 className={`max-w-2xl text-balance text-4xl font-bold tracking-tight text-white drop-shadow-md ${locale === 'ne' ? 'leading-[1.25] sm:text-5xl lg:text-[clamp(2.5rem,4vw,3.75rem)]' : 'sm:text-6xl lg:text-7xl'}`}>{ui.heroTitle}</h1>
          <p className="mt-5 max-w-xl text-base font-medium text-white drop-shadow-md sm:mt-6 sm:text-lg">{ui.heroIntro}</p>
          <Button asChild size="lg" className="mt-7 h-13 px-7 text-base font-semibold sm:mt-8 sm:h-14 sm:px-8 sm:text-lg"><Link href="#rentals">{ui.exploreListings} <ArrowRight aria-hidden className="ml-2 size-5" /></Link></Button>
        </div>
        <div className="relative mx-auto hidden w-full max-w-[520px] justify-center sm:my-0 sm:flex lg:translate-x-4"><HeroHomeScene /></div>
      </div>
      <form role="search" onSubmit={event => { event.preventDefault(); jumpToListings(); }} className="relative z-20 mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6 lg:absolute lg:-bottom-16 lg:mt-0 lg:px-8">
        <div className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-floating backdrop-blur-xl lg:p-6">
          <div className="mb-5 border-b border-ink-100 pb-2 text-sm font-semibold text-crimson-700">{ui.forRent}</div>
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-[2fr_1.25fr_1.25fr_1fr]">
            <label htmlFor="home-search" className="block text-sm font-medium text-ink-700">{ui.locationTitle}<div className="relative mt-1"><Input id="home-search" value={search} onChange={event => setSearch(event.target.value)} placeholder={ui.locationHint} className="pr-10" /><MapPin aria-hidden className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" /></div></label>
            <div><label htmlFor="home-property-type" className="block text-sm font-medium text-ink-700">{ui.propertyType}</label><SelectMenu id="home-property-type" value={type} onValueChange={setType} options={typeOptions} className="mt-1" /></div>
            <label htmlFor="home-max-rent" className="block text-sm font-medium text-ink-700">{ui.maxRent}<Input id="home-max-rent" value={max} onChange={event => setMax(event.target.value)} type="number" min="0" placeholder={ui.rentHint} className="mt-1" /></label>
            <Button type="submit" size="lg" className="h-12 w-full"><Search aria-hidden className="size-4" /> {ui.search}</Button>
          </div>
        </div>
      </form>
    </section>

    <section aria-labelledby="featured-heading" className="mx-auto hidden max-w-8xl px-4 pt-10 sm:block sm:px-6 lg:px-8 lg:pt-28">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="label text-crimson-700">{ui.featured}</p><h2 id="featured-heading" className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">{ui.featuredTitle}</h2></div><Link href="#rentals" className="inline-flex items-center gap-1 text-sm font-semibold text-royal-700 hover:underline">{ui.seeAll} <ArrowRight aria-hidden className="size-4" /></Link></div>
      {featured ? <Link href={`/listing/${featured.id}`} className="group grid overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-royal-700 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="relative aspect-[16/10] max-h-[300px] overflow-hidden bg-ink-100 md:aspect-auto md:min-h-[270px]">{featured.photoUrls?.[0] ? <img src={featured.photoUrls[0]} alt={featured.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-ink-500">{ui.noPhoto}</div>}</div>
        <div className="flex min-w-0 flex-col justify-center p-5 sm:p-8"><span className="text-xs font-semibold uppercase tracking-wide text-crimson-700">{featured.verificationStatus === 'verified' ? ui.verifiedListing : ui.featuredListing} · {featured.roomType || ui.propertyType}</span><h3 className="mt-3 text-xl font-semibold text-ink-900 sm:text-2xl">{featured.title}</h3><p className="mt-2 flex items-center gap-1.5 text-sm text-ink-600"><MapPin aria-hidden className="size-4 shrink-0" />{featured.address || ui.locationOnMap}</p><p className="mt-4 text-2xl font-bold text-royal-700">{money(featured.rentPerMonth)} <span className="text-sm font-normal text-ink-500">{ui.month}</span></p><span className="mt-5 inline-flex items-center gap-2 self-start text-sm font-semibold text-crimson-700">{ui.viewDetails} <ArrowRight aria-hidden className="size-4" /></span></div>
      </Link> : loading ? <Skeleton className="h-[260px] w-full rounded-2xl" /> : <div className="rounded-2xl border border-ink-100 bg-ink-50 p-8"><h3 className="text-lg font-semibold text-ink-900">{ui.featuredEmpty}</h3><p className="mt-2 text-sm text-ink-600">{ui.featuredEmptyText}</p><Link href="/dashboard?tab=post" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-royal-700 hover:underline">{ui.listPlace} <ArrowRight aria-hidden className="size-4" /></Link></div>}
    </section>

    {remainingLandingSponsors.length > 0 && <section aria-labelledby="landing-sponsors-heading" className="mx-auto hidden max-w-8xl px-4 pt-14 md:block sm:px-6 lg:px-8">
      <div className="mb-5"><p className="label text-sand-700">{ui.sponsorEyebrow}</p><h2 id="landing-sponsors-heading" className="mt-1 text-2xl font-semibold text-ink-900">{ui.sponsorTitle}</h2></div>
      <div className="grid gap-5 lg:grid-cols-2">{remainingLandingSponsors.map(ad => <SponsorCard key={ad.id} ad={ad} compact={remainingLandingSponsors.length > 1} />)}</div>
    </section>}

    <section id="rentals" aria-labelledby="listings-heading" className="mx-auto max-w-8xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="label text-crimson-700">{ui.listingsEyebrow}</p><h2 id="listings-heading" className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{ui.listingsTitle}</h2></div><Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard?tab=post">{ui.listPlace} <ArrowRight aria-hidden className="size-4" /></Link></Button></div>

      <div className="mb-5 grid gap-3 rounded-2xl border border-ink-100 bg-ink-50/70 px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-ink-800">{loading ? ui.loading : `${filtered.length} ${ui.found}`}</p>{filtersActive && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-crimson-700 underline underline-offset-2 hover:text-crimson-900">{ui.clearFilters}</button>}</div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center"><div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1 sm:w-52"><ArrowDownUp aria-hidden className="size-4 shrink-0 text-ink-500" /><SelectMenu value={sort} onValueChange={setSort} options={sortOptions} ariaLabel={ui.sortBy} className="h-10 min-w-0" /></div><Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setShowMap(!showMap)}>{showMap ? ui.showCards : ui.showMap}</Button><Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" onClick={toggleNearby}>{nearby ? ui.showAll : ui.nearby}</Button></div>
      </div>

      <details className="mb-5 rounded-xl border border-ink-100 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-royal-800">{ui.moreFilters}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium text-ink-700">{ui.minRent}<Input value={min} onChange={event => setMin(event.target.value)} type="number" min="0" placeholder={ui.rentHint} className="mt-1" /></label><div><label className="text-sm font-medium text-ink-700" htmlFor="filter-furnishing">{ui.furnishing}</label><SelectMenu id="filter-furnishing" value={furnishing} onValueChange={setFurnishing} options={[{value:'',label:ui.anyFurnishing},{value:'furnished',label:ui.furnished},{value:'semiFurnished',label:ui.semiFurnished},{value:'unfurnished',label:ui.unfurnished}]} className="mt-1" /></div><label className="text-sm font-medium text-ink-700">{ui.facilityContains}<Input value={facility} onChange={event => setFacility(event.target.value)} placeholder={ui.facilityHint} className="mt-1" /></label><label className="flex items-center gap-2 self-end rounded-lg border border-ink-100 px-3 py-3 text-sm font-medium"><input type="checkbox" checked={verifiedOnly} onChange={event => setVerifiedOnly(event.target.checked)} /> {ui.verifiedOnly}</label></div></details>
      <div className="mb-7"><SavedSearchPanel filters={filters} listings={items} listingsLoading={loading} listingsError={error} allowSave /></div>

      {error && <div role="alert" className="mb-5 rounded-xl border border-clay-200 bg-clay-50 px-4 py-3 text-sm text-clay-700">Could not load listings: {error}</div>}
      {loading ? <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3" aria-label={ui.loading}>{Array.from({ length: 6 }, (_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-ink-100 bg-white"><Skeleton className="listing-card-media rounded-none" /><div className="space-y-3 p-5"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-6 w-1/3" /></div></div>)}</div>
        : showMap ? <MapView listings={filtered} />
        : filtered.length ? <>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">{listingFeed(visibleListings, inlineSponsor).map(slot => slot.kind === 'sponsor' ? <SponsorCard key={`ad-${slot.ad.id}`} ad={slot.ad} tile /> : <ListingCard key={`listing-${slot.listing.id}`} listing={slot.listing} />)}</div>
          {visibleCount < filtered.length && <div className="mt-9 flex justify-center"><Button type="button" variant="secondary" size="lg" onClick={() => setVisibleCount(count => count + 9)}>{ui.showMore} <ArrowRight aria-hidden className="size-4" /></Button></div>}
        </> : !error && <div className="rounded-2xl border border-ink-100 bg-ink-50 p-10 text-center"><h3 className="text-lg font-semibold text-ink-900">{ui.noMatches}</h3><p className="mt-2 text-sm text-ink-500">{ui.tryAgain}</p>{filtersActive && <Button type="button" variant="secondary" className="mt-5" onClick={clearFilters}>{ui.clearFilters}</Button>}</div>}
      {inlineSponsor && (showMap || !filtered.length) && <section aria-label={ui.sponsorInListings} className="mt-8"><SponsorCard ad={inlineSponsor} compact /></section>}
    </section>

    <section id="trust" className="border-y border-ink-100 bg-ink-50/70"><div className="mx-auto grid max-w-8xl gap-5 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
      <div className="rounded-2xl border border-ink-100 bg-white p-6"><span className="flex size-11 items-center justify-center rounded-full bg-royal-50 text-royal-600"><ShieldCheck aria-hidden className="size-5" /></span><h3 className="mt-4 font-semibold text-ink-900">{ui.reviewed}</h3><p className="mt-2 text-sm text-ink-500">{ui.reviewedText}</p></div>
      <div className="rounded-2xl border border-ink-100 bg-white p-6"><span className="flex size-11 items-center justify-center rounded-full bg-royal-50 text-royal-600"><UserCheck aria-hidden className="size-5" /></span><h3 className="mt-4 font-semibold text-ink-900">{ui.agentChecks}</h3><p className="mt-2 text-sm text-ink-500">{ui.agentChecksText}</p><Link href="/agents" className="mt-4 inline-flex text-sm font-semibold text-royal-700 hover:underline">{ui.learnAgents} →</Link></div>
      <div className="rounded-2xl border border-ink-100 bg-white p-6"><span className="flex size-11 items-center justify-center rounded-full bg-royal-50 text-royal-600"><MapPin aria-hidden className="size-5" /></span><h3 className="mt-4 font-semibold text-ink-900">{ui.searchArea}</h3><p className="mt-2 text-sm text-ink-500">{ui.searchAreaText}</p></div>
    </div></section>

    <section id="types" className="bg-white"><div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8"><h2 className="text-3xl font-semibold tracking-tight text-ink-900">{ui.browseType}</h2><div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">{propertyTypes.map(item => <button key={item.value} type="button" onClick={() => { setType(item.value); jumpToListings(); }} className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"><span className={`flex size-14 items-center justify-center rounded-full ${item.color} transition-transform group-hover:scale-110`}><item.icon aria-hidden className="size-6" /></span><span><span className="block text-base font-bold text-ink-900 group-hover:text-crimson-700">{locale === 'ne' ? item.ne : item.label}</span>{locale === 'en' && <span className="mt-1 block text-xs font-medium text-ink-500">{item.note}</span>}</span></button>)}</div></div></section>
  </>;
}
