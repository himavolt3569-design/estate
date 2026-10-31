"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { configured, db, storage } from "./client";
import { countView } from "./actions";
import type { Listing, ListingReport, ListingVisit } from "./types";
import {
  ANALYTICS_LIMIT,
  analyticsStart,
  referrerHost,
  visitKey,
  VISIT_WINDOW_MS,
} from "@/lib/listing-analytics";
import {
  canDecideReport,
  decisionSchema,
  reportSchema,
} from "@/lib/listing-reports";
import { tourSchema, type TourScene } from "@/lib/virtual-tour";

let visitorId = "";
const recorded = new Map<string, number>();
export async function recordListingVisit(listing: Listing, viewerUid?: string) {
  if (
    !configured ||
    listing.status !== "active" ||
    listing.ownerId === viewerUid
  )
    return;
  if (!visitorId) {
    try {
      visitorId =
        localStorage.getItem("merokotha_visitor") || crypto.randomUUID();
      localStorage.setItem("merokotha_visitor", visitorId);
    } catch {
      visitorId = crypto.randomUUID();
    }
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(visitorId))
      visitorId = crypto.randomUUID();
  }
  const now = Date.now();
  if (now - (recorded.get(listing.id) || 0) < VISIT_WINDOW_MS) return;
  const key = visitKey(listing.id, visitorId, now);
  try {
    const cached = JSON.parse(
      sessionStorage.getItem(`visit_${listing.id}`) || "null",
    ) as { recordedAt?: number } | null;
    if (cached?.recordedAt && now - cached.recordedAt < VISIT_WINDOW_MS) return;
  } catch {
    /* Storage can be disabled or hold an older cache format. */
  }
  recorded.set(listing.id, now);
  try {
    sessionStorage.setItem(
      `visit_${listing.id}`,
      JSON.stringify({ recordedAt: now }),
    );
  } catch {
    /* In-memory deduplication remains. */
  }
  // Keep the established Android-compatible lifetime counter working when the
  // new analytics rules have not yet been deployed. Telemetry is best effort.
  await Promise.allSettled([
    countView(listing.id),
    setDoc(doc(db(), "listingVisits", key), {
      listingId: listing.id,
      ownerId: listing.ownerId,
      visitorId,
      referrer: referrerHost(document.referrer, window.location.hostname),
      device: window.matchMedia("(max-width: 767px)").matches
        ? "mobile"
        : "desktop",
      createdAt: serverTimestamp(),
    }),
  ]);
}

export function useListingVisits(uid: string, admin: boolean, days: number) {
  const [items, setItems] = useState<ListingVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setItems([]);
    setError("");
    if (!configured || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const constraints = [
      where(
        "createdAt",
        ">=",
        Timestamp.fromDate(analyticsStart(new Date(), days)),
      ),
    ];
    if (!admin) constraints.push(where("ownerId", "==", uid));
    return onSnapshot(
      query(
        collection(db(), "listingVisits"),
        ...constraints,
        orderBy("createdAt", "desc"),
        limit(ANALYTICS_LIMIT),
      ),
      (snapshot) => {
        setItems(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as ListingVisit,
          ),
        );
        setLoading(false);
        setError("");
      },
      (cause) => {
        setLoading(false);
        setError(cause.message);
      },
    );
  }, [uid, admin, days]);
  return { items, loading, error, capped: items.length >= ANALYTICS_LIMIT };
}

export async function saveListingTour(listing: Listing, scenes: TourScene[]) {
  const next = tourSchema.parse(scenes);
  await updateDoc(doc(db(), "listings", listing.id), {
    tourScenes: next,
    verificationStatus: "pending",
    verificationReason: deleteField(),
    verifiedAt: deleteField(),
    verifiedBy: deleteField(),
    reviewedAt: deleteField(),
    reviewedBy: deleteField(),
    reviewReason: deleteField(),
    updatedAt: serverTimestamp(),
  });
  const retained = new Set([
    ...next.map((scene) => scene.imageUrl),
    ...(listing.photoUrls || []),
  ]);
  const removed = (listing.tourScenes || []).filter(
    (scene) => !retained.has(scene.imageUrl),
  );
  const results = await Promise.allSettled(
    removed.map(async (scene) => {
      const file = ref(storage(), scene.imageUrl);
      if (file.fullPath.startsWith(`listings/${listing.id}/`))
        await deleteObject(file);
    }),
  );
  return {
    cleanupFailed: results.some((result) => result.status === "rejected"),
  };
}

