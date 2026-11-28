'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { activeSponsors, campaignAds, defaultAdSettings, normalizeAdSettings, type AdPlacement, type AdSettings, type SponsorAd } from '@/lib/ads';
import { configured, db } from '@/lib/firebase/client';
import { useDocs } from '@/lib/firebase/hooks';
import type { Listing } from '@/lib/firebase/types';
import { resolveListingCampaigns } from '@/lib/sponsored-listings';

const AdContext = createContext({ ads: [] as SponsorAd[], resolvedAds: [] as SponsorAd[], settings: defaultAdSettings, loading: true, error: '', now: 0, mobile: false });

export function AdProvider({ children }: { children: React.ReactNode }) {
  const { items, loading, error } = useDocs<SponsorAd>('ads');
  const [settings, setSettings] = useState<AdSettings>(defaultAdSettings);
  const [settingsError, setSettingsError] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(configured);
  const [now, setNow] = useState(0);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const resize = () => setMobile(media.matches);
    resize(); media.addEventListener('change', resize); setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => { window.clearInterval(timer); media.removeEventListener('change', resize); };
  }, []);
  useEffect(() => {
    if (!configured) return;
    return onSnapshot(doc(db(), 'adSettings', 'public'), snapshot => {
      setSettings(normalizeAdSettings(snapshot.data())); setSettingsError(''); setSettingsLoading(false);
    }, () => { setSettingsError('Ad settings could not be loaded. Check the Firebase campaign rules.'); setSettingsLoading(false); });
  }, []);
  const storedAds = useMemo(() => campaignAds(items, settings), [items, settings]);
  const { items: listings } = useDocs<Listing>(storedAds.some(ad => ad.linkType === 'listing') ? 'listings' : '', 'status', 'active');
  const ads = useMemo(() => resolveListingCampaigns(storedAds, listings), [storedAds, listings]);
  // Admins retain unavailable campaigns so they can pause, retarget or repair them.
  return <AdContext.Provider value={{ ads: storedAds, resolvedAds: ads, settings, loading: loading || settingsLoading, error: error || settingsError, now, mobile }}>{children}</AdContext.Provider>;
}

export function useCampaigns(area: AdPlacement) {
  const context = useContext(AdContext);
  // A denied settings read must not suppress public campaigns and bundled partners.
  // Defaults apply until settings load; a previously loaded off switch stays off.
  const enabled = !context.loading && context.settings.enabled && (area === 'landing' ? context.settings.heroEnabled : area === 'listings' ? context.settings.feedEnabled : context.settings.detailsEnabled);
  const ads = useMemo(() => enabled && context.now ? activeSponsors(context.resolvedAds, area, context.mobile ? 'mobile' : 'desktop', context.now) : [], [context.resolvedAds, area, context.mobile, context.now, enabled]);
  return { ...context, campaigns: ads };
}

const recorded = new Set<string>();
let sessionId = '';
export async function recordAdEvent(adId: string, type: 'impression' | 'click', placement: AdPlacement) {
  if (!configured || typeof window === 'undefined') return;
  try {
    if (!sessionId) {
      sessionId = sessionStorage.getItem('mk_ad_session') || crypto.randomUUID();
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(sessionId)) sessionId = crypto.randomUUID();
      sessionStorage.setItem('mk_ad_session', sessionId);
    }
    const key = `${adId}_${placement}_${type}_${sessionId}_${Math.floor(Date.now() / 1800000)}`;
    if (recorded.has(key) || sessionStorage.getItem(key)) return;
    recorded.add(key);
    await setDoc(doc(db(), 'adEvents', key), { adId, type, placement, device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop', createdAt: serverTimestamp() });
    sessionStorage.setItem(key, '1');
  } catch { /* Telemetry never blocks browsing or navigation. */ }
}
