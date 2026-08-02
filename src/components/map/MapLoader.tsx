'use client';

// Client boundary whose only job is to hold the `ssr: false` dynamic import.
//
// Leaflet reads `window` at module scope, so it cannot be server-rendered, and
// Next does not allow `ssr: false` inside a Server Component. This wrapper is
// the seam: server pages import MapLoader, and Leaflet stays out of the server
// bundle and out of the route's initial JavaScript.

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

import type { MapMarker } from './PropertyMap';

const PropertyMap = dynamic(() => import('./PropertyMap').then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-64 w-full" />,
});

/** 0,0 is in the Gulf of Guinea. It means "nothing was saved", not a location. */
function hasCoordinates(center: { lat: number; lng: number } | null | undefined): center is {
  lat: number;
  lng: number;
} {
  if (!center) return false;
  const { lat, lng } = center;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function MapLoader({
  center,
  className,
  fallbackLabel = 'No location was saved for this listing.',
  ...props
}: {
  markers: MapMarker[];
  center: { lat: number; lng: number } | null | undefined;
  zoom?: number;
  className?: string;
  interactive?: boolean;
  approximate?: boolean;
  /** Shown in place of the map when there is nothing to centre on. */
  fallbackLabel?: string;
}) {
  if (!hasCoordinates(center)) {
    return (
      <div
        role="status"
        className={cn(
          'flex min-h-64 w-full items-center justify-center bg-ink-50 px-6 text-center text-sm text-ink-500',
          className,
        )}
      >
        {fallbackLabel}
      </div>
    );
  }

  return <PropertyMap {...props} center={center} className={className} />;
}

export type { MapMarker };
