import { cn } from '@/lib/utils';

/**
 * Storage images are compressed and sized into three renditions by the
 * client-side upload pipeline (docs/01-architecture.md §6), so next/image would
 * proxy and re-encode work that is already done. A plain <img> with an explicit
 * srcset is both faster and cheaper.
 *
 * `storagePath` is the object that was actually uploaded, and it is the fallback
 * for every rendition. Photos uploaded before the pipeline generated renditions
 * have an empty rendition map and would otherwise render as "No photo" despite
 * the file sitting in the bucket — which is exactly what happened to every photo
 * on the platform. Rendering the original is slightly heavier than rendering a
 * card rendition and infinitely lighter than rendering nothing.
 *
 * The wrapper owns the aspect ratio and clips its contents, so the box is
 * reserved whether the image is present, still loading, or 404s. That last case
 * matters: a bare <img> whose source fails collapses to the size of its alt
 * text and drags the surrounding layout with it.
 */

export type Renditions = { thumb?: string; card?: string; full?: string };

const BUCKET = 'property-media';

export function storageUrl(path: string | undefined | null, bucket = BUCKET): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export function PropertyImage({
  renditions,
  storagePath,
  alt,
  width,
  height,
  sizes,
  priority = false,
  className,
  wrapperClassName,
}: {
  renditions: Renditions | null | undefined;
  /** The uploaded object. Used wherever a rendition is missing. */
  storagePath?: string | null;
  alt: string;
  width: number;
  height: number;
  /** Must reflect the real rendered width, or the browser picks the wrong file. */
  sizes: string;
  /** Only the above-the-fold cover image should set this. */
  priority?: boolean;
  /** Applied to the <img>: transitions, hover scale. */
  className?: string;
  /** Applied to the ratio box: sizing, rounding, borders. */
  wrapperClassName?: string;
}) {
  const original = storageUrl(storagePath);
  const thumb = storageUrl(renditions?.thumb);
  const card = storageUrl(renditions?.card);
  const full = storageUrl(renditions?.full);
  const source = card ?? full ?? thumb ?? original;
  const ratio = { aspectRatio: `${width} / ${height}` };

  if (!source) {
    return (
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden bg-ink-100 text-ink-300',
          wrapperClassName,
        )}
        style={ratio}
      >
        <span className="text-2xs tracking-wide uppercase">No photo</span>
      </div>
    );
  }

  // Only a genuine set of differently-sized files is worth a srcset. Listing the
  // same original three times would make the browser pick a "smaller" file that
  // is not smaller and cost a pointless extra decode.
  const srcSet = [
    thumb ? `${thumb} 400w` : null,
    card ? `${card} 800w` : null,
    full ? `${full} 1920w` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className={cn('relative overflow-hidden bg-ink-100', wrapperClassName)} style={ratio}>
      <img
        src={source}
        srcSet={srcSet || undefined}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        // If the source 404s the browser paints the alt text in place. Keeping
        // it small and muted means a broken image reads as a caption on the
        // reserved grey box rather than as a block of stray body copy.
        className={cn(
          'absolute inset-0 size-full object-cover text-2xs text-ink-400',
          className,
        )}
      />
    </div>
  );
}
