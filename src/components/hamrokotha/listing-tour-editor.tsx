"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Scan, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Surface } from "@/components/ui/primitives";
import { uploadImages } from "@/lib/firebase/actions";
import { saveListingTour } from "@/lib/firebase/property-features";
import type { Listing } from "@/lib/firebase/types";
import {
  MAX_TOUR_HOTSPOTS,
  MAX_TOUR_SCENES,
  readTour,
  removeTourScene,
  type TourScene,
} from "@/lib/virtual-tour";
import { useSiteText } from "./site-language";

const PanoramaViewer = dynamic(
  () =>
    import("@/components/media/PanoramaViewer").then(
      (module) => module.PanoramaViewer,
    ),
  { ssr: false },
);

export function ListingTourEditor({ listing }: { listing: Listing }) {
  const t = useSiteText();
  const [scenes, setScenes] = useState<TourScene[]>(() =>
    readTour(listing.tourScenes),
  );
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState<{ yaw: number; pitch: number } | null>(
    null,
  );
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!dirty) setScenes(readTour(listing.tourScenes));
  }, [listing.tourScenes, dirty]);
  const active = scenes.find((scene) => scene.id === selected) || scenes[0];
  const change = (next: TourScene[]) => {
    setScenes(next);
    setDirty(true);
  };
  const add = async (file?: File) => {
    if (!file || busy) return;
    if (scenes.length >= MAX_TOUR_SCENES) {
      toast.error(`A tour can have up to ${MAX_TOUR_SCENES} rooms.`);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size >= 5 * 1024 * 1024
    ) {
      toast.error("Choose a JPG, PNG or WebP panorama smaller than 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const ratio = bitmap.width / bitmap.height;
      bitmap.close();
      if (ratio < 1.9 || ratio > 2.1)
        throw new Error(
          "Use a full equirectangular panorama with a 2:1 width-to-height ratio.",
        );
      const [imageUrl] = await uploadImages(`listings/${listing.id}`, [
        new File([file], `tour-${file.name}`, { type: file.type }),
      ]);
      const scene: TourScene = {
        id: crypto.randomUUID(),
        title: `Room ${scenes.length + 1}`,
        imageUrl: imageUrl!,
        hotspots: [],
      };
      change([...scenes, scene]);
      setSelected(scene.id);
      setPending(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not upload panorama.",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await saveListingTour(listing, scenes);
      setDirty(false);
      setPending(null);
      if (result.cleanupFailed)
        toast.warning(
          "Tour saved. Some removed images could not be cleaned up.",
        );
      else
        toast.success(
          t(
            "Virtual tour saved. Rental sent for review.",
            "भर्चुअल भ्रमण सेभ भयो। विज्ञापन समीक्षाका लागि पठाइयो।",
          ),
        );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not save tour.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Surface className="mx-auto mt-6 max-w-5xl space-y-5 p-6 md:p-8">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <Scan aria-hidden className="size-6 text-royal-700" />
          {t("Build a 360° virtual tour", "३६०° भर्चुअल भ्रमण बनाउनुहोस्")}
        </h2>
        <p className="mt-2 text-sm text-ink-500">
          {t(
            "Upload 2:1 panorama photos under 5 MB. Name each room, then click the panorama to add a link to another room. Saving sends the rental back for review.",
            "५ MB भन्दा सानो २:१ पानोरामा फोटो राख्नुहोस्। कोठाको नाम दिनुहोस् र अर्को कोठाको लिङ्क राख्न फोटोमा क्लिक गर्नुहोस्। सेभ गरेपछि विज्ञापन फेरि समीक्षामा जान्छ।",
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {scenes.map((scene) => (
          <Button
            key={scene.id}
            type="button"
            size="sm"
            variant={scene.id === active?.id ? "primary" : "secondary"}
            disabled={busy}
            aria-pressed={scene.id === active?.id}
            onClick={() => {
              setSelected(scene.id);
              setPending(null);
            }}
          >
            {scene.title || t("Unnamed room", "नाम नभएको कोठा")}
          </Button>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={busy || scenes.length >= MAX_TOUR_SCENES}
          onClick={() => fileInput.current?.click()}
        >
          {busy
            ? t("Working…", "प्रक्रिया हुँदैछ…")
            : t("Add panorama", "पानोरामा थप्नुहोस्")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            void add(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {active && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label={t("Room name", "कोठाको नाम")}
              htmlFor="tour-room-name"
              className="min-w-48 flex-1"
            >
              <Input
                id="tour-room-name"
                value={active.title}
                maxLength={80}
                disabled={busy}
                onChange={(event) =>
                  change(
                    scenes.map((scene) =>
                      scene.id === active.id
                        ? { ...scene, title: event.target.value }
                        : scene,
                    ),
                  )
                }
              />
            </Field>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm("Remove this panorama and links to this room?")
                ) {
                  change(removeTourScene(scenes, active.id));
                  setPending(null);
                }
              }}
            >
              <Trash2 aria-hidden className="size-4" />
              {t("Remove room", "कोठा हटाउनुहोस्")}
            </Button>
          </div>
          <div className="h-[280px] overflow-hidden rounded-xl border border-ink-200 sm:h-[420px]">
            <PanoramaViewer
              src={active.imageUrl}
              className="h-full w-full"
              hotspots={active.hotspots}
              onHotspotClick={(id) => {
                const marker = active.hotspots.find((item) => item.id === id);
                if (marker) {
                  setSelected(marker.targetSceneId);
                  setPending(null);
                }
              }}
              onSphereClick={(yaw, pitch) => {
                if (
                  !busy &&
                  scenes.length > 1 &&
                  active.hotspots.length < MAX_TOUR_HOTSPOTS
                ) {
                  setPending({ yaw, pitch });
                  setTarget(scenes.find((scene) => scene.id !== active.id)!.id);
                  setLabel("");
                }
              }}
            />
          </div>
          {scenes.length === 1 && (
            <p className="text-sm text-ink-500">
              {t(
                "Add a second room to create navigation hotspots.",
                "नेभिगेसन हटस्पट बनाउन दोस्रो कोठा थप्नुहोस्।",
              )}
            </p>
          )}
          {pending && (
            <div className="grid gap-3 rounded-xl border border-royal-200 bg-royal-50 p-4 sm:grid-cols-2">
              <Field
                label={t("Link to room", "कोठामा लिङ्क")}
                htmlFor="tour-target"
              >
                <Select
                  id="tour-target"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  {scenes
                    .filter((scene) => scene.id !== active.id)
                    .map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.title}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field
                label={t("Hotspot label", "हटस्पटको नाम")}
                htmlFor="tour-label"
              >
                <Input
                  id="tour-label"
                  value={label}
                  maxLength={80}
                  placeholder={
                    scenes.find((scene) => scene.id === target)?.title
                  }
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button
                  type="button"
                  disabled={busy || !target}
                  onClick={() => {
                    const title =
                      label.trim() ||
                      scenes.find((scene) => scene.id === target)?.title ||
                      "Go to room";
                    change(
                      scenes.map((scene) =>
                        scene.id === active.id
                          ? {
                              ...scene,
                              hotspots: [
                                ...scene.hotspots,
                                {
                                  id: crypto.randomUUID(),
                                  ...pending,
                                  label: title,
                                  targetSceneId: target,
                                },
                              ],
                            }
                          : scene,
                      ),
                    );
                    setPending(null);
                  }}
                >
                  {t("Add hotspot", "हटस्पट थप्नुहोस्")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPending(null)}
                >
                  {t("Cancel", "रद्द गर्नुहोस्")}
                </Button>
              </div>
            </div>
          )}
          {active.hotspots.length > 0 && (
            <ul className="divide-y divide-ink-100">
              {active.hotspots.map((marker) => (
                <li
                  key={marker.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    {marker.label} →{" "}
                    {
                      scenes.find((scene) => scene.id === marker.targetSceneId)
                        ?.title
                    }
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Remove hotspot ${marker.label}`}
                    className="rounded p-2 text-clay-700"
                    onClick={() =>
                      change(
                        scenes.map((scene) =>
                          scene.id === active.id
                            ? {
                                ...scene,
                                hotspots: scene.hotspots.filter(
                                  (item) => item.id !== marker.id,
                                ),
                              }
                            : scene,
                        ),
                      )
                    }
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {t("Save tour", "भ्रमण सेभ गर्नुहोस्")}
        </Button>
        <p role="status" className="text-xs text-ink-500">
          {dirty
            ? t("Unsaved tour changes", "भ्रमणका परिवर्तन सेभ भएका छैनन्")
            : t("Tour is up to date", "भ्रमण अद्यावधिक छ")}
        </p>
      </div>
    </Surface>
  );
}
