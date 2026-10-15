import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import type { Inquiry, Listing, ListingVisit } from "./firebase/types";
import {
  analyticsStart,
  nepalDay,
  referrerHost,
  summarizeAnalytics,
  visitKey,
} from "./listing-analytics";

const listing = {
  id: "a",
  ownerId: "owner",
  title: "Room",
  viewCount: 50,
} as Listing;
const stamp = (iso: string) => Timestamp.fromDate(new Date(iso));
const visit = (id: string, visitorId: string, iso: string) =>
  ({
    id,
    listingId: "a",
    visitorId,
    device: "mobile",
    referrer: "direct",
    createdAt: stamp(iso),
  }) as ListingVisit;
describe("listing analytics", () => {
  it("groups events across the Nepal midnight boundary and zero fills missing days", () => {
    const now = new Date("2026-10-14T00:10:00+05:45");
    expect(nepalDay(now)).toBe("2026-10-14");
    expect(analyticsStart(now, 2).toISOString()).toBe(
      "2026-10-12T18:15:00.000Z",
    );
    const result = summarizeAnalytics(
      [listing],
      [
        visit("v1", "browser", "2026-10-13T18:14:00Z"),
        visit("v2", "browser", "2026-10-13T18:20:00Z"),
      ],
      [],
      2,
      now,
    );
    expect(result.viewSeries).toEqual([
      { date: "2026-10-13", value: 1 },
      { date: "2026-10-14", value: 1 },
    ]);
    expect(result.uniqueVisitors).toBe(1);
    expect(result.lifetimeViews).toBe(50);
  });
  it("excludes future, old and other-owner records while counting inquiry outcomes", () => {
    const now = new Date("2026-10-14T12:00:00+05:45");
    const inquiries: Inquiry[] = [
      {
        id: "i",
        listingId: "a",
        listingTitle: "Room",
        ownerId: "owner",
        customerId: "customer",
        customerName: "Renter",
        message: "Is this available?",
        status: "accepted",
        createdAt: stamp("2026-10-14T00:00:00Z"),
      },
    ];
    const result = summarizeAnalytics(
      [listing],
      [
        visit("new", "u", "2026-10-14T00:00:00Z"),
        visit("old", "u", "2025-01-01T00:00:00Z"),
        visit("future", "u", "2027-01-01T00:00:00Z"),
        { ...visit("other", "x", "2026-10-14T00:00:00Z"), listingId: "b" },
      ],
      inquiries,
      7,
      now,
    );
    expect(result.views).toBe(1);
    expect(result.accepted).toBe(1);
    expect(result.inquiryRate).toBe(100);
    expect(
      result.inquirySeries.reduce((sum, point) => sum + point.value, 0),
    ).toBe(1);
    expect(
      summarizeAnalytics([listing], [], [], 7, now).inquiryRate,
    ).toBeNull();
  });
  it("deduplicates visit IDs in a 30 minute window and strips referrer paths", () => {
    expect(visitKey("a", "browser", 1000)).toBe(visitKey("a", "browser", 1001));
    expect(visitKey("a", "browser", 1000)).not.toBe(
      visitKey("a", "browser", 1801000),
    );
    expect(
      referrerHost("https://search.example/path?private=value", "site.example"),
    ).toBe("search.example");
    expect(
      referrerHost("https://site.example/chat/private", "site.example"),
    ).toBe("direct");
  });
});
