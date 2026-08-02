'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * A person's picture, wherever a person is shown.
 *
 * profiles.avatar_url was being written correctly and read into the session, and
 * then rendered in exactly one place: the picker on the owner's own settings
 * page. Every public surface drew a coloured circle with an initial in it, so a
 * seller who had uploaded a photo appeared to everyone else as though they had
 * not. This component is what those surfaces render instead.
 *
 * Two things it has to get right:
 *
 *   - The stored value may be a full public URL (what the picker writes today)
 *     or a bare storage path (what a server-side write would produce). Both
 *     resolve here so neither form is a broken picture.
 *   - A URL that 404s must fall back to initials, not to the browser's broken
 *     image glyph. `onError` swapping to the fallback is the only reliable way
 *     to do that; CSS cannot style a failed <img> into something else.
 */

const BUCKET = 'avatars';

export function avatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already absolute. Anything the picker has written since it was introduced
  // takes this branch.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${trimmed.replace(/^\/+/, '')}`;
}

/** First letters of the first and last words, which reads better than one letter. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  return (words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)).toUpperCase();
}

const SIZES = {
  xs: 'size-6 text-2xs',
  sm: 'size-8 text-xs',
  md: 'size-11 text-base',
  lg: 'size-16 text-xl',
  xl: 'size-24 text-3xl',
} as const;

export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  /** A full URL or a storage path. Either works. */
  src: string | null | undefined;
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const resolved = avatarUrl(src);
  const [failed, setFailed] = useState(false);

  /*
   * Reset on a new source. Without this, uploading a replacement leaves the
   * component stuck on the initials it fell back to for the previous picture,
   * and the only way to see the new one is a full page reload — which is exactly
   * the "the avatar does not refresh after upload" symptom.
   */
  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const shell = cn(
    'relative shrink-0 overflow-hidden rounded-full border border-ink-200 bg-ink-50',
    SIZES[size],
    className,
  );

  if (!resolved || failed) {
    return (
      <span className={cn(shell, 'flex items-center justify-center font-semibold text-ink-500')}>
        <span aria-hidden>{initialsOf(name)}</span>
        <span className="sr-only">{name ?? 'Account'}</span>
      </span>
    );
  }

  return (
    <span className={shell}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={name ? `${name}'s picture` : ''}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </span>
  );
}
