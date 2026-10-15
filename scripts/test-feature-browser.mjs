// Real browser flows against demo emulators only. See README.md for startup.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../.feature-tests/package.json", import.meta.url),
);
const { chromium } = require("playwright");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8088";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9098";
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const projectId = "demo-merokotha-feature-tests";
initializeApp({ projectId });
const db = getFirestore();
await fetch(
  `http://127.0.0.1:8088/emulator/v1/projects/${projectId}/databases/(default)/documents`,
  { method: "DELETE" },
);
await fetch(
  `http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`,
  { method: "DELETE" },
);
for (const uid of ["owner", "renter", "admin"]) {
  await getAuth().createUser({
    uid,
    email: `${uid}@example.test`,
    password: "Test-pass-123",
  });
  await db
    .doc(`users/${uid}`)
    .set({
      name: uid === "owner" ? "Property Owner" : uid,
      phone: "",
      location: "Patan",
      email: `${uid}@example.test`,
      role: uid === "admin" ? "superAdmin" : "customer",
      isBanned: false,
      agentStatus: "none",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  await db.doc(`usersPublic/${uid}`).set({ name: uid, photoUrl: null });
}
await db
  .doc("listings/browser-rental")
  .set({
    ownerId: "owner",
    ownerName: "Property Owner",
    title: "Sunny Patan flat",
    roomType: "flat",
    rentPerMonth: 22000,
    depositAmount: 44000,
    floor: 2,
    totalFloors: 4,
    furnishing: "semiFurnished",
    facilities: ["Water", "Parking"],
    address: "Patan, Lalitpur",
    description:
      "Two sunny rooms with a balcony and easy access to local shops.",
    status: "active",
    verificationStatus: "verified",
    verifiedBy: "admin",
    verifiedAt: FieldValue.serverTimestamp(),
    photoUrls: ["/images/hero-bg.png"],
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
const pages = [];
const base = "http://localhost:3014";
const artifacts = new URL("../../.feature-tests/artifacts/", import.meta.url);
await mkdir(artifacts, { recursive: true });
async function pageFor(uid) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  pages.push(page);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/fonts.googleapis.com/**", (route) => route.abort());
  if (uid) {
    await page.goto(`${base}/sign-in`);
    await page.locator("#auth-email").fill(`${uid}@example.test`);
    await page.locator("#auth-password").fill("Test-pass-123");
    await page
      .getByRole("button", { name: "Sign in with email", exact: true })
      .click();
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    await page
      .getByRole("heading", {
        name: new RegExp(`Hello, ${uid === "owner" ? "Property Owner" : uid}`),
      })
      .waitFor();
  }
  return page;
}
async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: new URL(name, artifacts).pathname.replace(/^\//, ""),
    fullPage: true,
  });
}
try {
  const owner = await pageFor("owner");
  await owner.goto(`${base}/listing/browser-rental/edit`);
  await owner
    .getByRole("heading", { name: "Build a 360° virtual tour" })
    .waitFor();
  const jpeg = await owner.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    context.fillStyle = "#e9d2ac";
    context.fillRect(0, 0, 1024, 512);
    context.fillStyle = "#24527a";
    context.fillRect(100, 100, 200, 200);
    context.fillStyle = "#739eb4";
    context.fillRect(120, 120, 160, 160);
    context.fillStyle = "#ad896a";
    context.fillRect(0, 350, 1024, 162);
    context.fillStyle = "#f8f0df";
    context.fillRect(480, 120, 140, 250);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  });
  const input = owner.locator(
    'input[accept="image/jpeg,image/png,image/webp"]',
  );
  await input.setInputFiles({
    name: "living.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(jpeg, "base64"),
  });
  await owner.getByLabel("Room name", { exact: true }).waitFor();
  await owner.getByLabel("Room name", { exact: true }).fill("Living room");
  await input.setInputFiles({
    name: "kitchen.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(jpeg, "base64"),
  });
  await owner.getByRole("button", { name: "Room 2", exact: true }).waitFor();
  await owner.getByLabel("Room name", { exact: true }).fill("Kitchen");
  await owner.getByRole("button", { name: "Living room", exact: true }).click();
  await owner.locator(".psv-canvas-container canvas").waitFor();
  const sphere = owner.locator(".psv-canvas-container");
  const bounds = await sphere.boundingBox();
  await sphere.click({
    position: { x: bounds.width / 2, y: bounds.height / 2 },
  });
  await owner.getByLabel("Hotspot label", { exact: true }).fill("Kitchen");
  await owner.getByRole("button", { name: "Add hotspot", exact: true }).click();
  await owner.getByRole("button", { name: "Save tour", exact: true }).click();
  await owner
    .getByText("Virtual tour saved. Rental sent for review.", { exact: true })
    .waitFor();
  const saved = (await db.doc("listings/browser-rental").get()).data();
  assert.equal(saved.tourScenes.length, 2);
  assert.equal(saved.tourScenes[0].hotspots.length, 1);
  assert.equal(saved.verificationStatus, "pending");
  assert.equal(saved.depositAmount, 44000);
  await screenshot(owner, "tour-editor-desktop.png");
  console.log(
    "PASS: panorama upload, linked rooms, save and verification reset",
  );

  const guest = await pageFor();
  await guest.goto(`${base}/listing/browser-rental`);
  await guest
    .getByRole("button", { name: "Start virtual tour", exact: true })
    .click();
  await guest.locator(".psv-canvas-container canvas").waitFor();
  await guest
    .locator(".psv-marker")
    .getByRole("button", { name: "Kitchen", exact: true })
    .click();
  assert.equal(
    await guest
      .getByRole("button", { name: "Kitchen", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await guest
    .getByText("Loading panorama…", { exact: true })
    .waitFor({ state: "hidden" });
  await guest.setViewportSize({ width: 390, height: 844 });
  await guest.waitForFunction(
    () =>
      document.documentElement.scrollWidth <= 390 &&
      document.body.scrollWidth <= 390 &&
      window.innerWidth === 390,
  );
  await screenshot(guest, "tour-mobile.png");
  await guest.reload();
  await guest
    .getByRole("heading", { name: "Sunny Patan flat", exact: true })
    .waitFor();
  assert.equal((await db.collection("listingVisits").get()).size, 1);
  console.log(
    "PASS: public interactive tour, hotspot navigation, mobile layout and visit deduplication",
  );

  await owner.goto(`${base}/dashboard?tab=analytics`);
  await owner
    .getByRole("heading", { name: "Detailed analytics", exact: true })
    .waitFor();
  await owner
    .getByRole("heading", { name: "Recent visit activity", exact: true })
    .waitFor();
  await owner
    .getByText("Loading visit history…", { exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    await owner
      .getByText("Detailed visit history is temporarily unavailable.", {
        exact: false,
      })
      .count(),
    0,
  );
  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.waitForFunction(
    () =>
      document.documentElement.scrollWidth <= 390 &&
      document.body.scrollWidth <= 390 &&
      window.innerWidth === 390,
  );
  await screenshot(owner, "analytics-mobile.png");
  console.log("PASS: owner analytics and mobile charts");

  const renter = await pageFor("renter");
  await renter.goto(`${base}/listing/browser-rental`);
  await renter
    .getByRole("button", { name: "Report this listing", exact: true })
    .click();
  await renter.getByLabel("Reason", { exact: true }).selectOption("fraud");
  await renter
    .getByLabel("What happened?", { exact: true })
    .fill(
      "These photographs show a different property from the advertised address.",
    );
  await renter
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await renter.getByText("Report status: Open", { exact: true }).waitFor();
  assert.equal((await db.collection("listingReports").get()).size, 1);
  console.log("PASS: renter report submission and duplicate prevention UI");

  const admin = await pageFor("admin");
  await admin.goto(`${base}/dashboard?tab=admin`);
  await admin
    .getByRole("heading", { name: "Report moderation", exact: true })
    .waitFor();
  await admin
    .getByLabel("Decision note (required)", { exact: true })
    .fill("Checking the reported property photographs.");
  await admin
    .getByRole("button", { name: "Start review", exact: true })
    .click();
  await admin.getByLabel("Report status filter").selectOption("reviewing");
  await admin
    .getByLabel("Decision note (required)", { exact: true })
    .fill(
      "Photographs did not match the property. Listing paused pending correction.",
    );
  await screenshot(admin, "report-review-desktop.png");
  await admin
    .getByRole("button", { name: "Pause rental & resolve", exact: true })
    .click();
  await admin.getByText("Report updated", { exact: true }).first().waitFor();
  await renter.goto(`${base}/dashboard?tab=reports`);
  await renter.getByText("Report status: Resolved", { exact: true }).waitFor();
  assert.equal(
    (await db.doc("listings/browser-rental").get()).data().status,
    "paused",
  );
  assert.equal(
    (
      await db
        .collection("adminDecisions")
        .where("action", "==", "report")
        .get()
    ).size,
    2,
  );
  await guest.getByRole("heading", { name: /unavailable/i }).waitFor();
  console.log(
    "PASS: admin review, audited resolution, pause and reporter status tracking",
  );
  assert.deepEqual(errors, []);
  console.log("PASS: no browser runtime errors");
} catch (error) {
  for (let i = 0; i < pages.length; i++)
    await screenshot(pages[i], `failure-${i}.png`).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await db.terminate();
}
