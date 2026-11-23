'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Images,
  MapPin,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { landArea, type LandDetails } from '@/lib/land';
import { useSignedInText } from './signed-in-copy';
import { useSiteText } from './site-language';

export type EditablePhoto = { id: string; url: string; file?: File };

type DraftPreview = {
  title: string;
  rent: string;
  address: string;
  type: string;
  transactionType?: 'rent' | 'sale';
  land?: LandDetails | null;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function ListingPhotoEditor({
  photos,
  onChange,
  disabled,
  draft,
}: {
  photos: EditablePhoto[];
  onChange: (next: EditablePhoto[]) => void;
  disabled: boolean;
  draft?: DraftPreview;
}) {
  const tr = useSignedInText();
  const t = useSiteText();
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const add = (files: File[]) => {
    if (disabled || !files.length) return;
    const accepted: EditablePhoto[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/') || file.size >= MAX_PHOTO_BYTES) {
        rejected.push(file.name);
        continue;
      }
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      accepted.push({ id: crypto.randomUUID(), url, file });
    }
    if (accepted.length) onChange([...photos, ...accepted]);
    setError(rejected.length ? `Use images under 5 MB: ${rejected.join(', ')}` : '');
  };

  const move = (index: number, nextIndex: number) => {
    const next = [...photos];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    onChange(next);
  };

  const remove = (id: string) => {
    const item = photos.find((photo) => photo.id === id);
    if (item?.file) {
      URL.revokeObjectURL(item.url);
      urls.current = urls.current.filter((url) => url !== item.url);
    }
    onChange(photos.filter((photo) => photo.id !== id));
  };

  const formattedRent =
    draft && Number(draft.rent) > 0
      ? `Rs. ${new Intl.NumberFormat('en-NP').format(Number(draft.rent))}`
      : 'Rs. -';

  return (
    <aside
      aria-labelledby="listing-photo-heading"
      className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft xl:sticky xl:top-24"
    >
      <div className="thread h-1" />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-royal-50 text-royal-700">
            <Images aria-hidden className="size-5" />
          </span>
          <div>
            <h2 id="listing-photo-heading" className="text-lg font-semibold text-ink-900">
              {t('Photos & live preview', 'फोटो र प्रत्यक्ष पूर्वावलोकन')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              {tr('The first image is the cover. Reorder, remove, or add photos before saving.')}
            </p>
          </div>
        </div>

        {draft && (
          <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm">
            <div className="relative aspect-[16/10] bg-ink-100">
              {photos[0] ? (
                <img
                  src={photos[0].url}
                  alt={t('Listing cover preview', 'विज्ञापनको आवरणको पूर्वावलोकन')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-royal-50 via-white to-ink-100 text-ink-400">
                  <Images aria-hidden className="size-9 text-royal-300" />
                  <span className="text-xs font-medium">
                    {t('Your cover photo appears here', 'आवरण फोटो यहाँ देखिन्छ')}
                  </span>
                </div>
              )}
              <span className="absolute left-3 top-3 rounded bg-royal-700 px-2.5 py-1 text-xs font-semibold capitalize text-white">
                {draft.type}
              </span>
              {photos.length > 0 && (
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-royal-950/85 px-2.5 py-1 text-xs font-medium text-white">
                  <Star aria-hidden className="size-3 fill-current" />{' '}
                  {t('Cover photo', 'आवरण फोटो')}
                </span>
              )}
            </div>
            <div className="space-y-1 p-4">
              <p className="truncate text-sm font-semibold text-ink-900">
                {draft.title.trim() || t('Your property title', 'घरजग्गाको शीर्षक')}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-ink-500">
                <MapPin aria-hidden className="size-3.5 shrink-0" />
                {draft.address.trim() || t('Location will appear here', 'स्थान यहाँ देखिन्छ')}
              </p>
              <p className="pt-1 text-lg font-semibold text-royal-700">
                {formattedRent}{' '}
                <span className="text-xs font-normal text-ink-500">
                  {draft.transactionType === 'sale' ? 'asking price' : '/ month'}
                </span>
              </p>
              {draft.type === 'land' && landArea(draft.land) && (
                <p className="text-sm font-medium text-ink-700">{landArea(draft.land)}</p>
              )}
            </div>
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            add(Array.from(event.currentTarget.files || []));
            event.currentTarget.value = '';
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            add(Array.from(event.dataTransfer.files));
          }}
          className={`flex w-full flex-col items-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700 disabled:cursor-not-allowed disabled:opacity-50 ${
            dragging
              ? 'border-crimson-500 bg-crimson-50'
              : 'border-royal-200 bg-royal-50/40 hover:border-royal-500 hover:bg-royal-50'
          }`}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-royal-700 shadow-sm">
            {photos.length ? (
              <ImagePlus aria-hidden className="size-5" />
            ) : (
              <UploadCloud aria-hidden className="size-5" />
            )}
          </span>
          <span className="mt-2 text-sm font-semibold text-royal-800">
            {tr('Add photos')}
          </span>
          <span className="mt-1 text-xs text-ink-500">
            {t('Click or drop images here', 'क्लिक गर्नुहोस् वा फोटो यहाँ तान्नुहोस्')}
          </span>
        </button>

        <p className="text-xs leading-relaxed text-ink-600">
          {tr('New property photos receive a subtle MeroKotha watermark when uploaded.')}
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-700">
            {error}
          </p>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className={`overflow-hidden rounded-lg border bg-white ${
                  index === 0 ? 'border-crimson-500' : 'border-ink-200'
                }`}
              >
                <div className="relative aspect-square">
                  <img
                    src={photo.url}
                    alt={`Rental photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-royal-900/90 px-2 py-1 text-[10px] text-white">
                      <Star aria-hidden className="size-3" /> Cover
                    </span>
                  )}
                </div>
                <div className="flex justify-between p-1">
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Move photo ${index + 1} earlier`}
                    className="rounded p-1 disabled:opacity-30"
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === photos.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Move photo ${index + 1} later`}
                    className="rounded p-1 disabled:opacity-30"
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => remove(photo.id)}
                    aria-label={`Remove photo ${index + 1}`}
                    className="rounded p-1 text-clay-700 disabled:opacity-30"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
