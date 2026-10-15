'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Images, MapPin, Star, Trash2, UploadCloud } from 'lucide-react';
import { useSiteText } from './site-language';

type PreviewPhoto = { id: string; file: File; url: string };
type DraftPreview = { title: string; rent: string; address: string; type: string };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function ListingPhotoPicker({
  onChange,
  draft,
  disabled = false,
}: {
  onChange: (files: File[]) => void;
  draft: DraftPreview;
  disabled?: boolean;
}) {
  const t = useSiteText();
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const [photos, setPhotos] = useState<PreviewPhoto[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const commit = (next: PreviewPhoto[]) => {
    setPhotos(next);
    onChange(next.map(photo => photo.file));
  };

  const addPhotos = (incoming: File[]) => {
    if (disabled || !incoming.length) return;
    const existing = new Set(photos.map(photo => `${photo.file.name}:${photo.file.size}:${photo.file.lastModified}`));
    const next = [...photos];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!file.type.startsWith('image/')) { rejected.push(`${file.name} is not an image.`); continue; }
      if (file.size >= MAX_PHOTO_BYTES) { rejected.push(`${file.name} is over 5 MB.`); continue; }
      const identity = `${file.name}:${file.size}:${file.lastModified}`;
      if (existing.has(identity)) continue;
      existing.add(identity);
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      next.push({ id: crypto.randomUUID(), file, url });
    }
    if (next.length !== photos.length) commit(next);
    setError(rejected.join(' '));
  };

  const makeCover = (id: string) => {
    const selected = photos.find(photo => photo.id === id);
    if (!selected || selected.id === photos[0]?.id) return;
    commit([selected, ...photos.filter(photo => photo.id !== id)]);
  };

  const removePhoto = (id: string) => {
    const selected = photos.find(photo => photo.id === id);
    if (!selected) return;
    commit(photos.filter(photo => photo.id !== id));
    URL.revokeObjectURL(selected.url);
    urlsRef.current = urlsRef.current.filter(url => url !== selected.url);
    setError('');
  };

  const formattedRent = Number(draft.rent) > 0
    ? `Rs. ${new Intl.NumberFormat('en-NP').format(Number(draft.rent))}`
    : 'Rs. —';

  return (
    <aside aria-labelledby="listing-photo-heading" className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft xl:sticky xl:top-24">
      <div className="thread h-1" />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-royal-50 text-royal-700"><Images aria-hidden className="size-5" /></span>
          <div><h3 id="listing-photo-heading" className="text-lg font-semibold text-ink-900">{t('Photos & live preview', 'फोटो र प्रत्यक्ष पूर्वावलोकन')}</h3><p className="mt-1 text-xs leading-relaxed text-ink-500">{t('The first photo is your listing cover. Changes appear here instantly.', 'पहिलो फोटो विज्ञापनको आवरण हो। परिवर्तन यहाँ तुरुन्त देखिन्छ।')}</p></div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm">
          <div className="relative aspect-[16/10] bg-ink-100">
            {photos[0] ? <img src={photos[0].url} alt={t('Listing cover preview', 'विज्ञापनको आवरणको पूर्वावलोकन')} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-royal-50 via-white to-ink-100 text-ink-400"><Images aria-hidden className="size-9 text-royal-300" /><span className="text-xs font-medium">{t('Your cover photo appears here', 'आवरण फोटो यहाँ देखिन्छ')}</span></div>}
            <span className="absolute left-3 top-3 rounded bg-royal-700 px-2.5 py-1 text-xs font-semibold capitalize text-white">{draft.type}</span>
            {photos.length > 0 && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-royal-950/85 px-2.5 py-1 text-xs font-medium text-white"><Star aria-hidden className="size-3 fill-current" /> {t('Cover photo', 'आवरण फोटो')}</span>}
          </div>
          <div className="space-y-1 p-4">
            <p className="truncate text-sm font-semibold text-ink-900">{draft.title.trim() || t('Your property title', 'घरजग्गाको शीर्षक')}</p>
            <p className="flex items-center gap-1 truncate text-xs text-ink-500"><MapPin aria-hidden className="size-3.5 shrink-0" />{draft.address.trim() || t('Location will appear here', 'स्थान यहाँ देखिन्छ')}</p>
            <p className="pt-1 text-lg font-semibold text-royal-700">{formattedRent} <span className="text-xs font-normal text-ink-500">/ month</span></p>
          </div>
        </div>

        <input
          ref={inputRef}
          id="listing-photos"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={disabled}
          aria-describedby="photo-help photo-status"
          onChange={event => { addPhotos(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); addPhotos(Array.from(event.dataTransfer.files)); }}
          className={`flex w-full flex-col items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700 disabled:cursor-not-allowed disabled:opacity-50 ${dragging ? 'border-crimson-500 bg-crimson-50' : 'border-royal-200 bg-royal-50/40 hover:border-royal-500 hover:bg-royal-50'}`}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-white text-royal-700 shadow-sm">{photos.length ? <ImagePlus aria-hidden className="size-5" /> : <UploadCloud aria-hidden className="size-5" />}</span>
          <span className="mt-2 text-sm font-semibold text-royal-800">{photos.length ? t('Add more photos', 'थप फोटो राख्नुहोस्') : t('Choose your photos', 'फोटो छान्नुहोस्')}</span>
          <span className="mt-1 text-xs text-ink-500">{t('Click or drop images here', 'क्लिक गर्नुहोस् वा फोटो यहाँ तान्नुहोस्')}</span>
        </button>
        <p id="photo-help" className="text-xs leading-relaxed text-ink-500">{t('Images must be under 5 MB each. Select a thumbnail to change the cover photo.', 'प्रत्येक फोटो ५ MB भन्दा सानो हुनुपर्छ। आवरण बदल्न सानो फोटो छान्नुहोस्।')}</p>

        <div id="photo-status" role="status" aria-live="polite" className="text-xs font-medium text-ink-600">{photos.length} {photos.length === 1 ? 'photo' : 'photos'} selected</div>
        {error && <p role="alert" className="rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-700">{error}</p>}

        {photos.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3">
          {photos.map((photo, index) => <div key={photo.id} className={`relative overflow-hidden rounded-lg border-2 ${index === 0 ? 'border-crimson-600' : 'border-ink-100'}`}>
            <button type="button" disabled={disabled} onClick={() => makeCover(photo.id)} aria-label={index === 0 ? `${photo.file.name}, cover photo` : `Make ${photo.file.name} the cover photo`} aria-pressed={index === 0} className="block aspect-square w-full focus-visible:outline-2 focus-visible:outline-royal-700"><img src={photo.url} alt="" className="h-full w-full object-cover" /></button>
            {index === 0 && <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-royal-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
            <button type="button" disabled={disabled} onClick={() => removePhoto(photo.id)} aria-label={`Remove ${photo.file.name}`} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-white/95 text-clay-700 shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-royal-700"><Trash2 aria-hidden className="size-3.5" /></button>
          </div>)}
        </div>}
      </div>
    </aside>
  );
}
