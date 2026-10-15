import type { Inquiry, Listing, ListingVisit } from "./firebase/types";

export const ANALYTICS_LIMIT = 2000;
export const VISIT_WINDOW_MS = 30 * 60 * 1000;
export function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const stamp = value as { toMillis?: () => number; seconds?: number } | null;
  return (
    stamp?.toMillis?.() ??
    (typeof stamp?.seconds === "number" ? stamp.seconds * 1000 : 0)
  );
}
export function nepalDay(value: Date | number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function analyticsStart(now: Date, days: number) {
  const today = new Date(`${nepalDay(now)}T00:00:00+05:45`);
  return new Date(today.getTime() - (days - 1) * 86400000);
}
export function referrerHost(referrer: string, currentHost: string) {
  try {
    const hostname = new URL(referrer).hostname;
    return hostname === currentHost ? "direct" : hostname.slice(0, 253);
  } catch {
    return "direct";
  }
}
export function visitKey(listingId: string, visitorId: string, now: number) {
  return `${listingId}_${visitorId}_${Math.floor(now / VISIT_WINDOW_MS)}`;
}
export function summarizeAnalytics(
  listings: Listing[],
  visits: ListingVisit[],
  inquiries: Inquiry[],
  days: number,
  now = new Date(),
) {
  const start = analyticsStart(now, days).getTime();
  const end = now.getTime();
  const ids = new Set(listings.map((listing) => listing.id));
  const inRange = (value: unknown) => {
    const time = timestampMillis(value);
    return time >= start && time <= end;
  };
  const recent = visits.filter(
    (visit) => ids.has(visit.listingId) && inRange(visit.createdAt),
  );
  const requests = inquiries.filter(
    (inquiry) => ids.has(inquiry.listingId) && inRange(inquiry.createdAt),
  );
  const series = Array.from({ length: days }, (_, i) => ({
    date: nepalDay(start + i * 86400000),
    value: 0,
  }));
  const byDay = (timestamps: unknown[]) => {
    const counts = new Map<string, number>();
    for (const timestamp of timestamps) {
      const day = nepalDay(timestampMillis(timestamp));
      counts.set(day, (counts.get(day) || 0) + 1);
    }
    return series.map((point) => ({
      ...point,
      value: counts.get(point.date) || 0,
    }));
  };
  const group = (field: "referrer" | "device") => {
    const counts = new Map<string, number>();
    for (const visit of recent)
      counts.set(visit[field], (counts.get(visit[field]) || 0) + 1);
    return [...counts]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };
  return {
    views: recent.length,
    uniqueVisitors: new Set(recent.map((visit) => visit.visitorId)).size,
    inquiries: requests.length,
    accepted: requests.filter((inquiry) => inquiry.status === "accepted")
      .length,
    // A rate describes observed events, not guaranteed attribution to a visit.
    inquiryRate: recent.length ? (requests.length / recent.length) * 100 : null,
    lifetimeViews: listings.reduce(
      (sum, listing) => sum + (listing.viewCount || 0),
      0,
    ),
    viewSeries: byDay(recent.map((visit) => visit.createdAt)),
    inquirySeries: byDay(requests.map((inquiry) => inquiry.createdAt)),
    sources: group("referrer"),
    devices: group("device"),
    recent: [...recent]
      .sort(
        (a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt),
      )
      .slice(0, 20),
    performance: listings
      .map((listing) => ({
        listing,
        views: recent.filter((visit) => visit.listingId === listing.id).length,
        unique: new Set(
          recent
            .filter((visit) => visit.listingId === listing.id)
            .map((visit) => visit.visitorId),
        ).size,
        inquiries: requests.filter(
          (inquiry) => inquiry.listingId === listing.id,
        ).length,
      }))
      .sort((a, b) => b.views - a.views || b.inquiries - a.inquiries),
  };
}
