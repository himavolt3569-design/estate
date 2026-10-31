'use client';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import type { Listing } from '@/lib/firebase/types';
import { listingPrice, isForSale } from '@/lib/listing-commerce';
import { money } from './listing-card';
import { useSiteLanguage } from './site-language';

export function FeaturedListing({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  const { ui } = useSiteLanguage();
  const item = listings.find(listing => listing.verificationStatus === 'verified') || listings[0];
  if (!item) return null;
  return <section className="mx-auto hidden max-w-8xl px-6 pt-8 md:block lg:px-8" aria-labelledby="featured-heading"><div className="mb-4 flex items-center justify-between"><h2 id="featured-heading" className="text-xl font-semibold">{ui.featuredTitle}</h2><Link href="#rentals" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-royal-700">{ui.seeAll}<ArrowRight aria-hidden className="size-4" /></Link></div><Link href={`/listing/${item.id}`} className="grid overflow-hidden rounded-xl border border-ink-100 bg-white md:grid-cols-[240px_minmax(0,1fr)]"><div className="h-40 bg-ink-100">{item.photoUrls?.[0] && <img src={item.photoUrls[0]} alt={item.title} className="h-full w-full object-cover" loading={loading ? 'eager' : 'lazy'} />}</div><div className="flex min-w-0 flex-col justify-center p-5"><h3 className="text-lg font-semibold">{item.title}</h3><p className="mt-2 flex items-center gap-1 text-sm text-ink-600"><MapPin aria-hidden className="size-4" />{item.address || ui.locationOnMap}</p><p className="mt-3 font-semibold text-royal-700">{money(listingPrice(item))} <span className="text-xs font-normal">{isForSale(item) ? 'asking price' : ui.month}</span></p></div></Link></section>;
}
