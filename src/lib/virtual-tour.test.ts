import { describe, expect, it } from "vitest";
import {
  escapeTourLabel,
  readTour,
  removeTourScene,
  tourSchema,
  type TourScene,
} from "./virtual-tour";

const rooms: TourScene[] = [
  {
    id: "living",
    title: "Living room",
    imageUrl: "https://example.test/living.jpg",
    hotspots: [
      {
        id: "door",
        label: "Kitchen",
        yaw: 1,
        pitch: 0,
        targetSceneId: "kitchen",
      },
    ],
  },
  {
    id: "kitchen",
    title: "Kitchen",
    imageUrl: "https://example.test/kitchen.jpg",
    hotspots: [],
  },
];
describe("virtual tours", () => {
  it("preserves valid linked rooms and treats older listings as having no tour", () => {
    expect(readTour(rooms)).toEqual(rooms);
    expect(readTour(undefined)).toEqual([]);
  });
  it("rejects invalid coordinates, insecure URLs, and broken scene references", () => {
    expect(
      tourSchema.safeParse([{ ...rooms[0], imageUrl: "javascript:alert(1)" }])
        .success,
    ).toBe(false);
    expect(
      tourSchema.safeParse([
        { ...rooms[0], hotspots: [{ ...rooms[0]!.hotspots[0], pitch: 5 }] },
        rooms[1],
      ]).success,
    ).toBe(false);
    expect(readTour([rooms[0]])).toEqual([]);
    expect(tourSchema.safeParse([...rooms, rooms[0]]).success).toBe(false);
  });
  it("removes inbound links when a panorama is deleted", () => {
    expect(removeTourScene(rooms, "kitchen")).toEqual([
      { ...rooms[0], hotspots: [] },
    ]);
  });
  it("escapes author supplied marker HTML and attribute characters", () => {
    expect(escapeTourLabel('<img src=x onerror="alert(1)"> &')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;",
    );
  });
});
