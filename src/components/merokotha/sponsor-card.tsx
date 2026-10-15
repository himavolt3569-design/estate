'use client';

import { ArrowUpRight } from 'lucide-react';
import type { RecordDoc } from '@/lib/firebase/types';
import { useSiteLanguage } from './site-language';

export type SponsorAd = RecordDoc & {
  title?: string;
  subtitle?: string;
  sponsorName?: string;
  imageUrl?: string;
  placement?: string;
  priority?: number;
  status?: string;
  linkType?: string;
  listingId?: string;
  externalUrl?: string;
};

export function sponsorHref(ad: SponsorAd): string | null {
  if (ad.linkType === 'listing' && ad.listingId) return `/listing/${encodeURIComponent(ad.listingId)}`;
  if (ad.linkType === 'external' && ad.externalUrl && /^https?:\/\//i.test(ad.externalUrl)) return ad.externalUrl;
  return null;
}

export function activeSponsors(ads: SponsorAd[], area: 'landing' | 'listings') {
  return ads.filter(ad =>
    ad.status === 'active' && Boolean(ad.imageUrl) && Boolean(ad.title) && Boolean(sponsorHref(ad)) &&
    (ad.placement === 'all' || (area === 'landing' ? ad.placement === 'landing' : ad.placement === 'home' || ad.placement === 'listings')),
  ).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
}

export function SponsorCard({ ad, compact = false, tile = false }: { ad: SponsorAd; compact?: boolean; tile?: boolean }) {
  const { ui } = useSiteLanguage();
  const href = sponsorHref(ad);
  if (!href) return null;
  const external = ad.linkType === 'external';
  return <a
    href={href}
    target={external ? '_blank' : undefined}
    rel={external ? 'sponsored noopener noreferrer' : undefined}
    className={`group min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-sand-50/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-royal-700 ${tile ? 'flex h-full flex-col' : `grid ${compact ? 'sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'}`}`}
  >
    <div className={`overflow-hidden bg-sand-100 ${tile ? 'sponsor-card-media' : compact ? 'aspect-[16/9] sm:aspect-auto sm:min-h-44' : 'aspect-[16/9] md:aspect-auto md:min-h-56'}`}>
      <img src={ad.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
    </div>
    <div className={`flex min-w-0 flex-col justify-center ${tile ? 'flex-1 p-4 sm:p-5' : compact ? 'p-5' : 'p-6 sm:p-8'}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-sand-700">{ui.sponsorEyebrow}{ad.sponsorName ? ` · ${ad.sponsorName}` : ''}</span>
      <h3 className={`mt-3 font-semibold leading-tight text-ink-900 ${tile || compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}>{ad.title}</h3>
      {ad.subtitle && <p className={`mt-2 text-sm leading-relaxed text-ink-600 ${tile ? 'line-clamp-2' : 'line-clamp-3'}`}>{ad.subtitle}</p>}
      <span className={`inline-flex items-center gap-1 self-start text-sm font-semibold text-royal-700 group-hover:underline ${tile ? 'mt-auto pt-4' : 'mt-5'}`}>{external ? ui.visitSponsor : ui.viewDetails} <ArrowUpRight aria-hidden className="size-4" /></span>
    </div>
  </a>;
}
