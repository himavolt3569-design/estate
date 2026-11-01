import type { Listing } from './firebase/types';
import type { SponsorAd } from './ads';
import { sponsorHref } from './ads';
import { isForSale, listingPrice } from './listing-commerce';
import { landArea } from './land';

/** Listing campaigns follow the property's current photos, price and availability. */
export function listingCampaign(ad: SponsorAd, listing: Listing): SponsorAd {
  const price = `Rs. ${listingPrice(listing).toLocaleString('en-NP')}${isForSale(listing) ? ' total asking price' : ' / month'}`;
  return { ...ad, title: listing.title, subtitle: [price, listing.address, listing.roomType === 'land' ? landArea(listing.land) : ''].filter(Boolean).join(' · '), sponsorName: `${isForSale(listing) ? 'For sale' : 'For rent'} · ${listing.roomType}`, imageUrl: listing.photoUrls?.[0] || '', imageUrls: listing.photoUrls?.slice(0, 1) || [], mobileImageUrl: '', ctaLabel: 'View property' };
}

export function resolveListingCampaigns(ads: SponsorAd[], listings: Listing[]) {
  const byId = new Map(listings.map(listing => [listing.id, listing]));
  return ads.flatMap(ad => {
    if (ad.linkType !== 'listing') return [ad];
    const listing = byId.get(ad.listingId || '');
    return listing?.status === 'active' ? [listingCampaign(ad, listing)] : [];
  });
}

/** One destination within each placement, even with duplicate campaign records. */
export function uniqueCampaigns(ads: SponsorAd[]) {
  const seen = new Set<string>();
  return ads.filter(ad => {
    const href = sponsorHref(ad);
    if (!href || seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}
