"use client";

import { useEffect, useRef, useState } from "react";
import { Viewer, type events as ViewerEvents } from "@photo-sphere-viewer/core";
import {
  MarkersPlugin,
  type events as MarkerEvents,
} from "@photo-sphere-viewer/markers-plugin";
import { escapeTourLabel } from "@/lib/virtual-tour";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";

export type Hotspot = {
  id: string;
  yaw: number;
  pitch: number;
  targetImageId?: string;
  label?: string;
};

function syncMarkers(viewer: Viewer, hotspots: Hotspot[]) {
  viewer.getPlugin<MarkersPlugin>(MarkersPlugin).setMarkers(
    hotspots.map((marker) => ({
      id: marker.id,
      position: { yaw: marker.yaw, pitch: marker.pitch },
      html:
        '<button type="button" aria-label="' +
        escapeTourLabel(marker.label || "Go to room") +
        '" style="padding:8px 12px;background:white;color:#163660;border:1px solid #b8c7d9;border-radius:8px;box-shadow:0 2px 8px #0003;font-weight:600;cursor:pointer;white-space:nowrap">' +
        escapeTourLabel(marker.label || "Go to room") +
        " →</button>",
      anchor: "center center",
    })),
  );
}

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
  const container = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const callbacks = useRef({ onHotspotClick, onSphereClick });
  const currentHotspots = useRef(hotspots);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    callbacks.current = { onHotspotClick, onSphereClick };
  }, [onHotspotClick, onSphereClick]);
  useEffect(() => {
    currentHotspots.current = hotspots;
    if (viewerRef.current) syncMarkers(viewerRef.current, hotspots);
  }, [hotspots]);
  useEffect(() => {
    let dispose = () => {};
    setError(false);
    setLoading(true);
    // Strict Mode rehearses effect setup/cleanup. Starting a network-backed
    // viewer in that rehearsal can leave Three's shared request queue aborted.
    // Initialize after cleanup has had a chance to cancel the rehearsal.
    const timer = window.setTimeout(() => {
      if (!container.current) return;
      let viewer: Viewer;
      try {
        viewer = new Viewer({
          container: container.current,
          panorama: src,
          navbar: ["zoom", "fullscreen"],
          defaultZoomLvl: 0,
          touchmoveTwoFingers: true,
          mousewheelCtrlKey: true,
          plugins: [[MarkersPlugin, { clickEventOnMarker: false }]],
        });
      } catch {
        setError(true);
        setLoading(false);
        return;
      }
      viewerRef.current = viewer;
      const markers = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
      const select = (event: MarkerEvents.SelectMarkerEvent) =>
        callbacks.current.onHotspotClick?.(event.marker.id);
      const click = (event: ViewerEvents.ClickEvent) => {
        if (!event.data.rightclick)
          callbacks.current.onSphereClick?.(event.data.yaw, event.data.pitch);
      };
      const failed = () => {
        setError(true);
        setLoading(false);
      };
      const ready = () => {
        syncMarkers(viewer, currentHotspots.current);
        setLoading(false);
      };
      markers.addEventListener("select-marker", select);
      viewer.addEventListener("click", click);
      viewer.addEventListener("panorama-error", failed);
      viewer.addEventListener("ready", ready);
      syncMarkers(viewer, currentHotspots.current);
      dispose = () => {
        markers.removeEventListener("select-marker", select);
        viewer.removeEventListener("click", click);
        viewer.removeEventListener("panorama-error", failed);
        viewer.removeEventListener("ready", ready);
        viewer.destroy();
        viewerRef.current = null;
      };
    }, 0);
    return () => {
      window.clearTimeout(timer);
      dispose();
    };
  }, [src]);

  return (
    <div className={"relative " + (className || "")}>
      <div
        ref={container}
        className="h-full w-full"
        aria-label="Interactive 360 degree panorama"
      />
      {loading && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm"
        >
          Loading panorama…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-50 p-6 text-center text-sm text-ink-700"
        >
          <p>The interactive panorama could not load on this device.</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-royal-700 underline"
          >
            Open the panorama photo
          </a>
        </div>
      )}
    </div>
  );
}
