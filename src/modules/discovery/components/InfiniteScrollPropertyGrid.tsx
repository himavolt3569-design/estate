'use client';

import { useEffect, useState, useRef } from 'react';
import { PropertyCard, PropertyCardSkeleton } from './PropertyCard';
import type { PropertyCardDTO } from '../types';
import { fetchPropertiesAction } from '../actions';

export function InfiniteScrollPropertyGrid({
  initialItems,
  initialCursor,
}: {
  initialItems: PropertyCardDTO[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState<PropertyCardDTO[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialCursor !== null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, cursor]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const result = await fetchPropertiesAction({ verified_only: true, sort: 'newest' }, cursor);
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.nextCursor !== null);
    } catch (error) {
      console.error('Failed to fetch more properties', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
        {items.map((property, index) => (
          <PropertyCard key={`${property.id}-${index}`} property={property} priority={index < 4} />
        ))}
      </div>
      
      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 mt-6">
          <PropertyCardSkeleton />
          <PropertyCardSkeleton />
        </div>
      )}

      {hasMore && (
        <div ref={observerTarget} className="h-10 w-full" />
      )}
    </div>
  );
}
