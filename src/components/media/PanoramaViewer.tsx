'use client';

import { useEffect, useRef } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

export type Hotspot = {
  id: string;
  yaw: number;
  pitch: number;
  targetImageId?: string;
  label?: string;
};

export function PanoramaViewer({
  src,
  className,
  hotspots = [],
  onHotspotClick,
  onSphereClick,
}: {
  src: string;
  className?: string;
  hotspots?: Hotspot[];
  onHotspotClick?: (id: string) => void;
  onSphereClick?: (yaw: number, pitch: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    viewerRef.current = new Viewer({
      container: containerRef.current,
      panorama: src,
      navbar: ['zoom', 'fullscreen'],
      defaultZoomLvl: 0,
      touchmoveTwoFingers: true,
      mousewheelCtrlKey: true,
      plugins: [[MarkersPlugin, {}]],
    });

    const viewer = viewerRef.current;
    const markersPlugin = viewer.getPlugin(MarkersPlugin) as MarkersPlugin;

    const onSelect = (e: any) => {
      if (onHotspotClick) onHotspotClick(e.marker.id);
    };

    const onClick = (e: any) => {
      if (!e.data.rightclick && onSphereClick) {
        onSphereClick(e.data.yaw, e.data.pitch);
      }
    };

    markersPlugin.addEventListener('select-marker', onSelect);
    viewer.addEventListener('click', onClick);

    return () => {
      markersPlugin.removeEventListener('select-marker', onSelect);
      viewer.removeEventListener('click', onClick);
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [src]); // Re-create viewer only on src change

  // Sync markers when hotspots prop changes
  useEffect(() => {
    if (!viewerRef.current) return;
    const markersPlugin = viewerRef.current.getPlugin(MarkersPlugin) as MarkersPlugin;
    markersPlugin.clearMarkers();
    
    hotspots.forEach((h) => {
      markersPlugin.addMarker({
        id: h.id,
        position: { yaw: h.yaw, pitch: h.pitch },
        html: h.label
          ? `<div class="px-2 py-1 bg-white/95 text-ink-900 rounded-md shadow border border-ink-200 font-semibold text-sm cursor-pointer whitespace-nowrap hover:bg-white">${h.label}</div>`
          : `<div class="w-4 h-4 bg-royal-600 rounded-full border-2 border-white shadow cursor-pointer hover:scale-125 transition-transform"></div>`,
        size: { width: 0, height: 0 },
        anchor: 'center center',
      });
    });
  }, [hotspots]);

  return <div ref={containerRef} className={className} />;
}
