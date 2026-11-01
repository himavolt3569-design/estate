'use client';

import { useRef } from 'react';
import type { SponsorAd } from '@/lib/ads';
import { SponsorCard } from './sponsor-card';

/** Manual scrolling keeps ads browsable without a visible control strip. */
export function FeedAdRail({ ads, firstAd }: { ads: SponsorAd[]; firstAd?: SponsorAd }) {
  const drag = useRef<{ pointerId: number; x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const start = Math.max(0, ads.findIndex(ad => ad.id === firstAd?.id));
  const ordered = [...ads.slice(start), ...ads.slice(0, start)];
  const multiple = ordered.length > 1;
  const snap = (element: HTMLElement, direction?: number) => {
    const children = [...element.children] as HTMLElement[];
    const closest = children.reduce((best, child, index) => Math.abs(child.offsetLeft - element.scrollLeft) < Math.abs(children[best]!.offsetLeft - element.scrollLeft) ? index : best, 0);
    const target = children[Math.max(0, Math.min(children.length - 1, closest + (direction || 0)))];
    if (target) element.scrollTo({ left: target.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  if (!ordered.length) return null;
  return <section className={`feed-ad-rail ${multiple ? 'feed-ad-rail--scrollable' : ''}`} role="region" aria-roledescription={multiple ? 'carousel' : undefined} aria-label={multiple ? 'Advertisements. Swipe, drag or use arrow keys to browse.' : 'Advertisement'} tabIndex={multiple ? 0 : undefined}
    onKeyDown={event => {
      if (!multiple || event.target !== event.currentTarget) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); snap(event.currentTarget, event.key === 'ArrowRight' ? 1 : -1); }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); event.currentTarget.scrollTo({ left: event.key === 'Home' ? 0 : event.currentTarget.scrollWidth, behavior: 'instant' }); }
    }}
    onPointerDown={event => {
      suppressClick.current = false;
      if (multiple && event.pointerType === 'mouse' && event.button === 0) drag.current = { pointerId: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
    }}
    onPointerMove={event => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId || !event.buttons) return;
      const distance = event.clientX - current.x;
      if (!current.moved && Math.abs(distance) < 7) return;
      current.moved = true; suppressClick.current = true;
      event.currentTarget.dataset.dragging = 'true';
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.currentTarget.scrollLeft = current.left - distance;
    }}
    onPointerUp={event => {
      const current = drag.current;
      drag.current = null;
      delete event.currentTarget.dataset.dragging;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (current?.moved) { snap(event.currentTarget); requestAnimationFrame(() => { if (!drag.current) suppressClick.current = false; }); }
    }}
    onPointerCancel={event => { drag.current = null; suppressClick.current = false; delete event.currentTarget.dataset.dragging; }}
    onDragStart={event => { if (multiple) event.preventDefault(); }}
    onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    {ordered.map(ad => <div key={ad.id} className="feed-ad-rail__slide" data-campaign={ad.id}><SponsorCard ad={ad} placement="listings" compact /></div>)}
  </section>;
}
