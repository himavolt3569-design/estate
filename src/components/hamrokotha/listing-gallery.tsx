'use client';

import { useState } from 'react';

export function ListingGallery({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, photos.length - 1));
  if (!photos.length) return <div className="listing-main-photo text-sm text-ink-600">Photos are not available for this rental.</div>;
  return <section className="listing-gallery" aria-label="Property photos">
    <div className="listing-main-photo">
      <img src={photos[index]} alt={`${title}, photo ${index + 1} of ${photos.length}`} />
      <span className="absolute bottom-4 right-4 rounded-lg bg-royal-950/85 px-3 py-2 text-xs font-medium tabular-nums text-white">{index + 1} / {photos.length}</span>
    </div>
    {photos.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Choose a photo">{photos.map((url, i) => <button key={`${url}-${i}`} type="button" aria-label={`Show photo ${i + 1}`} aria-pressed={index === i} onClick={() => setActive(i)} className={`h-20 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${index === i ? 'border-royal-700' : 'border-transparent'}`}><img src={url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
  </section>;
}
