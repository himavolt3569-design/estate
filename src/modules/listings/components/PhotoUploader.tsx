'use client';

import imageCompression from 'browser-image-compression';
import { ImagePlus, Loader2, Star, Trash2, TriangleAlert } from 'lucide-react';
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

/**
 * Photos go from the browser straight to Supabase Storage.
 *
 * Routing them through a Next server action instead would mean every photo is
 * base64'd into a request body, held in server memory, and sent on — four times
 * the bytes over a mobile connection, for no gain. Storage authorises the write
 * with the same owns_property() the tables use, so going direct is not a
 * shortcut around anything.
 */
export function PhotoUploader({
  propertyId,
  initial,
  onCountChange,
}: {
  propertyId: string;
  initial: UploadedImage[];
  onCountChange?: (count: number) => void;
}) {
  const [images, setImages] = useState<UploadedImage[]>(initial);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    (next: UploadedImage[]) => {
      setImages(next);
      onCountChange?.(next.length);
    },
    [onCountChange],
  );

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
      const supabase = createClient();
      const added: UploadedImage[] = [];

      try {
        for (const [index, file] of files.entries()) {
          // Phone cameras produce 6–12 MB files. Compressing in the browser is
          // what stops the upload failing against the bucket's 5 MB limit on a
          // connection where the failure would cost a minute of waiting first.
          const prepared =
            file.size > MAX_BYTES
              ? await imageCompression(file, {
                  maxSizeMB: 4,
                  maxWidthOrHeight: 2560,
                  useWebWorker: true,
                  fileType: 'image/webp',
                })
              : file;

          const extension = prepared.type === 'image/webp' ? 'webp' : file.name.split('.').pop() || 'jpg';
          const storagePath = `${propertyId}/${crypto.randomUUID()}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from('property-media')
            .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });

          if (uploadError) {
            toast.error(`Could not upload ${file.name}. ${uploadError.message}`);
            continue;
          }

          const isCover = images.length === 0 && added.length === 0 && index === 0;

          const result = await registerListingImage({
            propertyId,
            storagePath,
            isCover,
            position: images.length + added.length,
          });

          if (!result.ok) {
            await supabase.storage.from('property-media').remove([storagePath]);
            toast.error(result.error);
            continue;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from('property-media').getPublicUrl(storagePath);

          added.push({ id: result.data.id, storagePath, url: publicUrl, isCover });
        }

        if (added.length > 0) {
          update([...images, ...added]);
          toast.success(added.length === 1 ? 'Photo added.' : `${added.length} photos added.`);
        }
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [images, propertyId, update],
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
    update(remaining);
  }

  async function makeCover(image: UploadedImage) {
    const result = await setListingCoverImage({ id: image.id, propertyId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    update(images.map((item) => ({ ...item, isCover: item.id === image.id })));
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
      </div>

      {short > 0 && (
        <p className="flex items-center gap-2.5 rounded-xl border border-marigold-200 bg-marigold-50 px-4 py-3 text-sm text-marigold-900">
          <TriangleAlert aria-hidden className="size-4 shrink-0 text-marigold-600" />
          Add {short} more {short === 1 ? 'photo' : 'photos'}. A listing needs {MIN_IMAGES} before we
          can check it.
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
