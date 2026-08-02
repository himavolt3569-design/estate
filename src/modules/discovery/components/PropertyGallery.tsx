'use client';

import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PropertyImage } from '@/components/media/PropertyImage';
import { cn } from '@/lib/utils';

export type GalleryImage = {
  id: string;
  renditions: { thumb?: string; card?: string; full?: string };
  storagePath: string | null;
  alt: string | null;
  isCover: boolean;
};

/**
 * The listing gallery.
 *
 * What was wrong with the previous one, measured rather than guessed:
 *
 *   - The cover reserved a 4:3 box (795x596) and the photos in it are 16:9
 *     (1749x980). object-cover then cropped a quarter of every picture away,
 *     top and bottom, which is why a wide shot of a house arrived with its roof
 *     and garden missing.
 *   - The side column was 596px tall and its thumbnails were 146px, so roughly
 *     450px of the block was empty white space sitting next to the cover.
 *   - Only the cover plus four more were reachable. A listing with ten photos
 *     showed five and gave no indication the rest existed.
 *   - Nothing was clickable, so a buyer could not look at any photo properly.
 *
 * The block is now 16:9, which is the shape the photos on this platform actually
 * are (measured: 1749x980), so the cover crops essentially nothing. The
 * thumbnail column fills the same height, so it cannot leave a gap, and at that
 * height the cells come out near-square instead of letterboxed. The layout
 * adapts to how many photos there are, and everything opens full-size where it
 * is shown uncropped.
 */
export function PropertyGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  // Cover first, then the order the seller chose.
  const ordered = [...images].sort((a, b) => Number(b.isCover) - Number(a.isCover));

  if (ordered.length === 0) {
    return (
      <div className="mt-4 flex aspect-video w-full items-center justify-center rounded-sm border border-ink-200 bg-ink-50">
        <p className="text-sm text-ink-400">No photos yet</p>
      </div>
    );
  }

  const [cover, ...rest] = ordered;
  // Two side cells for three or four photos, four for five and up. More than
  // four thumbnails at this size stops being legible.
  const sideCount = ordered.length >= 5 ? 4 : Math.min(rest.length, 2);
  const side = rest.slice(0, sideCount);
  const hidden = ordered.length - 1 - side.length;

  return (
    <>
      <div className="mt-4">
        {/* Desktop: cover plus a column that fills the same height. */}
        <div
          className={cn(
            'hidden gap-2 overflow-hidden rounded-sm sm:grid',
            side.length > 0 ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1',
          )}
        >
          <button
            type="button"
            onClick={() => setOpenAt(0)}
            aria-label={`Open photo 1 of ${ordered.length} full size`}
            className="group relative aspect-video overflow-hidden border border-ink-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            <PropertyImage
              renditions={cover!.renditions}
              storagePath={cover!.storagePath}
              alt={cover!.alt ?? title}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority
              className="transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-sm bg-ink-900/75 px-2.5 py-1.5 text-2xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand aria-hidden className="size-3" />
              View
            </span>
          </button>

          {side.length > 0 && (
            <div
              className={cn(
                'grid gap-2',
                // Two cells stack; four make a square. Either way the column is
                // the full height of the cover, which is what stops the gap.
                side.length <= 2 ? 'grid-rows-2' : 'grid-cols-2 grid-rows-2',
              )}
            >
              {side.map((image, index) => {
                const isLast = index === side.length - 1;
                const showMore = isLast && hidden > 0;

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setOpenAt(index + 1)}
                    aria-label={
                      showMore
                        ? `Open the gallery, ${hidden} more ${hidden === 1 ? 'photo' : 'photos'}`
                        : `Open photo ${index + 2} of ${ordered.length} full size`
                    }
                    className="group relative min-h-0 overflow-hidden border border-ink-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                  >
                    <PropertyImage
                      renditions={image.renditions}
                      storagePath={image.storagePath}
                      alt={image.alt ?? title}
                      fill
                      sizes="25vw"
                      className="transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    {showMore && (
                      <span className="absolute inset-0 flex items-center justify-center bg-ink-900/55 text-base font-semibold text-white">
                        +{hidden}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Phone: one cover, then a strip that scrolls. A 2x2 grid of 90px
            thumbnails on a 360px screen shows nothing useful. */}
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => setOpenAt(0)}
            aria-label={`Open photo 1 of ${ordered.length} full size`}
            className="relative block aspect-4/3 w-full overflow-hidden rounded-sm border border-ink-200"
          >
            <PropertyImage
              renditions={cover!.renditions}
              storagePath={cover!.storagePath}
              alt={cover!.alt ?? title}
              fill
              sizes="100vw"
              priority
            />
            <span className="nums absolute right-2 bottom-2 rounded-sm bg-ink-900/75 px-2 py-1 text-2xs font-medium text-white">
              1 / {ordered.length}
            </span>
          </button>

          {rest.length > 0 && (
            <ul className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
              {rest.map((image, index) => (
                <li key={image.id} className="w-24 shrink-0 snap-start">
                  <button
                    type="button"
                    onClick={() => setOpenAt(index + 1)}
                    aria-label={`Open photo ${index + 2} of ${ordered.length} full size`}
                    className="block aspect-square w-full overflow-hidden rounded-sm border border-ink-200"
                  >
                    <PropertyImage
                      renditions={image.renditions}
                      storagePath={image.storagePath}
                      alt={image.alt ?? title}
                      fill
                      sizes="96px"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {openAt !== null && (
        <Lightbox
          images={ordered}
          title={title}
          index={openAt}
          onIndex={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  );
}

function Lightbox({
  images,
  title,
  index,
  onIndex,
  onClose,
}: {
  images: GalleryImage[];
  title: string;
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<Element | null>(null);

  const go = useCallback(
    (delta: number) => {
      // Wraps, so arrowing past the end returns to the first rather than
      // dead-ending on a button that looks broken.
      onIndex((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndex],
  );

  useEffect(() => {
    restoreTo.current = document.activeElement;
    closeRef.current?.focus();

    // The page behind must not scroll while a full-screen layer is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // Send focus back where it came from, or a keyboard user is dropped at
      // the top of the document every time they close a photo.
      (restoreTo.current as HTMLElement | null)?.focus?.();
    };
  }, [go, onClose]);

  const current = images[index]!;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${images.length}`}
      className="fixed inset-0 z-200 flex flex-col bg-ink-950/95"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
        <p className="nums text-sm">
          {index + 1} / {images.length}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close photos"
          className="rounded-sm p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      {/* Stops a click on the photo itself from closing the layer. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-14"
        onClick={(event) => event.stopPropagation()}
      >
        <PropertyImage
          renditions={current.renditions}
          storagePath={current.storagePath}
          alt={current.alt ?? title}
          fill
          fit="contain"
          sizes="100vw"
          priority
          wrapperClassName="bg-transparent"
        />
      </div>

      {images.length > 1 && (
        <>
          <NavButton side="left" onClick={() => go(-1)} />
          <NavButton side="right" onClick={() => go(1)} />
        </>
      )}
    </div>
  );
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white',
        side === 'left' ? 'left-2 sm:left-4' : 'right-2 sm:right-4',
      )}
    >
      <Icon aria-hidden className="size-6" />
    </button>
  );
}
