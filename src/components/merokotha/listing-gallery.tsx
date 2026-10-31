'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, Minus, Plus, X } from 'lucide-react';

export function ListingGallery({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const index = Math.min(active, Math.max(0, photos.length - 1));
  const move = (step: number) => { setActive(value => (value + step + photos.length) % photos.length); setZoom(1); };
  if (!photos.length) return <div className="listing-main-photo text-sm text-ink-600">Photos are not available for this rental.</div>;
  return <section className="listing-gallery" aria-label="Property photos">
    <div className="listing-main-photo">
      <img src={photos[index]} alt={`${title}, photo ${index + 1} of ${photos.length}`} onClick={() => { setZoom(1); dialog.current?.showModal(); }} />
      <button type="button" className="listing-main-photo__zoom" onClick={() => { setZoom(1); dialog.current?.showModal(); }}><Expand aria-hidden className="size-4" />View full photo</button>
      <span className="absolute bottom-4 right-4 rounded-lg bg-royal-950/85 px-3 py-2 text-xs font-medium tabular-nums text-white">{index + 1} / {photos.length}</span>
    </div>
    {photos.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Choose a photo">{photos.map((url, i) => <button key={`${url}-${i}`} type="button" aria-label={`Show photo ${i + 1}`} aria-pressed={index === i} onClick={() => setActive(i)} className={`h-20 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${index === i ? 'border-royal-700' : 'border-transparent'}`}><img src={url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
    <dialog ref={dialog} className="listing-photo-dialog" aria-label={`${title} photo viewer`} onKeyDown={event => { if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1); }} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="listing-photo-dialog__toolbar"><span className="text-xs tabular-nums">Photo {index + 1} of {photos.length}</span><div className="flex items-center gap-1"><button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}><Minus aria-hidden className="size-4" /></button><span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + .5))}><Plus aria-hidden className="size-4" /></button><button type="button" aria-label="Close photo viewer" onClick={() => dialog.current?.close()}><X aria-hidden className="size-5" /></button></div></div>
      <div className="max-h-[80dvh] overflow-auto"><img src={photos[index]} alt={`${title}, photo ${index + 1}`} style={{ width: zoom > 1 ? `${zoom * 100}%` : undefined, maxWidth: zoom > 1 ? 'none' : '100%', maxHeight: zoom > 1 ? 'none' : '80dvh' }} /></div>
      {photos.length > 1 && <div className="listing-photo-dialog__toolbar"><button type="button" aria-label="Previous photo" onClick={() => move(-1)}><ChevronLeft aria-hidden className="size-5" />Previous</button><button type="button" aria-label="Next photo" onClick={() => move(1)}>Next<ChevronRight aria-hidden className="size-5" /></button></div>}
    </dialog>
  </section>;
}
