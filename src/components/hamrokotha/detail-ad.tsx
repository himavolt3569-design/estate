'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { adsForDetailSlot, type DetailAdSlot } from '@/lib/ads';
import { useCampaigns } from './ad-provider';
import { AdCarousel, SponsorCard } from './sponsor-card';
import { useSiteLanguage } from './site-language';

export function DetailAd({ slot, listingId, dismissKey }: { slot: DetailAdSlot; listingId?: string; dismissKey?: string }) {
  const { campaigns, settings } = useCampaigns('details');
  const { locale } = useSiteLanguage();
  const [dismissed, setDismissed] = useState(false);
  const mini = slot === 'agent';
  const storageKey = `mk-mini-ad-dismissed:${dismissKey || listingId || 'agent'}`;
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(storageKey) === '1'); } catch { setDismissed(false); }
  }, [storageKey]);
  const ads = adsForDetailSlot(campaigns, slot, settings, listingId);
  if (!ads.length || mini && dismissed) return null;
  const ordered = ads;
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(storageKey, '1'); } catch { /* Dismiss even when storage is unavailable. */ }
  };
  return <div className={`detail-ad detail-ad--${slot}`} data-ad-slot={slot}>
    {mini ? <>
      <div className="detail-ad__mini-toolbar"><span>{locale === 'ne' ? 'विज्ञापन' : 'Advertisement'}</span><button type="button" onClick={dismiss} aria-label={locale === 'ne' ? 'विज्ञापन बन्द गर्नुहोस्' : 'Close advertisement'}><X aria-hidden className="size-4" /></button></div>
      <SponsorCard key={ordered[0]!.id} ad={ordered[0]!} placement="details" compact />
    </> : <AdCarousel key={ordered.map(ad => ad.id).join(':')} ads={ordered} placement="details" compact interval={settings.rotationSeconds} />}
  </div>;
}
