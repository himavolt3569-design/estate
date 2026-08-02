'use client';

import imageCompression from 'browser-image-compression';
import { Check, ImagePlus, Loader2, Star, Trash2, TriangleAlert } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { deleteListingImage, registerListingImage, setListingCoverImage } from '../actions';
import { MIN_IMAGES } from '../schema';

export type UploadedImage = {
  id: string;
  storagePath: string;
  url: string;
  isCover: boolean;
};

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
/** storage.buckets caps property-media at 5 MB, so anything larger is compressed first. */
const MAX_BYTES = 5 * 1024 * 1024;

/*
 * The three sizes a listing is displayed at: a strip thumbnail, a card, and the
 * gallery. Generating them here rather than on a server keeps the whole pipeline
 * to one upload round trip per size and no image processing bill, and it is the
 * reason a card on a phone fetches ~40 KB instead of a 2 MB original.
 *
 * `full` is listed first because it is the one that matters most: if a slow
 * connection drops halfway through a set, the size the gallery needs is already
 * up, and storage_path points at it.
 */
const RENDITIONS = [
  { key: 'full', maxPx: 1920, quality: 0.82 },
  { key: 'card', maxPx: 800, quality: 0.8 },
  { key: 'thumb', maxPx: 400, quality: 0.75 },
] as const;

type RenditionKey = (typeof RENDITIONS)[number]['key'];

type Progress = { name: string; percent: number; stage: string };

/** Natural dimensions, recorded so a card can reserve the right box before load. */
async function measure(file: File): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Photos go from the browser straight to Supabase Storage.
 *
 * Routing them through a Next server action instead would mean every photo is
 * base64'd into a request body, held in server memory, and sent on — four times
 * the bytes over a mobile connection, for no gain. Storage authorises the write
 * with the same owns_property() the tables use, so going direct is not a
 * shortcut around anything.
 *
 * The list is owned by the wizard, not by this component. It used to be local
 * state seeded from a prop, and because the wizard unmounts the step you are
 * not on, stepping back to check the price and returning wiped the thumbnails —
 * the photos were still uploaded and still in the database, but the seller had
 * no way to know that, so they uploaded them again. Lifting the state is the
 * fix: whatever is here survives the trip, and a later batch is appended to it
 * rather than replacing it.
 */
