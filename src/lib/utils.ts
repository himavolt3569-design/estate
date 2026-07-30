import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL-safe slug from a title. Latin only; Devanagari titles fall back to the reference code. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug;
}

/**
 * Keyset cursor codec. The cursor is opaque to the client on purpose: it is a
 * position, not an offset, and nothing good comes of letting callers craft one
 * by hand.
 */
export type SearchCursor = {
  id: string;
  published_at?: string;
  price?: number;
  distance?: number;
};

export function encodeCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): SearchCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as SearchCursor;
    return typeof candidate.id === 'string' ? candidate : null;
  } catch {
    return null;
  }
}

export function absoluteUrl(path: string): string {
  let base = process.env.NEXT_PUBLIC_SITE_URL;
  
  if (!base) {
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      base = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.VERCEL_URL) {
      base = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
      base = `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      base = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    } else {
      base = 'http://localhost:3000';
    }
  }

  return new URL(path, base).toString();
}
