'use client';

// Client boundary: Leaflet touches `window` at import time and manages its own
// DOM. It is loaded through next/dynamic with ssr:false at every call site, so
// none of this reaches the server bundle or the initial payload of a route that
// does not show a map.

import L from 'leaflet';
import { useEffect, useRef } from 'react';

import 'leaflet/dist/leaflet.css';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
  verified?: boolean;
};

/**
 * Price markers are divIcons styled with our own tokens rather than Leaflet's
 * default teardrop pin. A map full of stock pins is the single thing that makes
 * a property site look like every other property site.
 */
function priceIcon(label: string, verified: boolean) {
  const el = document.createElement('div');
  // Solid fill rather than an outline: at map scale a bordered white chip
  // disappears against pale tiles, and the verified/unverified distinction has
  // to survive being 11px on a phone.
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
  /** Draws the ~300m circle a vendor chose instead of an exact point. */
  approximate = false,
}: {
  markers: MapMarker[];
  center: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  interactive?: boolean;
  approximate?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

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

    // OpenStreetMap standard tiles. Free, no key, no per-tile billing. The
    // attribution control is a licence obligation under ODbL, not a nicety.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // Deliberately mount-only: subsequent marker changes are handled below
    // rather than by tearing down and rebuilding the map.
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
    }
  }, [markers, center.lat, center.lng, approximate]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label="Map of property locations"
    />
  );
}

export default PropertyMap;
