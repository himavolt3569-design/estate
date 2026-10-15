import { z } from "zod";

export const MAX_TOUR_SCENES = 8;
export const MAX_TOUR_HOTSPOTS = 12;
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const hotspot = z
  .object({
    id,
    label: z.string().trim().min(1).max(80),
    yaw: z
      .number()
      .finite()
      .min(-Math.PI * 2)
      .max(Math.PI * 2),
    pitch: z
      .number()
      .finite()
      .min(-Math.PI / 2)
      .max(Math.PI / 2),
    targetSceneId: id,
  })
  .strict();

export const tourSchema = z
  .array(
    z
      .object({
        id,
        title: z.string().trim().min(1).max(80),
        imageUrl: z
          .url()
          .max(2000)
          .refine(
            (value) =>
              value.startsWith("https://") ||
              (process.env.NODE_ENV === "development" &&
                process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true" &&
                value.startsWith(
                  "http://127.0.0.1:9198/v0/b/demo-merokotha-feature-tests.appspot.com/o/",
                )),
            "Use an HTTPS image URL.",
          ),
        hotspots: z.array(hotspot).max(MAX_TOUR_HOTSPOTS),
      })
      .strict(),
  )
  .max(MAX_TOUR_SCENES)
  .superRefine((scenes, ctx) => {
    const ids = new Set(scenes.map((scene) => scene.id));
    if (ids.size !== scenes.length)
      ctx.addIssue({ code: "custom", message: "Scene IDs must be unique." });
    for (const scene of scenes) {
      if (
        new Set(scene.hotspots.map((marker) => marker.id)).size !==
        scene.hotspots.length
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Hotspot IDs must be unique within a scene.",
        });
      }
      for (const marker of scene.hotspots) {
        if (
          !ids.has(marker.targetSceneId) ||
          marker.targetSceneId === scene.id
        ) {
          ctx.addIssue({
            code: "custom",
            message: "Link each hotspot to another room in this tour.",
          });
        }
      }
    }
  });

export type TourScene = z.infer<typeof tourSchema>[number];
export function escapeTourLabel(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}
export function readTour(value: unknown): TourScene[] {
  const parsed = tourSchema.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

export function removeTourScene(
  scenes: TourScene[],
  idToRemove: string,
): TourScene[] {
  return scenes
    .filter((scene) => scene.id !== idToRemove)
    .map((scene) => ({
      ...scene,
      hotspots: scene.hotspots.filter(
        (marker) => marker.targetSceneId !== idToRemove,
      ),
    }));
}
