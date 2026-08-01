'use client';

import imageCompression from 'browser-image-compression';
import { Camera, Loader2, Trash2, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
/** The avatars bucket caps at 1 MB, so the output has to be small by construction. */
const OUTPUT_PX = 512;

type Editing = { src: string; naturalWidth: number; naturalHeight: number };

/**
 * Picture picker with the crop built in.
 *
 * The field used to be a text input labelled "Avatar URL", which asked a seller
 * in Pokhara to go and host an image somewhere and paste the address back. Here
 * they drop a photo from their phone, drag it into the circle, and it is done.
 *
 * The crop happens on a canvas in the browser and only the 512px square is
 * uploaded, so a 9 MB camera photo becomes about 60 KB and the bucket's 1 MB
 * limit is never in play.
 */
export function AvatarPicker({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Revoke the object URL when the editor closes, or the blob leaks for the
    // lifetime of the tab.
    return () => {
      if (editing) URL.revokeObjectURL(editing.src);
    };
  }, [editing]);

  const openEditor = useCallback((file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Use a JPG, PNG or WEBP image.');
      return;
    }

    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setEditing({ src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.onerror = () => {
      URL.revokeObjectURL(src);
      toast.error('That file could not be read as an image.');
    };
    image.src = src;
  }, []);

  /** Renders the visible circle to a square canvas at the output size. */
  async function crop(): Promise<Blob | null> {
    if (!editing || !frameRef.current) return null;

    const frame = frameRef.current.clientWidth;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;

    const context = canvas.getContext('2d');
    if (!context) return null;

    const image = new Image();
    image.src = editing.src;
    await image.decode();

    /*
     * The preview draws the image with object-fit: cover inside a square frame,
     * then scales by `zoom` and translates by `offset`. To cut the same square
     * out of the original we reproduce that transform at output resolution:
     * `base` is the cover scale, and the offsets are converted from frame
     * pixels to output pixels by the ratio between the two.
     */
    const base = Math.max(frame / editing.naturalWidth, frame / editing.naturalHeight);
    const scale = (base * zoom * OUTPUT_PX) / frame;
    const ratio = OUTPUT_PX / frame;

    const drawWidth = editing.naturalWidth * scale;
    const drawHeight = editing.naturalHeight * scale;
    const x = (OUTPUT_PX - drawWidth) / 2 + offset.x * ratio;
    const y = (OUTPUT_PX - drawHeight) / 2 + offset.y * ratio;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);
    context.drawImage(image, x, y, drawWidth, drawHeight);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  }

  async function save() {
    setBusy(true);
    try {
      const blob = await crop();
      if (!blob) {
        toast.error('Could not prepare that image.');
        return;
      }

      const file = await imageCompression(
        new File([blob], 'avatar.webp', { type: 'image/webp' }),
        { maxSizeMB: 0.9, maxWidthOrHeight: OUTPUT_PX, useWebWorker: true, fileType: 'image/webp' },
      );

      const supabase = createClient();
      // The avatars policy keys on the first path segment being the user's id.
      const path = `${userId}/${crypto.randomUUID()}.webp`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: 'image/webp', upsert: false });

      if (error) {
        toast.error(`Could not upload that picture. ${error.message}`);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);

      onChange(publicUrl);
      setEditing(null);
      toast.success('Picture set. Save the form to keep it.');
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------------------------------------------- */

  if (editing) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-5">
        <p className="mb-4 text-sm font-medium text-ink-800">
          Drag the picture to move it, and use the slider to zoom.
        </p>

        <div
          ref={frameRef}
          onPointerDown={(event) => {
            pointer.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!pointer.current) return;
            setOffset({
              x: event.clientX - pointer.current.x,
              y: event.clientY - pointer.current.y,
            });
          }}
          onPointerUp={() => {
            pointer.current = null;
          }}
          className="relative mx-auto aspect-square w-56 cursor-grab overflow-hidden rounded-full border-4 border-white shadow-raised active:cursor-grabbing"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={editing.src}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full object-cover select-none"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          />
        </div>

        <label className="mt-5 flex items-center gap-3">
          <ZoomIn aria-hidden className="size-4 shrink-0 text-ink-400" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Zoom"
            className="range w-full"
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 aria-hidden className="animate-spin" />}
            {busy ? 'Saving…' : 'Use this picture'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
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
        if (file) openEditor(file);
      }}
      className={cn(
        'flex flex-wrap items-center gap-5 rounded-2xl border-2 border-dashed p-5 transition-colors',
        dragging
          ? 'border-crimson-400 bg-crimson-50'
          : 'border-ink-200 bg-ink-50/50 hover:border-crimson-300',
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-ink-200 bg-white">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-ink-300">
            <Camera aria-hidden className="size-7" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">Your picture</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Drag a photo here, or choose one from your phone. You can move and zoom it before it is
          saved.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) openEditor(file);
              event.target.value = '';
            }}
            className="sr-only"
            id="avatar-file"
          />
          <Button type="button" size="sm" variant="secondary" asChild>
            <label htmlFor="avatar-file" className="cursor-pointer">
              {value ? 'Change picture' : 'Choose a picture'}
            </label>
          </Button>

          {value && (
            <Button type="button" size="sm" variant="destructive" onClick={() => onChange(null)}>
              <Trash2 aria-hidden className="size-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