export async function submitListingReport(
  listing: Listing,
  reporterId: string,
  input: unknown,
) {
  if (reporterId === listing.ownerId)
    throw new Error("You cannot report your own listing.");
  const data = reportSchema.parse(input);
  await setDoc(doc(db(), "listingReports", `${listing.id}_${reporterId}`), {
    ...data,
    listingId: listing.id,
    listingTitle: listing.title,
    ownerId: listing.ownerId,
    reporterId,
    status: "open",
    decisionReason: null,
    decidedAt: null,
    decidedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function useOwnListingReport(listingId: string, reporterId: string) {
  const [report, setReport] = useState<ListingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReport(null);
    setError("");
    if (!configured || !reporterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db(), "listingReports"),
        where("reporterId", "==", reporterId),
        where("listingId", "==", listingId),
        limit(1),
      ),
      (snapshot) => {
        const item = snapshot.docs[0];
        setReport(
          item ? ({ id: item.id, ...item.data() } as ListingReport) : null,
        );
        setLoading(false);
        setError("");
      },
      (cause) => {
        setError(cause.message);
        setLoading(false);
      },
    );
  }, [listingId, reporterId]);
  return { report, loading, error };
}

export function useListingReports(uid: string, admin: boolean, status = "all") {
  const [items, setItems] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setItems([]);
    setError("");
    if (!configured || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const constraints = admin
      ? status === "all"
        ? []
        : [where("status", "==", status)]
      : [where("reporterId", "==", uid)];
    const direction =
      admin && (status === "open" || status === "reviewing") ? "asc" : "desc";
    return onSnapshot(
      query(
        collection(db(), "listingReports"),
        ...constraints,
        orderBy("createdAt", direction),
        limit(200),
      ),
      (snapshot) => {
        setItems(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as ListingReport,
          ),
        );
        setLoading(false);
        setError("");
      },
      (cause) => {
        setLoading(false);
        setError(cause.message);
      },
    );
  }, [uid, admin, status]);
  return { items, loading, error, capped: items.length === 200 };
}

export async function moderateListingReport(
  reportId: string,
  actorId: string,
  action: "review" | "resolve" | "dismiss" | "pause",
  note: string,
) {
  const decisionReason = decisionSchema.parse(note);
  const status =
    action === "review"
      ? "reviewing"
      : action === "dismiss"
        ? "dismissed"
        : "resolved";
  const audit = doc(collection(db(), "adminDecisions"));
  await runTransaction(db(), async (transaction) => {
    const target = doc(db(), "listingReports", reportId);
    const snapshot = await transaction.get(target);
    if (!snapshot.exists())
      throw new Error("This report is no longer available.");
    const report = snapshot.data() as ListingReport;
    if (!canDecideReport(report.status, status))
      throw new Error("This report was already updated. Refresh the queue.");
    const listingRef = doc(db(), "listings", report.listingId);
    if (action === "pause") {
      const listing = await transaction.get(listingRef);
      if (!listing.exists())
        throw new Error(
          "The listing has already been removed. Resolve this report without pausing it.",
        );
    }
    transaction.update(target, {
      status,
      decisionReason,
      decidedBy: actorId,
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (action === "pause")
      transaction.update(listingRef, {
        status: "paused",
        updatedAt: serverTimestamp(),
      });
    transaction.set(audit, {
      action: "report",
      targetId: reportId,
      targetName: report.listingTitle,
      decision: action,
      reason: decisionReason,
      actorId,
      createdAt: serverTimestamp(),
    });
  });
}
