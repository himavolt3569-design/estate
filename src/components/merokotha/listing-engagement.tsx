'use client';

import { CalendarDays, Eye, Heart } from 'lucide-react';
import type { Listing } from '@/lib/firebase/types';
import { listingCreatedAt } from '@/lib/listing-search';
import { useSiteLanguage } from './site-language';

export function ListingEngagement({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  const { locale } = useSiteLanguage();
  const created = listingCreatedAt(listing);
  const date = created ? new Intl.DateTimeFormat(locale === 'ne' ? 'ne-NP' : 'en-NP', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' }).format(created) : null;
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value).toLocaleString(locale === 'ne' ? 'ne-NP' : 'en-NP') : '—';
  return <div className={`flex flex-wrap items-center ${compact ? 'gap-x-3 gap-y-2 text-[11px]' : 'gap-x-5 gap-y-3 text-sm'} text-ink-600`}>
    <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden className="size-3.5" />{date ? <time dateTime={new Date(created).toISOString()}>{compact ? date : `${locale === 'ne' ? 'पोस्ट गरिएको' : 'Added'} ${date}`}</time> : (locale === 'ne' ? 'मिति उपलब्ध छैन' : 'Date unavailable')}</span>
    <span className="inline-flex items-center gap-1.5 tabular-nums"><Eye aria-hidden className="size-3.5" />{number(listing.viewCount)} {locale === 'ne' ? 'हेराइ' : 'views'}</span>
    <span className="inline-flex items-center gap-1.5 tabular-nums"><Heart aria-hidden className="size-3.5" />{number(listing.saveCount)} {locale === 'ne' ? 'सेभ' : 'saves'}</span>
  </div>;
}
