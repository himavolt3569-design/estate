'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { Hotspot } from '@/components/media/PanoramaViewer';
import { PanoramaViewer } from '@/components/media/PanoramaViewer';
import type { UploadedImage } from './PhotoUploader';
import { saveImageHotspots } from '../actions';
import { Label, Input } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

export function TourBuilder({
  propertyId,
  images,
  onChange,
}: {
  propertyId: string;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
}) {
  const [activeId, setActiveId] = useState<string>(images.find((i) => i.is360)?.id || '');
  const [pendingMarker, setPendingMarker] = useState<{ yaw: number; pitch: number } | null>(null);
  const [markerLabel, setMarkerLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const activeImage = images.find((i) => i.id === activeId);

  async function handleAddHotspot() {
    if (!activeImage || !pendingMarker) return;
    setBusy(true);

    const newHotspot: Hotspot = {
      id: crypto.randomUUID(),
      yaw: pendingMarker.yaw,
      pitch: pendingMarker.pitch,
      label: markerLabel.trim() || 'Go here',
    };

    const nextHotspots = [...(activeImage as any).hotspots || [], newHotspot];

    const result = await saveImageHotspots({
      id: activeImage.id,
      propertyId,
      hotspots: nextHotspots,
    });

    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success('Marker added!');
      onChange(images.map((i) => (i.id === activeImage.id ? { ...i, hotspots: nextHotspots } : i)));
      setPendingMarker(null);
      setMarkerLabel('');
    }
    setBusy(false);
  }

  if (!activeImage) return null;

  return (
    <div className="rounded-xl border border-royal-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-ink-900">Virtual Tour Builder</h3>
      <p className="mt-1 text-sm text-ink-500">
        Connect your 360° photos together! Click anywhere on the panorama below to drop a link.
      </p>

      <div className="mt-6 flex gap-4">
        {images.filter(i => i.is360).map(img => (
          <button
            key={img.id}
            onClick={() => setActiveId(img.id)}
            className={`h-16 w-16 overflow-hidden rounded-md border-2 ${
              activeId === img.id ? 'border-royal-500' : 'border-transparent'
            }`}
          >
            <img src={img.url} className="h-full w-full object-cover" alt="" />
          </button>
        ))}
      </div>

      <div className="mt-4 relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50 aspect-video">
        <PanoramaViewer
          src={activeImage.url}
          className="h-full w-full"
          hotspots={(activeImage as any).hotspots || []}
          onSphereClick={(yaw, pitch) => {
            if (!pendingMarker) setPendingMarker({ yaw, pitch });
          }}
        />

        {pendingMarker && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
            <div className="w-80 rounded-xl bg-white p-5 shadow-lg">
              <h4 className="font-semibold text-ink-900">Add a Tour Link</h4>
              <p className="mt-1 text-xs text-ink-500">
                Where does this take the viewer?
              </p>
              
              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="marker-label">Label</Label>
                  <Input
                    id="marker-label"
                    value={markerLabel}
                    onChange={(e: any) => setMarkerLabel(e.target.value)}
                    placeholder="e.g. Kitchen, Balcony"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setPendingMarker(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={handleAddHotspot} disabled={busy}>
                  {busy ? 'Saving...' : 'Add Link'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
