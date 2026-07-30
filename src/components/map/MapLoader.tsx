'use client';

// Client boundary whose only job is to hold the `ssr: false` dynamic import.
//
// Leaflet reads `window` at module scope, so it cannot be server-rendered, and
// Next does not allow `ssr: false` inside a Server Component. This wrapper is
// the seam: server pages import MapLoader, and Leaflet stays out of the server
// bundle and out of the route's initial JavaScript.

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/primitives';

import type { MapMarker } from './PropertyMap';

const PropertyMap = dynamic(() => import('./PropertyMap').then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-72 w-full" />,
});

export function MapLoader(props: {
  markers: MapMarker[];
  center: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  interactive?: boolean;
  approximate?: boolean;
}) {
  return <PropertyMap {...props} />;
}

export type { MapMarker };
