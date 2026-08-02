'use client';

// Client boundary: Leaflet touches `window` at import time and manages its own
// DOM. It is loaded through next/dynamic with ssr:false at every call site, so
// none of this reaches the server bundle or the initial payload of a route that
// does not show a map.

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

/**
 * Price markers are divIcons styled with our own tokens rather than Leaflet's
 * default teardrop pin. A map full of stock pins is the single thing that makes
 * a property site look like every other property site.
 *
 * Using divIcon rather than L.Icon also sidesteps Leaflet's default marker
 * images, whose URLs are resolved relative to the CSS file and 404 under a
 * bundler unless they are patched by hand. There is no icon asset to lose in a
 * production build because there is no icon asset.
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
  const [tilesFailed, setTilesFailed] = useState(false);

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
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    // A tile that never arrives leaves an empty grey box with no explanation.
    // One failure is a dropped request and Leaflet retries; a whole screen of
    // them is an outage, a blocked host, or no connection, and the visitor
    // should be told rather than left looking at nothing.
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

    /*
     * Leaflet measures its container once, at construction. Anything that gives
     * the container its real size later — a tab or accordion opening, a font
     * swapping in, a sidebar settling, or simply this component mounting before
     * layout has run after a client-side navigation — leaves the map convinced
     * it is the size it was born at, and it paints one column of tiles into the
     * corner of a full-width box.
     *
     * A ResizeObserver is the general fix: it covers every one of those causes
     * without needing to know which one happened. The rAF pass handles the
     * common case where the container is already correct but was measured a
     * frame too early.
     */
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
    } else {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [markers, center.lat, center.lng, approximate]);

  return (
    <div className="relative isolate size-full">
      <div
        ref={containerRef}
        // The height comes from the call site, but a map with no height is an
        // invisible map, so there is a floor under it either way.
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
