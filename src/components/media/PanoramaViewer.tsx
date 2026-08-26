'use client';

import { useEffect, useRef } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';

export function PanoramaViewer({
  src,
  className,
}: {
  src: string;
  className?: string;
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
    });

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [src]);

  return <div ref={containerRef} className={className} />;
}
