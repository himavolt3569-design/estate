// Isolated emulator checks. Install the test tools in ../.feature-tests as
// described in README.md; this script never targets a real Firebase project.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(
  new URL("../../.feature-tests/package.json", import.meta.url),
);
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  setLogLevel,
} = require("firebase/firestore");
const { ref, uploadBytes, deleteObject } = require("firebase/storage");
setLogLevel("silent");
const env = await initializeTestEnvironment({
  projectId: "demo-merokotha-feature-tests",
  firestore: {
    host: "127.0.0.1",
    port: 8088,
    rules: await readFile(
      new URL("../firebase/firestore.rules", import.meta.url),
      "utf8",
    ),
  },
  storage: {
    host: "127.0.0.1",
    port: 9198,
    rules: await readFile(
      new URL("../firebase/storage.rules", import.meta.url),
      "utf8",
    ),
  },
});
const guest = env.unauthenticatedContext().firestore();
const client = (uid) => env.authenticatedContext(uid).firestore();
const owner = client("owner");
const renter = client("renter");
const stranger = client("stranger");
const admin = client("admin");
const banned = client("banned");
const visit = (overrides = {}) => ({
  listingId: "rental",
  ownerId: "owner",
  visitorId: "browser",
  referrer: "direct",
  device: "mobile",
  createdAt: serverTimestamp(),
  ...overrides,
});
const report = (overrides = {}) => ({
  listingId: "rental",
  listingTitle: "Test rental",
  ownerId: "owner",
  reporterId: "renter",
  reason: "fraud",
  details: "Photos show a different property.",
  status: "open",
  decisionReason: null,
  decidedBy: null,
  decidedAt: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
});
const scene = {
  id: "room1",
  title: "Living room",
  imageUrl:
    "https://firebasestorage.googleapis.com/v0/b/demo-merokotha-feature-tests.appspot.com/o/listings%2Frental%2Ftour.jpg?alt=media",
  hotspots: [],
};
const decision = (status) => ({
  status,
  decisionReason: "Evidence checked by administrator.",
  decidedBy: "admin",
  decidedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const uid of ["owner", "renter", "stranger", "banned", "admin"])
      await setDoc(doc(db, "users", uid), {
        name: uid,
        phone: "",
        role: uid === "admin" ? "superAdmin" : "customer",
        isBanned: uid === "banned",
        agentStatus: "none",
        createdAt: Timestamp.now(),
      });
    await setDoc(doc(db, "listings", "rental"), {
      ownerId: "owner",
      ownerName: "Owner",
      title: "Test rental",
      roomType: "flat",
      rentPerMonth: 20000,
      status: "active",
      verificationStatus: "verified",
      verifiedBy: "admin",
      verifiedAt: Timestamp.now(),
      viewCount: 0,
      photoUrls: [],
      createdAt: Timestamp.now(),
    });
  });
  await test("guest visits are write-only; owners and admins can read bounded analytics", async () => {
    await assertSucceeds(
      setDoc(doc(guest, "listingVisits", "rental_browser_1"), visit()),
    );
    await assertFails(getDoc(doc(guest, "listingVisits", "rental_browser_1")));
    await assertFails(
      getDoc(doc(stranger, "listingVisits", "rental_browser_1")),
    );
    await assertSucceeds(
      getDoc(doc(owner, "listingVisits", "rental_browser_1")),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(owner, "listingVisits"),
          where("ownerId", "==", "owner"),
          limit(2000),
        ),
      ),
    );
    await assertFails(getDocs(collection(owner, "listingVisits")));
    await assertSucceeds(
      getDocs(query(collection(admin, "listingVisits"), limit(2000))),
    );
  });
  await test("analytics rejects identity fields, forged ownership, old dates and record replacement", async () => {
    await assertFails(
      setDoc(
        doc(guest, "listingVisits", "rental_browser_2"),
        visit({ email: "private@example.test" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(guest, "listingVisits", "rental_browser_3"),
        visit({ ownerId: "stranger" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(guest, "listingVisits", "rental_browser_4"),
        visit({ createdAt: Timestamp.fromMillis(0) }),
      ),
    );
    await assertFails(
      setDoc(doc(guest, "listingVisits", "rental_browser_1"), visit()),
    );
    await assertFails(
      setDoc(doc(owner, "listingVisits", "rental_browser_5"), visit()),
    );
    await assertFails(
      setDoc(doc(banned, "listingVisits", "rental_browser_6"), visit()),
    );
  });
  await test("reports are visible only to the reporter and admin, never to the lister", async () => {
    await assertSucceeds(
      setDoc(doc(renter, "listingReports", "rental_renter"), report()),
    );
    await assertSucceeds(
      getDoc(doc(renter, "listingReports", "rental_renter")),
    );
    await assertSucceeds(getDoc(doc(admin, "listingReports", "rental_renter")));
    await assertFails(getDoc(doc(owner, "listingReports", "rental_renter")));
    await assertFails(getDoc(doc(stranger, "listingReports", "rental_renter")));
    await assertFails(getDoc(doc(guest, "listingReports", "rental_renter")));
    await assertSucceeds(
      getDocs(
        query(
          collection(renter, "listingReports"),
          where("reporterId", "==", "renter"),
          limit(200),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(owner, "listingReports"),
          where("reporterId", "==", "renter"),
          limit(200),
        ),
      ),
    );
  });
  await test("submission requires a real, non-banned reporter; duplicates and forged decisions are rejected", async () => {
    await assertFails(
      setDoc(
        doc(guest, "listingReports", "rental_guest"),
        report({ reporterId: "guest" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(banned, "listingReports", "rental_banned"),
        report({ reporterId: "banned" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(owner, "listingReports", "rental_owner"),
        report({ reporterId: "owner" }),
      ),
    );
    await assertFails(
      setDoc(doc(renter, "listingReports", "rental_renter"), report()),
    );
    await assertFails(
      setDoc(
        doc(stranger, "listingReports", "rental_stranger"),
        report({ reporterId: "renter" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(stranger, "listingReports", "rental_stranger"),
        report({ reporterId: "stranger", status: "resolved" }),
      ),
    );
    await assertFails(
      updateDoc(
        doc(renter, "listingReports", "rental_renter"),
        decision("resolved"),
      ),
    );
  });
  await test("admin review preserves submission and can atomically pause a rental with an audit record", async () => {
    await assertFails(
      updateDoc(doc(admin, "listingReports", "rental_renter"), {
        ...decision("reviewing"),
        reporterId: "stranger",
      }),
    );
    await assertSucceeds(
      updateDoc(
        doc(admin, "listingReports", "rental_renter"),
        decision("reviewing"),
      ),
    );
    const batch = writeBatch(admin);
    batch.update(
      doc(admin, "listingReports", "rental_renter"),
      decision("resolved"),
    );
    batch.update(doc(admin, "listings", "rental"), {
      status: "paused",
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(admin, "adminDecisions", "report-decision"), {
      action: "report",
      targetId: "rental_renter",
      actorId: "admin",
      decision: "pause",
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(guest, "listings", "rental")));
    await assertFails(
      updateDoc(
        doc(admin, "listingReports", "rental_renter"),
        decision("reviewing"),
      ),
    );
    await assertFails(deleteDoc(doc(admin, "listingReports", "rental_renter")));
    await assertFails(
      updateDoc(doc(admin, "adminDecisions", "report-decision"), {
        decision: "dismiss",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(admin, "listings", "rental"), { status: "active" }),
    );
  });
  await test("tour changes reset verification and reject malformed or cross-owner updates", async () => {
    await assertFails(
      updateDoc(doc(owner, "listings", "rental"), { tourScenes: [scene] }),
    );
    await assertFails(
      updateDoc(doc(stranger, "listings", "rental"), {
        tourScenes: [scene],
        verificationStatus: "pending",
      }),
    );
    const reset = {
      verificationStatus: "pending",
      verifiedAt: deleteField(),
      verifiedBy: deleteField(),
      verificationReason: deleteField(),
    };
    await assertFails(
      updateDoc(doc(owner, "listings", "rental"), {
        ...reset,
        tourScenes: [
          { ...scene, imageUrl: "https://example.test/not-owned.jpg" },
        ],
      }),
    );
    await assertSucceeds(
      updateDoc(doc(owner, "listings", "rental"), {
        ...reset,
        tourScenes: [scene],
      }),
    );
    await assertSucceeds(getDoc(doc(guest, "listings", "rental")));
    await assertFails(
      updateDoc(doc(owner, "listings", "rental"), {
        verificationStatus: "verified",
      }),
    );
    await assertFails(
      updateDoc(doc(owner, "listings", "rental"), {
        tourScenes: Array.from({ length: 9 }, (_, i) => ({
          ...scene,
          id: `room${i}`,
        })),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(owner, "listings", "rental"), { tourScenes: [] }),
    );
  });
  await test("panorama Storage uploads and deletion are restricted to the lister or admin", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const file = (context) =>
      ref(
        context.storage("gs://demo-merokotha-feature-tests.appspot.com"),
        "listings/rental/rules-tour.jpg",
      );
    await assertFails(
      uploadBytes(file(env.unauthenticatedContext()), bytes, {
        contentType: "image/jpeg",
      }),
    );
    await assertFails(
      uploadBytes(file(env.authenticatedContext("stranger")), bytes, {
        contentType: "image/jpeg",
      }),
    );
    await assertSucceeds(
      uploadBytes(file(env.authenticatedContext("owner")), bytes, {
        contentType: "image/jpeg",
      }),
    );
    await assertFails(deleteObject(file(env.authenticatedContext("stranger"))));
    await assertSucceeds(deleteObject(file(env.authenticatedContext("owner"))));
  });
} finally {
  await env.cleanup();
}
