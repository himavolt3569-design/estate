import { describe, expect, it } from 'vitest';
import { activeSponsors, campaignAds, defaultAdSettings, normalizeAdSettings, partnerAds, sponsorHref } from './ads';

describe('campaign eligibility', () => {
  const now = Date.UTC(2026, 9, 30);
  const ad = { ...partnerAds[0]!, id: 'campaign', startsAt: new Date(now - 1000), endsAt: new Date(now + 1000) };
  it('enforces placement, device, status and inclusive-start/exclusive-end schedule', () => {
    expect(activeSponsors([ad], 'details', 'mobile', now)).toHaveLength(1);
    expect(activeSponsors([{ ...ad, placement: 'landing' }], 'details', 'mobile', now)).toHaveLength(0);
    expect(activeSponsors([{ ...ad, placement: 'home' }], 'listings', 'mobile', now)).toHaveLength(1);
    expect(activeSponsors([{ ...ad, device: 'desktop' }], 'landing', 'mobile', now)).toHaveLength(0);
    expect(activeSponsors([{ ...ad, status: 'paused' }], 'landing', 'mobile', now)).toHaveLength(0);
    expect(activeSponsors([{ ...ad, startsAt: new Date(now) }], 'landing', 'mobile', now)).toHaveLength(1);
    expect(activeSponsors([{ ...ad, endsAt: new Date(now) }], 'landing', 'mobile', now)).toHaveLength(0);
  });
  it('does not resurrect paused partner campaigns or enabled defaults after their switch is off', () => {
    const paused = { ...partnerAds[0]!, status: 'paused' };
    const merged = campaignAds([paused], defaultAdSettings);
    expect(merged.filter(ad => ad.id === paused.id)).toEqual([paused]);
    expect(campaignAds([], { ...defaultAdSettings, partnerAdsEnabled: false })).toEqual([]);
    expect(partnerAds[1]?.externalUrl).toBe('https://pitambari-vercel.app/');
  });
  it('rejects unsafe or ambiguous destination URLs and encodes listing IDs', () => {
    for (const externalUrl of ['javascript:alert(1)', '//example.com', 'https://user:secret@example.com', 'not a URL']) expect(sponsorHref({ id: 'x', linkType: 'external', externalUrl })).toBeNull();
    expect(sponsorHref({ id: 'x', linkType: 'listing', listingId: 'id/a?b' })).toBe('/listing/id%2Fa%3Fb');
  });
  it('normalizes malformed settings instead of allowing empty or extreme feed intervals', () => {
    expect(normalizeAdSettings({ feedInterval: 100, rotationSeconds: -1 })).toMatchObject({ feedInterval: 5, rotationSeconds: 4 });
    expect(normalizeAdSettings({ feedInterval: NaN }).feedInterval).toBe(4);
    expect(normalizeAdSettings({ enabled: false }).enabled).toBe(false);
  });
});
