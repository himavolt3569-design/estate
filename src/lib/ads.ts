import { timestampMillis } from './listing-search';

export type AdPlacement = 'landing' | 'listings' | 'details';
export const detailAdSlots = [
  { value: 'title', label: 'Below the listing title', hint: 'Below the listing / property name breadcrumb, before the photos.' },
  { value: 'price', label: 'Below the property price', hint: 'In the main property details column.' },
  { value: 'recommendations', label: 'Above similar properties', hint: 'Immediately before “More places that fit”.' },
  { value: 'agent', label: 'Agent mini ad', hint: 'Beside the lister profile; visitors can dismiss it for this session.' },
] as const;
export type DetailAdSlot = typeof detailAdSlots[number]['value'];
export type AdDevice = 'all' | 'mobile' | 'desktop';
export type SponsorAd = {
  id: string;
  title?: string;
  subtitle?: string;
  sponsorName?: string;
  imageUrl?: string;
  imageUrls?: string[];
  mobileImageUrl?: string;
  placement?: string;
  detailSlots?: DetailAdSlot[];
  priority?: number;
  status?: string;
  linkType?: string;
  listingId?: string | null;
  externalUrl?: string | null;
  ctaLabel?: string;
  device?: AdDevice;
  startsAt?: unknown;
  endsAt?: unknown;
  [key: string]: unknown;
};

export type AdSettings = {
  enabled: boolean;
  partnerAdsEnabled: boolean;
  heroEnabled: boolean;
  feedEnabled: boolean;
  detailsEnabled: boolean;
  detailTitleEnabled: boolean;
  detailPriceEnabled: boolean;
  detailRecommendationsEnabled: boolean;
  detailAgentEnabled: boolean;
  feedInterval: number;
  rotationSeconds: number;
};

export const defaultAdSettings: AdSettings = {
  enabled: true, partnerAdsEnabled: true, heroEnabled: true, feedEnabled: true,
  detailsEnabled: true, detailTitleEnabled: true, detailPriceEnabled: true,
  detailRecommendationsEnabled: true, detailAgentEnabled: true, feedInterval: 4, rotationSeconds: 6,
};

export function normalizeAdSettings(value: Partial<AdSettings> = {}): AdSettings {
  const boolean = (key: keyof AdSettings) => typeof value[key] === 'boolean' ? value[key] as boolean : defaultAdSettings[key] as boolean;
  const bounded = (input: unknown, fallback: number, min: number, max: number) => typeof input === 'number' && Number.isFinite(input) ? Math.min(max, Math.max(min, Math.round(input))) : fallback;
  return {
    enabled: boolean('enabled'), partnerAdsEnabled: boolean('partnerAdsEnabled'),
    heroEnabled: boolean('heroEnabled'), feedEnabled: boolean('feedEnabled'), detailsEnabled: boolean('detailsEnabled'),
    detailTitleEnabled: boolean('detailTitleEnabled'), detailPriceEnabled: boolean('detailPriceEnabled'),
    detailRecommendationsEnabled: boolean('detailRecommendationsEnabled'), detailAgentEnabled: boolean('detailAgentEnabled'),
    feedInterval: bounded(value.feedInterval, 4, 3, 5), rotationSeconds: bounded(value.rotationSeconds, 6, 4, 15),
  };
}

export const detailSlotSettings = {
  title: 'detailTitleEnabled', price: 'detailPriceEnabled',
  recommendations: 'detailRecommendationsEnabled', agent: 'detailAgentEnabled',
} as const;

export function adsForDetailSlot(ads: SponsorAd[], slot: DetailAdSlot, settings: AdSettings, listingId?: string) {
  if (!settings.enabled || !settings.detailsEnabled || !settings[detailSlotSettings[slot]]) return [];
  return ads.filter(ad => (!Array.isArray(ad.detailSlots) || ad.detailSlots.includes(slot))
    && !(ad.linkType === 'listing' && ad.listingId === listingId));
}

export const partnerArtwork: Record<string, string> = {
  'partner-himavolt': '/images/partners/himavolt-generated-v1.webp',
  'partner-pitambari': '/images/partners/pitambari-generated-v1.webp',
  'partner-floor-cleaner': '/images/partners/floor-cleaner-generated-v1.webp',
};

export function adArtwork(ad: SponsorAd, imageIndex = 0): string | undefined {
  const images = ad.imageUrls?.length ? ad.imageUrls : ad.imageUrl ? [ad.imageUrl] : [];
  const image = images[imageIndex % Math.max(images.length, 1)];
  const legacyHimaVolt = ad.id === 'partner-himavolt' && image === '/images/partners/himavolt.png';
  return image && !legacyHimaVolt ? image : partnerArtwork[ad.id];
}

export const partnerAds: SponsorAd[] = [
  { id: 'partner-himavolt', sponsorName: 'HimaVolt', title: 'Find nearby. One search, one tap.', subtitle: 'Explore HimaVolt for your next local discovery.', imageUrl: partnerArtwork['partner-himavolt'], externalUrl: 'https://himavolt.com/', priority: 30 },
  { id: 'partner-pitambari', sponsorName: 'Pitambari', title: 'Discover Pitambari', subtitle: 'Explore the latest from our partner.', imageUrl: partnerArtwork['partner-pitambari'], externalUrl: 'https://pitambari.vercel.app/', priority: 20 },
  { id: 'partner-floor-cleaner', sponsorName: 'Floor Cleaner', title: 'A fresh start for your space', subtitle: 'Visit Floor Cleaner and explore the website.', imageUrl: partnerArtwork['partner-floor-cleaner'], externalUrl: 'https://floor-clearner.vercel.app/', priority: 10 },
].map(ad => ({ ...ad, status: 'active', placement: 'all', linkType: 'external', device: 'all', ctaLabel: 'Visit website' }));

export function campaignAds(stored: SponsorAd[], settings: AdSettings): SponsorAd[] {
  const custom = new Map(stored.map(ad => [ad.id, ad]));
  if (settings.partnerAdsEnabled) for (const ad of partnerAds) if (!custom.has(ad.id)) custom.set(ad.id, ad);
  return [...custom.values()];
}

export function sponsorHref(ad: SponsorAd): string | null {
  if (ad.linkType === 'listing' && ad.listingId) return `/listing/${encodeURIComponent(ad.listingId)}`;
  if (ad.linkType !== 'external' || !ad.externalUrl) return null;
  try {
    const url = new URL(ad.externalUrl);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function activeSponsors(ads: SponsorAd[], area: AdPlacement, device: AdDevice = 'all', now = Date.now()) {
  return ads.filter(ad => {
    const start = timestampMillis(ad.startsAt);
    const end = timestampMillis(ad.endsAt);
    const placement = ad.placement || 'all';
    return ad.status === 'active' && Boolean(ad.title?.trim()) && Boolean(sponsorHref(ad))
      && (placement === 'all' || placement === area || area === 'listings' && placement === 'home')
      && (!ad.device || ad.device === 'all' || device === ad.device)
      && (!start || start <= now) && (!end || end > now);
  }).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || a.id.localeCompare(b.id));
}

export function campaignState(ad: SponsorAd, now = Date.now()) {
  if (ad.status !== 'active') return 'Paused';
  if (!sponsorHref(ad)) return 'Needs a destination';
  if (timestampMillis(ad.startsAt) > now) return 'Scheduled';
  if (timestampMillis(ad.endsAt) && timestampMillis(ad.endsAt) <= now) return 'Ended';
  return 'Live';
}
