'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchPropertiesAction } from '../actions';
import type { PropertyCardDTO, SearchFilters } from '../types';
import { PropertyCard, PropertyCardSkeleton } from './PropertyCard';

/**
 * The filters have to come from the caller. They used to be hardcoded here as
 * `{ verified_only: true, sort: 'newest' }`, which meant page two of any rail
 * was fetched with a different query than page one — so scrolling the home page
 * either repeated rows or produced none at all, depending on the rail.
 */
export function InfiniteScrollPropertyGrid({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: PropertyCardDTO[];
  initialCursor: string | null;
  filters: SearchFilters;
}) {
  const [items, setItems] = useState<PropertyCardDTO[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  /*
   * The observer can fire twice for one intersection, and `loading` is state, so
   * the second call reads the old value and fetches the same cursor again — the
   * page then shows every listing twice. A ref is checked and set in the same
   * tick, which is what makes the guard actually hold.
   */
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(false);
    try {
      const result = await fetchPropertiesAction(filters, cursor);
      setItems((prev) => {
        // Belt and braces against a repeated cursor: never render the same
        // listing twice, whatever the server returned.
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...result.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(result.nextCursor);
    } catch (cause) {
      console.error('[infinite_scroll]', cause instanceof Error ? cause.message : cause);
      setError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [cursor, filters]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '400px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {items.map((property, index) => (
          <PropertyCard key={property.id} property={property} priority={index < 4} />
        ))}
      </div>

      {loading && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <PropertyCardSkeleton />
          <PropertyCardSkeleton />
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-clay-200 bg-clay-50 px-4 py-3 text-center">
          <p className="text-sm text-clay-900">More listings could not be loaded.</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="mt-2 text-sm font-semibold text-royal-700 underline underline-offset-2 hover:text-royal-800"
          >
            Try again
          </button>
        </div>
      )}

      {cursor && !error && <div ref={observerTarget} className="h-10 w-full" aria-hidden />}
    </div>
  );
}
