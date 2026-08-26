'use client';


import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

import type { MapMarker } from './PropertyMap';

const PropertyMap = dynamic(() => import('./PropertyMap').then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-64 w-full" />,
});


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
  onBoundsChange,
  ...props
}: {
  markers: MapMarker[];
  center: { lat: number; lng: number } | null | undefined;
  zoom?: number;
  className?: string;
  interactive?: boolean;
  approximate?: boolean;
  onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;

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

  return <PropertyMap {...props} center={center} className={className} onBoundsChange={onBoundsChange} />;
}

export type { MapMarker };