export function PhotoUploader({
  propertyId,
  images,
  onChange,
}: {
  propertyId: string;
  images: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((file) => {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`${file.name} is not a photo we can use. Use JPG, PNG or WEBP.`);
          return false;
        }
        return true;
      });

      if (files.length === 0) return;

      setBusy(true);
      setFailures([]);
      const supabase = createClient();
      const added: UploadedImage[] = [];
      const failed: string[] = [];

      // One unit of work per rendition per file, so the bar tracks bytes going
      // out rather than files finished. With five photos, a bar that only moves
      // five times reads as frozen.
      const totalSteps = files.length * RENDITIONS.length;
      let step = 0;
      const advance = (name: string, stage: string) => {
        setProgress({ name, percent: Math.round((step / totalSteps) * 100), stage });
      };

      try {
        for (const [index, file] of files.entries()) {
          advance(file.name, 'Preparing');

          const dimensions = await measure(file);
          const imageId = crypto.randomUUID();
          const uploaded: Partial<Record<RenditionKey, string>> = {};

          for (const rendition of RENDITIONS) {
            advance(file.name, `Uploading ${rendition.key}`);

            let prepared: File;
            try {
              // Phone cameras produce 6-12 MB files. Resizing in the browser is
              // what stops the upload failing against the bucket's 5 MB limit on
              // a connection where the failure would cost a minute of waiting
              // first.
              prepared = await imageCompression(file, {
                maxWidthOrHeight: rendition.maxPx,
                maxSizeMB: 4,
                initialQuality: rendition.quality,
                useWebWorker: true,
                fileType: 'image/webp',
              });
            } catch {
              // Only the full size is worth falling back for. A browser that
              // cannot resize can still upload the original.
              if (rendition.key !== 'full' || file.size > MAX_BYTES) {
                step += 1;
                continue;
              }
              prepared = file;
            }

            const extension = prepared.type === 'image/webp' ? 'webp' : 'jpg';
            const path = `${propertyId}/${imageId}/${rendition.key}.${extension}`;

            const { error: uploadError } = await supabase.storage
              .from('property-media')
              .upload(path, prepared, { contentType: prepared.type, upsert: true });

            if (uploadError) {
              // Surfaced, never swallowed. If the full size is the one that
              // failed there is nothing to record and the photo is abandoned.
              if (rendition.key === 'full') {
                failed.push(`${file.name}: ${uploadError.message}`);
                break;
              }
            } else {
              uploaded[rendition.key] = path;
            }

            step += 1;
          }

          if (!uploaded.full) {
            if (!failed.some((f) => f.startsWith(file.name))) {
              failed.push(`${file.name}: the upload did not complete.`);
            }
            continue;
          }

          const isCover = images.length === 0 && added.length === 0 && index === 0;

          const result = await registerListingImage({
            propertyId,
            storagePath: uploaded.full,
            renditions: uploaded,
            width: dimensions?.width,
            height: dimensions?.height,
            isCover,
            position: images.length + added.length,
          });

          if (!result.ok) {
            await supabase.storage
              .from('property-media')
              .remove(Object.values(uploaded));
            failed.push(`${file.name}: ${result.error}`);
            continue;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from('property-media').getPublicUrl(uploaded.card ?? uploaded.full);

          added.push({ id: result.data.id, storagePath: uploaded.full, url: publicUrl, isCover });
        }

        if (added.length > 0) {
          // Appended, never replaced: a seller who comes back a week later and
          // adds two more keeps the ones already up there.
          onChange([...images, ...added]);
          toast.success(
            added.length === 1
              ? 'Photo added and saved.'
              : `${added.length} photos added and saved.`,
          );
        }

        if (failed.length > 0) {
          setFailures(failed);
          toast.error(
            failed.length === 1
              ? 'One photo could not be saved.'
              : `${failed.length} photos could not be saved.`,
          );
        }
      } finally {
        setBusy(false);
        setProgress(null);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [images, propertyId, onChange],
  );

  async function remove(image: UploadedImage) {
    const result = await deleteListingImage({ id: image.id, propertyId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const remaining = images.filter((item) => item.id !== image.id);
    // The server promotes the next photo when the cover goes; mirror that here
    // so the star does not vanish until the page is reloaded.
    if (image.isCover && remaining[0]) remaining[0] = { ...remaining[0], isCover: true };
    onChange(remaining);
  }

  async function makeCover(image: UploadedImage) {
    const result = await setListingCoverImage({ id: image.id, propertyId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onChange(images.map((item) => ({ ...item, isCover: item.id === image.id })));
    toast.success('Cover photo set.');
  }

  const short = Math.max(0, MIN_IMAGES - images.length);

  return (
    <div className="space-y-5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length > 0) void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-10',
          dragging
            ? 'border-crimson-400 bg-crimson-50'
            : 'border-ink-200 bg-ink-50/60 hover:border-crimson-300 hover:bg-crimson-50/40',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          disabled={busy}
          onChange={(event) => event.target.files && void handleFiles(event.target.files)}
          className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-wait"
          aria-label="Choose photos"
        />

        {busy ? (
          <Loader2 aria-hidden className="mx-auto size-8 animate-spin text-crimson-500" />
        ) : (
          <ImagePlus aria-hidden className="mx-auto size-8 text-ink-400" />
        )}

        <p className="mt-4 text-sm font-semibold text-ink-900">
          {busy ? 'Uploading your photos…' : 'Drag photos here, or tap to choose them'}
        </p>
        <p className="mt-1.5 text-xs text-ink-500">
          You can pick several at once. Big photos from your phone are made smaller automatically.
        </p>

        {progress && (
          <div className="mx-auto mt-5 max-w-sm">
            <div
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
              className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
            >
              <div
                className="h-full bg-crimson-500 transition-[width] duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-2 truncate text-xs text-ink-500">
              {progress.stage} · {progress.name}
            </p>
          </div>
        )}
      </div>

      {failures.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-clay-200 bg-clay-50 px-4 py-3 text-sm text-clay-900"
        >
          <p className="flex items-start gap-2.5 font-medium">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-clay-600" />
            These photos were not saved
          </p>
          <ul className="mt-2 space-y-1 pl-6.5 text-xs">
            {failures.map((failure) => (
              <li key={failure} className="break-words">
                {failure}
              </li>
            ))}
          </ul>
          <p className="mt-2 pl-6.5 text-xs text-clay-700">
            Nothing else was lost. Try them again, or choose different files.
          </p>
        </div>
      )}

      {/* Each photo is saved the moment it finishes uploading, so the count is
          a running total and not a target to hit in one sitting. That is worth
          saying out loud — the old wording read as "five or nothing". */}
      {short > 0 ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-marigold-200 bg-marigold-50 px-4 py-3 text-sm text-marigold-900">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-600" />
          <span>
            {images.length === 0
              ? `Add ${MIN_IMAGES} photos to send this for checking.`
              : `${images.length} saved. Add ${short} more ${short === 1 ? 'photo' : 'photos'} to send this for checking.`}
            <span className="mt-0.5 block text-xs text-marigold-900/75">
              Each one is saved as soon as it uploads. You can stop here and add the rest later.
            </span>
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <span>
            {images.length} {images.length === 1 ? 'photo' : 'photos'} saved — that is enough to
            send it for checking.
            <span className="mt-0.5 block text-xs text-emerald-900/75">
              Add more whenever you like; they go on the end of the ones already here.
            </span>
          </span>
        </p>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <li
              key={image.id}
              className="group relative aspect-4/3 overflow-hidden rounded-xl border border-ink-200 bg-ink-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="size-full object-cover" />

              {image.isCover && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-2xs font-semibold tracking-wide text-white uppercase">
                  <Star aria-hidden className="size-3 fill-current" /> Main photo
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-linear-to-t from-ink-900/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {!image.isCover && (
                  <button
                    type="button"
                    onClick={() => void makeCover(image)}
                    className="rounded-md bg-white/95 px-2 py-1 text-2xs font-semibold text-ink-800 hover:bg-white"
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(image)}
                  aria-label="Remove photo"
                  className="ml-auto rounded-md bg-white/95 p-1.5 text-clay-700 hover:bg-white"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
