'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Leaf, Sparkles, UtensilsCrossed } from 'lucide-react';
import { adArtwork, partnerArtwork, sponsorHref, type SponsorAd } from '@/lib/ads';
import { SponsorCard } from './sponsor-card';
import { recordAdEvent } from './ad-provider';
import { useSiteLanguage } from './site-language';

export function LandingPromos({ ads, interval = 6, mobile = false }: { ads: SponsorAd[]; interval?: number; mobile?: boolean }) {
  const { locale } = useSiteLanguage();
  const ne = locale === 'ne';
  const rail = useRef<HTMLDivElement>(null);
  const requestedIndex = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [canSlide, setCanSlide] = useState(false);
  const slides = ads.map(ad => ({ ad, imageIndex: 0 }));
  const move = (next: number, cycling = false) => {
    const element = rail.current;
    if (!element || !slides.length) return;
    let target = (next + slides.length) % slides.length;
    if (cycling && next > index && element.scrollLeft >= element.scrollWidth - element.clientWidth - 2) target = 0;
    if (cycling && next < index && element.scrollLeft <= 2) target = slides.length - 1;
    const child = element.children[target] as HTMLElement | undefined;
    if (child) {
      requestedIndex.current = target;
      setIndex(target);
      element.scrollTo({ left: child.offsetLeft, behavior: reduced ? 'instant' : 'smooth' });
    }
  };

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update(); query.addEventListener('change', update);
    const observer = new ResizeObserver(() => {
      const element = rail.current;
      if (!element) return;
      setCanSlide(element.scrollWidth > element.clientWidth + 2);
      const child = requestedIndex.current == null ? null : element.children[requestedIndex.current] as HTMLElement | undefined;
      if (child) element.scrollTo({ left: child.offsetLeft, behavior: 'instant' });
    });
    if (rail.current) observer.observe(rail.current);
    return () => { query.removeEventListener('change', update); observer.disconnect(); };
  }, [slides.length]);

  useEffect(() => {
    if (!canSlide || paused || interacting || reduced || slides.length < 2) return;
    const timer = window.setInterval(() => { if (!document.hidden) move(index + 1, true); }, Math.max(4, interval) * 1000);
    return () => window.clearInterval(timer);
  }, [canSlide, paused, interacting, reduced, slides.length, interval, index]);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const id = (entry.target as HTMLElement).dataset.campaign;
        if (id) void recordAdEvent(id, 'impression', 'landing');
        observer.unobserve(entry.target);
      }
    }, { root: element, threshold: .65 });
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, [ads]);

  if (!slides.length) return null;
  return <section className="landing-promos" aria-label={ne ? 'साझेदार विज्ञापनहरू' : 'Partner advertisements'} aria-roledescription="carousel"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
    <div className="landing-promos__heading"><h2>{ne ? 'हाम्रा साझेदारहरू' : 'From our partners'}</h2><span>{ne ? 'विज्ञापन' : 'Advertisement'}</span></div>
    <div ref={rail} className="landing-promos__rail" tabIndex={canSlide ? 0 : undefined} aria-label={ne ? "विज्ञापन हेर्न स्वाइप गर्नुहोस्" : "Advertisements. Swipe or use arrow keys to browse."} onPointerDown={() => { requestedIndex.current = null; setPaused(true); }} onWheel={() => { requestedIndex.current = null; setPaused(true); }} onFocusCapture={event => { if (event.target !== event.currentTarget) { requestedIndex.current = null; setPaused(true); } }} onKeyDown={event => {
      requestedIndex.current = null;
      setPaused(true);
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(index + (event.key === 'ArrowRight' ? 1 : -1), true); }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); move(event.key === 'Home' ? 0 : slides.length - 1); }
    }} onScroll={event => {
      const element = event.currentTarget;
      const first = element.children[0] as HTMLElement | undefined;
      const second = element.children[1] as HTMLElement | undefined;
      const step = first && second ? second.offsetLeft - first.offsetLeft : 0;
      // Preserve the requested slide when several banners share the viewport.
      if (step > 0) setIndex(requestedIndex.current ?? Math.min(slides.length - 1, Math.round(element.scrollLeft / step)));
    }}>
      {slides.map(({ ad, imageIndex }, position) => {
        const brand = ad.id === 'partner-himavolt' ? 'himavolt' : ad.id === 'partner-pitambari' ? 'pitambari' : ad.id === 'partner-floor-cleaner' ? 'cleaner' : 'custom';
        const Icon = brand === 'himavolt' ? UtensilsCrossed : brand === 'cleaner' ? Sparkles : brand === 'pitambari' ? Leaf : ArrowUpRight;
        const artwork = mobile && ad.mobileImageUrl ? ad.mobileImageUrl : adArtwork(ad, imageIndex);
        const generatedArtwork = Boolean(artwork && artwork === partnerArtwork[ad.id]);
        const uploadedArtwork = Boolean(artwork && !generatedArtwork);
        const destination = sponsorHref(ad);
        const domain = destination?.startsWith('http') ? new URL(destination).hostname.replace(/^www\./, '') : '';
        return <div key={`${ad.id}-${imageIndex}`} data-campaign={ad.id} className={`landing-promo landing-promo--${brand} ${generatedArtwork ? 'landing-promo--illustrated' : ''} ${uploadedArtwork ? 'landing-promo--uploaded' : ''}`} role="group" aria-roledescription="slide" aria-label={`${position + 1} / ${slides.length}`} onClick={() => { if (brand === 'custom') void recordAdEvent(ad.id, 'click', 'landing'); }}>
          {brand === 'custom' ? <SponsorCard ad={ad} imageIndex={imageIndex} track={false} placement="landing" /> : <a href={sponsorHref(ad) || undefined} target="_blank" rel="sponsored noopener noreferrer" onClick={() => void recordAdEvent(ad.id, 'click', 'landing')}>
            {generatedArtwork && <img className="landing-promo__artwork" src={artwork} alt="" loading="eager" />}
            {uploadedArtwork ? <><picture className="landing-promo__uploaded"><img src={artwork} alt={ad.title || ''} /></picture><div className="landing-promo__caption"><div><span className="landing-promo__brand">{ad.sponsorName}</span><span className="landing-promo__domain">{domain}</span></div><span className="landing-promo__link">{ne ? 'वेबसाइट हेर्नुहोस्' : ad.ctaLabel || 'Visit website'}<ArrowUpRight aria-hidden size={15} /></span></div></> : <><div className="landing-promo__text"><span className="landing-promo__brand">{ad.sponsorName}</span><h3>{ad.title}</h3><span className="landing-promo__domain">{domain}</span><span className="landing-promo__link">{ne ? 'वेबसाइट हेर्नुहोस्' : ad.ctaLabel || 'Visit website'}<ArrowUpRight aria-hidden size={15} /></span></div>{!generatedArtwork && <span className="landing-promo__symbol" aria-hidden><Icon strokeWidth={1.35} /></span>}</>}
          </a>}
        </div>;
      })}
    </div>

  </section>;
}
