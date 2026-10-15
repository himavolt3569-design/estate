'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Listing } from '@/lib/firebase/types';
import { money } from './listing-card';

export default function MapView({ listings }: { listings: Listing[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const current = L.map(container.current).setView([27.7172,85.324],11);
    map.current = current;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(current);
    return () => { current.remove(); map.current=null; };
  },[]);
  useEffect(() => {
    if (!map.current) return;
    const points=listings.filter(item => item.geoPoint).map(item => {
      const p=item.geoPoint!;
      const marker=L.circleMarker([p.latitude,p.longitude],{radius:9,color:'#d81b45',fillColor:'#d81b45',fillOpacity:0.9}).addTo(map.current!);
      const wrapper=document.createElement('div');
      const title=document.createElement('strong'); title.textContent=item.title;
      const price=document.createElement('p'); price.textContent=money(item.rentPerMonth);
      const link=document.createElement('a'); link.href=`/listing/${encodeURIComponent(item.id)}`; link.textContent='View rental';
      wrapper.append(title,price,link); marker.bindPopup(wrapper);
      return marker;
    });
    if (points.length) map.current.fitBounds(L.featureGroup(points).getBounds().pad(0.2));
    return () => points.forEach(point => point.remove());
  },[listings]);
  return <div ref={container} className="h-[500px] w-full rounded-xl border border-ink-100" aria-label="Rental map" />;
}
