'use client';


import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

import 'leaflet/dist/leaflet.css';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
  verified?: boolean;
};


function priceIcon(label: string, verified: boolean) {
  const el = document.createElement('div');

  el.className = [
    'flex items-center gap-1 whitespace-nowrap border px-2 py-1',
    'nums text-[11px] font-medium tracking-[-0.01em]',
    verified
      ? 'border-emerald-700 bg-emerald-700 text-white'
      : 'border-royal-800 bg-white text-royal-900',
  ].join(' ');
  el.textContent = label;

  return L.divIcon({
    html: el.outerHTML,
    className: 'kitta-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function PropertyMap({
  markers,
  center,
  zoom = 14,
  className,
  interactive = true,
  approximate = false,
  onBoundsChange,
}: {
  markers: MapMarker[];
  center: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  interactive?: boolean;
  approximate?: boolean;
  onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      scrollWheelZoom: false,
      dragging: interactive,
      zoomControl: interactive,
      attributionControl: true,
    });


    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });


    let failures = 0;
    tiles.on('tileerror', () => {
      failures += 1;
      if (failures >= 4) setTilesFailed(true);
    });
    tiles.on('tileload', () => {
      failures = 0;
      setTilesFailed(false);
    });
    tiles.addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    let moveTimeout: ReturnType<typeof setTimeout>;
    map.on('moveend', () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        if (!onBoundsChangeRef.current) return;
        const b = map.getBounds();
        onBoundsChangeRef.current({
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLng: b.getWest(),
          maxLng: b.getEast(),
        });
      }, 300);
    });


    const invalidate = () => map.invalidateSize({ animate: false });
    const frame = requestAnimationFrame(invalidate);
    const observer = new ResizeObserver(invalidate);
    observer.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (approximate) {
      L.circle([center.lat, center.lng], {
        radius: 300,
        color: '#1c3d73',
        weight: 1,
        fillColor: '#1c3d73',
        fillOpacity: 0.07,
      }).addTo(layer);
    }

    for (const marker of markers) {
      const m = L.marker([marker.lat, marker.lng], {
        icon: priceIcon(marker.label, marker.verified ?? false),
        keyboard: true,
        alt: marker.label,
      });

      if (marker.href) {
        m.on('click', () => {
          window.location.href = marker.href!;
        });
      }

      m.addTo(layer);
    }

    if (markers.length > 1) {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])).pad(0.2));
    } else {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [markers, center.lat, center.lng, approximate]);

  return (
    <div className="relative isolate size-full">
      <div
        ref={containerRef}

        className={`min-h-64 w-full ${className ?? ''}`}
        role="application"
        aria-label="Map of property locations"
      />

      {tilesFailed && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] bg-white/95 px-4 py-3 text-center text-xs text-ink-600"
        >
          The map background could not be loaded. The location is still correct.
        </div>
      )}
    </div>
  );
}

export default PropertyMap;
