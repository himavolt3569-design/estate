'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Listing } from '@/lib/firebase/types';
import { money } from './listing-card';
import { isForSale, listingPrice } from '@/lib/listing-commerce';

export type MapArea = { north: number; south: number; east: number; west: number };
export const inMapArea = (listing: Listing, area: MapArea) => Boolean(listing.geoPoint && listing.geoPoint.latitude >= area.south && listing.geoPoint.latitude <= area.north && listing.geoPoint.longitude >= area.west && listing.geoPoint.longitude <= area.east);

export default function MapView({ listings, selectedId, onSelect, onBoundsChange }: { listings: Listing[]; selectedId?: string; onSelect?: (id: string) => void; onBoundsChange?: (bounds: MapArea) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const fitted = useRef(false);
  const callbacks = useRef({ onSelect, onBoundsChange });
  callbacks.current = { onSelect, onBoundsChange };
  const markers = useRef(new Map<string, L.Marker>());
  useEffect(() => {
    if (!container.current) return;
    const current = L.map(container.current, { scrollWheelZoom: false, zoomControl: true }).setView([27.7172, 85.324], 12);
    map.current = current;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(current);
    const reportBounds = () => { const bounds = current.getBounds(); callbacks.current.onBoundsChange?.({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() }); };
    current.on('moveend', reportBounds); reportBounds();
    const resize = new ResizeObserver(() => current.invalidateSize()); resize.observe(container.current);
    return () => { resize.disconnect(); current.remove(); map.current = null; fitted.current = false; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const points = listings.filter(item => item.geoPoint && Number.isFinite(item.geoPoint.latitude) && Number.isFinite(item.geoPoint.longitude)).map(item => {
      const point = item.geoPoint!;
      const label = document.createElement('span'); label.className = 'map-price'; label.textContent = money(listingPrice(item));
      const marker = L.marker([point.latitude, point.longitude], { icon: L.divIcon({ html: label, className: 'map-price-marker', iconSize: [105, 34], iconAnchor: [52, 38] }), title: item.title, keyboard: true }).addTo(map.current!);
      const wrapper = document.createElement('div'); wrapper.className = 'map-listing-popup';
      const photos = document.createElement('div'); photos.className = 'map-popup-photos';
      (item.photoUrls || []).slice(0, 3).forEach(url => { const image = document.createElement('img'); image.src = url; image.alt = ''; image.loading = 'lazy'; photos.append(image); });
      const title = document.createElement('strong'); title.textContent = item.title;
      const price = document.createElement('p'); price.textContent = `${money(listingPrice(item))} ${isForSale(item) ? 'asking price' : '/ month'}`;
      const link = document.createElement('a'); link.href = `/listing/${encodeURIComponent(item.id)}`; link.textContent = 'View rental →';
      wrapper.append(photos, title, price, link); marker.bindPopup(wrapper, { minWidth: 220, maxWidth: 270 });
      marker.on('click', () => callbacks.current.onSelect?.(item.id)); markers.current.set(item.id, marker); return marker;
    });
    if (points.length && !fitted.current) { map.current.fitBounds(L.featureGroup(points).getBounds().pad(0.18), { maxZoom: 15 }); fitted.current = true; }
    return () => { points.forEach(point => point.remove()); markers.current.clear(); };
  }, [listings]);
  useEffect(() => {
    markers.current.forEach((marker, id) => marker.getElement()?.classList.toggle('is-selected', id === selectedId));
    const marker = selectedId ? markers.current.get(selectedId) : undefined;
    if (marker) { marker.openPopup(); map.current?.panTo(marker.getLatLng(), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches }); }
  }, [selectedId, listings]);
  return <div className="rental-map-shell"><div ref={container} className="rental-map" aria-label="Zoomable rental map. Use the plus and minus controls to zoom." /><p className="map-interaction-hint">Drag to explore · Pinch or use + / − to zoom</p></div>;
}
