'use client';

import imageCompression from 'browser-image-compression';
import { ImageUp, Loader2, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { restoreHeroImage, setHeroImage } from '../actions';
import type { HeroImage } from '../site-media';

export function HeroImageControl({
  current,
  history,
}: {
  current: string | null;
  history: HeroImage[];
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(current);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The picture is resized here, in the browser, before it is sent anywhere.
   *
   * Two reasons, and the second is the important one.
   *
   * A Server Action body is capped at 1 MB by default, so the 4 MB photo this
   * panel invited people to drop in came back as "Body exceeded 1 MB limit" —
   * a Next.js error message, on the master admin's own screen, for doing
   * exactly what the label said.
   *
   * The limit was the symptom. A hero image is the first thing every visitor
   * downloads, so shipping a 4 MB original was already wrong: on Nepali mobile
   * data that is the difference between a home page that appears and one that
   * arrives in pieces. 2560px of WebP is indistinguishable behind the headline
   * text and roughly a tenth of the bytes — for the visitor as well as for the
   * upload.
   */
  async function upload(original: File) {
    setBusy(true);
    const objectUrl = URL.createObjectURL(original);
    setPreview(objectUrl);

    try {
      let file = original;
      try {
        file = await imageCompression(original, {
          maxSizeMB: 0.9,
          maxWidthOrHeight: 2560,
          useWebWorker: true,
          fileType: 'image/webp',
        });
      } catch {
        // A browser without the worker, or an image the encoder chokes on:
        // send the original and let the server's own size check answer.
        file = original;
      }

      const formData = new FormData();
      formData.append('image', file);

      const result = await setHeroImage(formData);

      if (!result.ok) {
        setPreview(current);
        toast.error(result.error);
        return;
      }

      setPreview(result.data.url);
      toast.success('Home page background changed.');
    } finally {
      setBusy(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function restore(name: string) {
    setBusy(true);
    const result = await restoreHeroImage(name);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Put that one back.');
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void upload(file);
        }}
        className={cn(
          'relative aspect-21/9 overflow-hidden rounded-2xl border-2 border-dashed transition-colors',
          dragging ? 'border-crimson-400 bg-crimson-50' : 'border-ink-200 bg-ink-50',
        )}
      >
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
          className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-wait"
          aria-label="Choose a background image"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900/45 text-center text-white">
          {busy ? (
            <Loader2 aria-hidden className="size-8 animate-spin" />
          ) : (
            <ImageUp aria-hidden className="size-8" />
          )}
          <p className="text-sm font-semibold">
            {busy ? 'Uploading…' : 'Drag an image here, or click to choose one'}
          </p>
          <p className="max-w-sm text-xs text-white/75">
            Wide photos work best. JPG, PNG or WEBP — big ones are shrunk to a web-sized
            picture before they go up, so the home page stays quick to open.
          </p>
        </div>
      </div>

      {history.length > 1 && (
        <div>
          <p className="label mb-3">Previously used</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {history.slice(1, 11).map((image) => (
              <li key={image.name} className="group relative">
                <div className="aspect-4/3 overflow-hidden rounded-xl border border-ink-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="size-full object-cover" />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void restore(image.name)}
                  className="absolute inset-x-1 bottom-1 h-8 justify-center px-2 text-2xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <RotateCcw aria-hidden className="size-3" /> Use
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
