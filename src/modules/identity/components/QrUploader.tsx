'use client';

import imageCompression from 'browser-image-compression';
import { Loader2, QrCode, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The payment QR, for every provider.
 *
 * In Nepal this is how a deposit is usually sent: the buyer opens eSewa, Khalti
 * or a bank app and scans. Typing a wallet ID from a listing is the fallback,
 * not the norm, which is why the field is offered on bank transfer too rather
 * than only on the wallets.
 *
 * The bucket is private. A QR encodes the account it pays into, so it is the
 * same class of detail as the account number, and the account number is already
 * withheld from anonymous readers. The preview here is a local object URL until
 * the form is saved; buyers see it through a short-lived signed URL, and only on
 * listings where the seller switched disclosure on.
 *
 * Compression is capped at 1200px and quality 0.9. A QR is a high-contrast
 * bitmap: compress it the way a photograph is compressed and the finder
 * patterns break up and phones stop reading it.
 */
export function QrUploader({
  userId,
  value,
  onChange,
}: {
  userId: string;
  /** Storage path, not a URL. */
  value: string;
  onChange: (path: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setError('Use a JPG, PNG or WEBP image.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const prepared = await imageCompression(file, {
        maxWidthOrHeight: 1200,
        maxSizeMB: 1.5,
        initialQuality: 0.9,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      const supabase = createClient();
      // The policy keys on the first path segment being the uploader's id.
      const path = `${userId}/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('payment-qr')
        .upload(path, prepared, { contentType: 'image/webp', upsert: false });

      if (uploadError) {
        setError(`Could not upload that image. ${uploadError.message}`);
        return;
      }

      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(prepared));
      onChange(path);
    } catch {
      setError('That file could not be read as an image.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-200 bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your payment QR code" className="size-full object-contain" />
          ) : value ? (
            <span className="px-2 text-center text-2xs text-emerald-700">Saved</span>
          ) : (
            <QrCode aria-hidden className="size-8 text-ink-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">Payment QR code</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            Optional. Buyers scan this in eSewa, Khalti, IME Pay or their bank app instead of
            typing your account details.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              id="qr-file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button type="button" size="sm" variant="secondary" asChild disabled={busy}>
              <label htmlFor="qr-file" className="cursor-pointer">
                {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
                {busy ? 'Uploading…' : value ? 'Replace QR' : 'Upload QR'}
              </label>
            </Button>

            {value && !busy && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null);
                  onChange('');
                }}
              >
                <Trash2 aria-hidden className="size-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className={cn('mt-3 flex items-start gap-2 text-xs text-clay-700')}
        >
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
