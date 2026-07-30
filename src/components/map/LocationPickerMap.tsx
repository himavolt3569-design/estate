'use client';

import L from 'leaflet';
import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Compass, Locate, MapPin, Loader2 } from 'lucide-react';

// Inject Leaflet CSS dynamically to guarantee styles are loaded
const LEAFLET_CSS_ID = 'leaflet-css-injected';
function injectLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  link.crossOrigin = '';
  document.head.appendChild(link);
}

export type Coordinates = { lat: number; lng: number };

export default function LocationPickerMap({
  initialPosition,
  onChange,
  onAddressResolved,
  className,
}: {
  initialPosition?: Coordinates;
  onChange: (coords: Coordinates) => void;
  onAddressResolved?: (address: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const onChangeRef = useRef(onChange);
  const onAddressRef = useRef(onAddressResolved);
  onChangeRef.current = onChange;
  onAddressRef.current = onAddressResolved;

  const [ready, setReady] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);

  useEffect(() => {
    injectLeafletCSS();
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Reverse geocode center location
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!onAddressRef.current) return;
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          onAddressRef.current(data.display_name);
        }
      }
    } catch {
      // silent fallback
    }
  }, []);

  // Initialize Map with Uber fixed-center pin pattern
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const center = initialPosition || { lat: 27.7172, lng: 85.3240 };

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 16,
      scrollWheelZoom: true,
      zoomControl: false, // We use custom zoom controls or wheel
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      zoomAnimation: true,
      fadeAnimation: true,
    });

    // OpenStreetMap standard tiles — reliable, high details, free
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Map drag events to animate center pin & capture target coordinate
    map.on('movestart', () => {
      setIsMoving(true);
    });

    map.on('moveend', () => {
      setIsMoving(false);
      const newCenter = map.getCenter();
      const coords = { lat: newCenter.lat, lng: newCenter.lng };
      onChangeRef.current(coords);
      reverseGeocode(coords.lat, coords.lng);
    });

    mapRef.current = map;

    // Handle container resizing smoothly
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 800);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Sync external position updates (e.g. from autocomplete search)
  const lastExternalKey = useRef<string>('');
  useEffect(() => {
    if (!mapRef.current || !initialPosition) return;
    const key = `${initialPosition.lat.toFixed(6)},${initialPosition.lng.toFixed(6)}`;
    if (key === lastExternalKey.current) return;
    
    // Check current map center to avoid redundant animation if already close
    const currentCenter = mapRef.current.getCenter();
    const currentKey = `${currentCenter.lat.toFixed(6)},${currentCenter.lng.toFixed(6)}`;
    if (key === currentKey) return;

    lastExternalKey.current = key;
    mapRef.current.flyTo([initialPosition.lat, initialPosition.lng], 16, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [initialPosition?.lat, initialPosition?.lng]);

  // Locate user position button handler
  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setIsGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGeolocating(false);
        const { latitude, longitude } = pos.coords;
        mapRef.current?.flyTo([latitude, longitude], 17, {
          duration: 1.5,
        });
      },
      (err) => {
        setIsGeolocating(false);
        console.warn('Geolocation error:', err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (!ready) {
    return <div className={cn('bg-ink-50 animate-pulse rounded-2xl', className)} style={{ minHeight: 380 }} />;
  }

  return (
    <div className={cn('relative w-full rounded-2xl overflow-hidden border border-ink-200 shadow-soft select-none', className)}>
      {/* Map Viewport Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
        style={{ minHeight: 380 }}
      />

      {/* --- UBER-STYLE FIXED CENTER PIN OVERLAY --- */}
      <div className="absolute inset-0 pointer-events-none z-[400] flex items-center justify-center">
        {/* Ground Pulse / Target Ring */}
        <div 
          className={cn(
            "absolute size-4 rounded-full bg-royal-600/30 border-2 border-royal-600 transition-all duration-300 ease-out flex items-center justify-center",
            isMoving ? "scale-75 opacity-40 shadow-none" : "scale-100 opacity-100 shadow-md animate-ping"
          )}
        />
        <div 
          className={cn(
            "absolute size-2 rounded-full bg-royal-600 transition-all duration-300",
            isMoving ? "scale-50 opacity-50" : "scale-100 opacity-100"
          )}
        />

        {/* Floating Uber Pin */}
        <div 
          className={cn(
            "absolute bottom-1/2 transition-transform duration-300 ease-out flex flex-col items-center origin-bottom",
            isMoving ? "-translate-y-5 scale-110" : "translate-y-0 scale-100"
          )}
        >
          {/* Main Pin Badge */}
          <div className="flex items-center gap-2 bg-royal-900 text-white px-3.5 py-1.5 rounded-full shadow-floating border border-white/20 backdrop-blur-md">
            <MapPin className="size-4 text-emerald-400 fill-emerald-400/20" />
            <span className="text-xs font-semibold tracking-wide">
              {isMoving ? 'Release to set' : 'Exact Property Spot'}
            </span>
          </div>

          {/* Pointer Stem Arrow */}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-royal-900 -mt-0.5" />
        </div>
      </div>

      {/* --- TOP FLOATING INSTRUCTION BADGE --- */}
      <div className="absolute top-4 left-4 z-[400] pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-raised border border-ink-100/80 flex items-center gap-2">
          <Compass className={cn("size-4 text-royal-600", isMoving && "animate-spin")} />
          <span className="text-xs font-medium text-ink-800">
            {isMoving ? 'Positioning exact location...' : 'Drag map under pin to choose spot'}
          </span>
        </div>
      </div>

      {/* --- FLOATING GEOLOCATION BUTTON --- */}
      <div className="absolute bottom-4 right-4 z-[400]">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isGeolocating}
          title="Locate my position"
          className="flex items-center justify-center size-11 rounded-xl bg-white/95 backdrop-blur-md text-ink-800 hover:text-royal-600 hover:bg-white border border-ink-200 shadow-raised transition-all active:scale-95 disabled:opacity-50"
        >
          {isGeolocating ? (
            <Loader2 className="size-5 animate-spin text-royal-600" />
          ) : (
            <Locate className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
}
