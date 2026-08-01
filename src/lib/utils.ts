import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL-safe slug from a title. Latin only; Devanagari titles fall back to the reference code. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
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
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(
  raw: string | null | undefined,
): SearchCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as SearchCursor;
    return typeof candidate.id === "string" ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * The site's own origin.
 *
 * Every source here is operator-supplied and any of them can arrive without a
 * protocol — `kitta-estate.vercel.app` is a perfectly natural thing to paste
 * into an env var, and it is what was actually configured. `new URL()` rejects
 * it, and because metadataBase is evaluated at module scope in the root layout,
 * that single throw took down every route in the app with a 500. So the origin
 * is normalised once, here, and callers get something `new URL()` accepts.
 */
export function siteOrigin(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "http://localhost:3000";

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `${candidate.startsWith("localhost") || candidate.startsWith("127.0.0.1") ? "http" : "https"}://${candidate}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteOrigin()).toString();
}
