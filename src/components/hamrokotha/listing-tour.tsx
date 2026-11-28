"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Scan } from "lucide-react";
import { readTour } from "@/lib/virtual-tour";
import { Surface } from "@/components/ui/primitives";
import { useSiteText } from "./site-language";

const PanoramaViewer = dynamic(
  () =>
    import("@/components/media/PanoramaViewer").then(
      (module) => module.PanoramaViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div role="status" className="flex h-full items-center justify-center">
        Loading 360° viewer…
      </div>
    ),
  },
);

export function ListingTour({ scenes: value }: { scenes: unknown }) {
  const t = useSiteText();
  const scenes = readTour(value);
  const [selected, setSelected] = useState("");
  const [started, setStarted] = useState(false);
  const active = scenes.find((scene) => scene.id === selected) || scenes[0];
  if (!active) return null;
  return (
    <Surface className="overflow-hidden p-5 sm:p-7">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <Scan aria-hidden className="size-6 text-royal-700" />
        {t("360° virtual tour", "३६०° भर्चुअल भ्रमण")}
      </h2>
      <p className="mt-2 text-sm text-ink-500">
        {t(
          "Look around each room. Select a room below or follow a hotspot to explore.",
          "प्रत्येक कोठा घुमाएर हेर्नुहोस्। तलको कोठा वा हटस्पट छान्नुहोस्।",
        )}
      </p>
      <div className="mt-5 h-[280px] overflow-hidden rounded-xl border border-ink-200 bg-ink-50 sm:h-[420px]">
        {started ? (
          <PanoramaViewer
            src={active.imageUrl}
            className="h-full w-full"
            hotspots={active.hotspots}
            onHotspotClick={(id) => {
              const marker = active.hotspots.find((item) => item.id === id);
              if (marker) setSelected(marker.targetSceneId);
            }}
          />
        ) : (
          <button
            type="button"
            aria-label={t("Start virtual tour", "भर्चुअल भ्रमण सुरु गर्नुहोस्")}
            onClick={() => setStarted(true)}
            className="relative h-full w-full"
          >
            <img
              src={active.imageUrl}
              alt={active.title}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-ink-950/30">
              <span className="rounded-full bg-white px-5 py-3 font-semibold text-royal-800 shadow-md">
                {t("Start virtual tour", "भर्चुअल भ्रमण सुरु गर्नुहोस्")}
              </span>
            </span>
          </button>
        )}
      </div>
      <div
        aria-label={t("Tour rooms", "भ्रमणका कोठाहरू")}
        className="mt-4 flex flex-wrap gap-2"
      >
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            aria-pressed={scene.id === active.id}
            onClick={() => {
              setSelected(scene.id);
              setStarted(true);
            }}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${scene.id === active.id ? "border-royal-700 bg-royal-700 text-white" : "border-ink-200 bg-white text-ink-700"}`}
          >
            {scene.title}
          </button>
        ))}
      </div>
      {started && (
        <p className="mt-3 text-xs text-ink-500">
          {t(
            "Drag to look around. On a phone, use two fingers. Use Ctrl + scroll to zoom.",
            "घुमाएर हेर्न तान्नुहोस्। फोनमा दुई औँला प्रयोग गर्नुहोस्। जुम गर्न Ctrl + स्क्रोल प्रयोग गर्नुहोस्।",
          )}
        </p>
      )}
    </Surface>
  );
}
