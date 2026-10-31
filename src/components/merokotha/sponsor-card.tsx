'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { sponsorHref, type AdPlacement, type SponsorAd } from '@/lib/ads';
import { recordAdEvent } from './ad-provider';

export { activeSponsors, sponsorHref, type SponsorAd } from '@/lib/ads';

export function SponsorCard({ ad, compact = false, tile = false, banner = false, placement = 'landing', imageIndex = 0, track = true, mobilePreview = false }: { ad: SponsorAd; compact?: boolean; tile?: boolean; banner?: boolean; placement?: AdPlacement; imageIndex?: number; track?: boolean; mobilePreview?: boolean }) {
  const element = useRef<HTMLAnchorElement>(null);
  const href = sponsorHref(ad);
  useEffect(() => {
    if (!element.current || !href || !track) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(entries => {
      clearTimeout(timer);
      if (entries[0]?.isIntersecting) timer = setTimeout(() => { void recordAdEvent(ad.id, 'impression', placement); observer.disconnect(); }, 1000);
    }, { threshold: 0.5 });
    observer.observe(element.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [ad.id, href, placement, track]);
  if (!href) return null;
  const images = ad.imageUrls?.length ? ad.imageUrls : ad.imageUrl ? [ad.imageUrl] : [];
  const image = images[imageIndex % Math.max(images.length, 1)];
  const external = ad.linkType === 'external';
  const brand = ad.id.includes('pitambari') ? 'pitambari' : ad.id.includes('floor-cleaner') ? 'cleaner' : 'default';
  return <a ref={element} href={href} target={external ? '_blank' : undefined} rel={external ? 'sponsored noopener noreferrer' : 'sponsored'}
    onClick={() => { if (track) void recordAdEvent(ad.id, 'click', placement); }}
    className={`sponsor-panel sponsor-panel--${brand} ${compact ? 'sponsor-panel--compact' : ''} ${tile ? 'sponsor-panel--tile' : ''} ${banner ? 'sponsor-panel--banner' : ''} ${mobilePreview ? 'sponsor-panel--mobile-preview' : ''}`}>
    {image && <picture className="sponsor-panel__art">{ad.mobileImageUrl && <source media="(max-width: 767px)" srcSet={ad.mobileImageUrl} />}<img src={image} alt="" loading={placement === 'landing' ? 'eager' : 'lazy'} /></picture>}
    <div className="sponsor-panel__copy">
      <span className="sponsor-panel__disclosure">Advertisement{ad.sponsorName ? ` · ${ad.sponsorName}` : ''}</span>
      <h3>{ad.title}</h3>
      {ad.subtitle && <p>{ad.subtitle}</p>}
      <span className="sponsor-panel__cta">{ad.ctaLabel || (external ? 'Visit website' : 'View rental')} <ArrowUpRight aria-hidden className="size-4" /></span>
    </div>
  </a>;
}

export function AdCarousel({ ads, placement, compact = false, banner = false, interval = 6 }: { ads: SponsorAd[]; placement: AdPlacement; compact?: boolean; banner?: boolean; interval?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const touchStart = useRef<number | null>(null);
  const slides = ads.flatMap(ad => Array.from({ length: Math.max(ad.imageUrls?.length || 0, 1) }, (_, imageIndex) => ({ ad, imageIndex })));
  const current = slides[index % Math.max(slides.length, 1)];
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (slides.length < 2 || paused || hovered || reducedMotion) return;
    const timer = window.setInterval(() => { if (!document.hidden) setIndex(value => (value + 1) % slides.length); }, Math.max(interval, 4) * 1000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, hovered, reducedMotion, interval]);
  if (!current) return null;
  const move = (step: number) => setIndex(value => (value + step + slides.length) % slides.length);
  return <section className={`ad-carousel ${compact ? 'ad-carousel--compact' : ''} ${banner ? 'ad-carousel--banner' : ''}`} aria-roledescription="carousel" aria-label="Partner advertisements"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }}
    onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={event => { const end = event.changedTouches[0]?.clientX; if (touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 45) move(end < touchStart.current ? 1 : -1); touchStart.current = null; }}>
    <div key={`${current.ad.id}-${current.imageIndex}`} className="ad-carousel__slide"><SponsorCard ad={current.ad} placement={placement} compact={compact} banner={banner} imageIndex={current.imageIndex} /></div>
    {slides.length > 1 && <div className="ad-carousel__controls">
      <span className="text-xs tabular-nums text-ink-600" aria-live={paused || reducedMotion ? 'polite' : 'off'}>{index % slides.length + 1} / {slides.length}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="carousel-button" onClick={() => move(-1)} aria-label="Previous advertisement"><ChevronLeft aria-hidden className="size-4" /></button>
        {!reducedMotion && <button type="button" className="carousel-button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play advertisements' : 'Pause advertisements'}>{paused ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}</button>}
        <button type="button" className="carousel-button" onClick={() => move(1)} aria-label="Next advertisement"><ChevronRight aria-hidden className="size-4" /></button>
      </div>
    </div>}
  </section>;
}
