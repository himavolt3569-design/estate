// Posting integration: generated details, facilities and editable place search.
// All writes use the local demo project, never the configured production project.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(
  new URL("../../.feature-tests/package.json", import.meta.url),
);
const { chromium } = require("playwright");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8088";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9098";
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp({ projectId: "demo-merokotha-feature-tests" });
const db = getFirestore();
const uid = "autofill-posting-test";
await getAuth()
  .deleteUser(uid)
  .catch(() => {});
await getAuth().createUser({
  uid,
  email: "autofill@example.test",
  password: "Autofill-test-123",
});
await db.doc(`users/${uid}`).set({
  name: "Autofill Tester",
  phone: "",
  location: "Kathmandu",
  role: "customer",
  agentStatus: "none",
  isBanned: false,
  createdAt: FieldValue.serverTimestamp(),
});
for (const item of (
  await db.collection("listings").where("ownerId", "==", uid).get()
).docs)
  await item.ref.delete();
const artifacts = new URL(
  "../../.feature-tests/artifacts/listing-autofill/",
  import.meta.url,
);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/fonts.googleapis.com/**", (route) => route.abort());
const base = "http://localhost:3014";
const place = {
  id: "N-hospital",
  name: "CIWEC Hospital",
  address: "British-Indian Embassy Rd, Lainchaur, Kathmandu, Nepal",
  lat: 27.7202714,
  lng: 85.3178811,
};
let searchMode = "success";
let requestedQueries = [];
await page.route("**/api/places?*", async (route) => {
  const query = new URL(route.request().url()).searchParams.get("q");
  requestedQueries.push(query);
  if (searchMode === "delayed")
    await new Promise((resolve) => setTimeout(resolve, 600));
  const results =
    searchMode === "empty"
      ? []
      : [
          place,
          {
            ...place,
            id: "W-pokhara",
            address: "Mansarovar Path, Pokhara, Nepal",
            lat: 28.2092872,
            lng: 83.9590207,
          },
        ];
  await route.fulfill({
    status: searchMode === "error" ? 502 : 200,
    contentType: "application/json",
    body: JSON.stringify(
      searchMode === "error" ? { error: "Unavailable" } : results,
    ),
  });
});
async function choose(id, label) {
  await page.locator(`#${id}`).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
async function checkFits(width) {
  await page.setViewportSize({ width, height: 1000 });
  await page.waitForFunction(
    () =>
      document.documentElement.scrollWidth <= innerWidth &&
      document.body.scrollWidth <= innerWidth,
  );
}
async function descriptionContains(text) {
  await page.waitForFunction(
    (value) => document.querySelector("#description").value.includes(value),
    text,
  );
}
try {
  await page.goto(`${base}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.locator("#auth-email").fill("autofill@example.test");
  await page.locator("#auth-password").fill("Autofill-test-123");
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await page.goto(`${base}/dashboard?tab=post`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#title").waitFor();
  assert.equal(await page.locator("#title").inputValue(), "Room for rent");
  await choose("roomType", "Flat");
  await page.locator("#rentPerMonth").fill("25000");
  await page.locator("#depositAmount").fill("50000");
  await page.locator("#floor").fill("2");
  await page.locator("#totalFloors").fill("4");
  await choose("furnishing", "Semi furnished");
  await page.locator("#availableFrom").fill("2026-11-01");
  await page.getByRole("checkbox", { name: "Water", exact: true }).check();
  await page.getByRole("checkbox", { name: "Wi-Fi", exact: true }).check();
  await descriptionContains("Facilities: Water, WiFi.");
  assert.equal(
    await page.locator("input[type=text][name=facilities]").count(),
    0,
  );
  assert.equal(
    await page.locator("input[type=checkbox][name=facilities]").count(),
    19,
  );

  await page.locator("#place-search").fill("CIWC Hospital");
  await page.locator("#place-search").dispatchEvent("keydown", {
    key: "Enter",
    isComposing: true,
  });
  assert.equal(
    requestedQueries.length,
    0,
    "Typing and IME confirmation must not search or post the form.",
  );
  await page.locator("#place-search").press("Enter");
  const result = page.getByRole("button", {
    name: /CIWEC Hospital British-Indian Embassy/,
  });
  await result.waitFor();
  assert.equal(
    (await db.collection("listings").where("ownerId", "==", uid).get()).size,
    0,
  );
  assert.equal(await page.locator("#place-search-results button").count(), 2);
  await page.locator("#place-search").press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#address").inputValue(), place.address);
  assert.equal(
    await page.locator("#nearbyLandmarks").inputValue(),
    "CIWEC Hospital",
  );
  assert.equal(
    await page.locator("#title").inputValue(),
    "Flat for rent in British-Indian Embassy Rd, Lainchaur, Kathmandu",
  );
  for (const fact of [
    "CIWEC Hospital",
    "25,000",
    "50,000",
    "Floor: 2",
    "Total floors: 4",
    "Semi furnished",
    "2026-11-01",
  ])
    await descriptionContains(fact);
  await page.waitForFunction(() =>
    Boolean(document.querySelector(".leaflet-tile-pane")),
  );
  // Wait for the pin's fly-to animation to finish before inspecting its stored coordinates.
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("span")].some(
        (span) => span.textContent === "Release to set",
      ),
  );
  console.log(
    "PASS: property and location autofill, keyboard result selection, no submit on search Enter, checkbox values",
  );

  const templateOne = await page.locator("#description").inputValue();
  await page
    .getByRole("button", { name: "Try another template", exact: true })
    .click();
  assert.notEqual(await page.locator("#description").inputValue(), templateOne);
  await page.locator("#title").fill("My custom title");
  await page.locator("#description").fill("My custom description");
  await page.locator("#rentPerMonth").fill("28000");
  await page.locator("#address").fill("Edited street, Kathmandu");
  await page.locator("#nearbyLandmarks").fill("CIWEC Hospital, east entrance");
  await page.getByRole("checkbox", { name: "Parking", exact: true }).check();
  await choose("roomType", "Office");
  assert.equal(await page.locator("#title").inputValue(), "My custom title");
  assert.equal(
    await page.locator("#description").inputValue(),
    "My custom description",
  );
  await page
    .getByRole("button", { name: "Use suggested title", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use suggested details", exact: true })
    .click();
  await descriptionContains("28,000");
  await descriptionContains("CIWEC Hospital, east entrance");
  await descriptionContains("Facilities: Water, WiFi, Parking.");
  assert.equal(
    await page.locator("#title").inputValue(),
    "Office for rent in Edited street, Kathmandu",
  );
  await page.getByRole("checkbox", { name: "Wi-Fi", exact: true }).uncheck();
  await descriptionContains("Facilities: Water, Parking.");
  console.log(
    "PASS: template cycling, preservation of manual edits, explicit restore and facility removal",
  );

  for (const [mode, expected] of [
    ["empty", "No places found."],
    ["error", "Location search is unavailable."],
  ]) {
    searchMode = mode;
    await page.locator("#place-search").fill("Unknown hospital");
    await page
      .getByRole("button", { name: "Search location", exact: true })
      .click();
    await page
      .locator("#place-search-status")
      .filter({ hasText: expected })
      .waitFor();
    assert.equal(
      await page.locator("#address").inputValue(),
      "Edited street, Kathmandu",
    );
  }
  searchMode = "delayed";
  await page.locator("#place-search").fill("Older result");
  await page
    .getByRole("button", { name: "Search location", exact: true })
    .click();
  await page.locator("#place-search").fill("New query");
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator("#place-search-results button").count(),
    0,
    "A stale search response must not repopulate results.",
  );
  console.log(
    "PASS: no-results, provider failure, stale response cancellation, editable address remains intact",
  );

  for (const width of [320, 390, 800, 1440]) await checkFits(width);
  await page.screenshot({
    path: fileURLToPath(new URL("posting-desktop.png", artifacts)),
    fullPage: true,
  });
  await checkFits(390);
  await page.screenshot({
    path: fileURLToPath(new URL("posting-mobile.png", artifacts)),
    fullPage: true,
  });
  await page.getByRole("button", { name: "नेपाली", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector("#description").value.includes("मासिक भाडा"),
  );
  await descriptionContains("सुविधाहरू: पानी, पार्किङ");
  for (const width of [320, 390, 1440]) await checkFits(width);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await descriptionContains("Monthly rent");
  console.log(
    "PASS: English/Nepali generation and responsive form at 320, 390, 800 and 1440px",
  );

  const expectedTitle = await page.locator("#title").inputValue();
  const expectedDescription = await page.locator("#description").inputValue();
  await page
    .getByRole("button", { name: "Publish rental", exact: true })
    .click();
  await page.waitForURL("**/listing/*");
  const saved = await db.doc(`listings/${page.url().split("/").at(-1)}`).get();
  assert.equal(saved.data().title, expectedTitle);
  assert.equal(saved.data().description, expectedDescription);
  assert.deepEqual(saved.data().facilities, ["Water", "Parking"]);
  assert.equal(saved.data().address, "Edited street, Kathmandu");
  assert.equal(saved.data().nearbyLandmarks, "CIWEC Hospital, east entrance");
  assert.ok(Math.abs(saved.data().geoPoint.latitude - place.lat) < 0.00001);
  assert.ok(Math.abs(saved.data().geoPoint.longitude - place.lng) < 0.00001);
  assert.equal(saved.data().roomType, "office");
  console.log(
    "PASS: generated text, selected facilities, edited location and correct hospital coordinates persisted to demo Firestore",
  );
  await page.goto(`${base}/dashboard?tab=post`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator(".leaflet-container").waitFor();
  await page
    .getByRole("navigation", { name: "Dashboard", exact: true })
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page.waitForURL("**/dashboard?tab=overview");
  await page.waitForTimeout(900);
  assert.deepEqual(
    errors,
    [],
    "Leaving the form must cancel map resize callbacks.",
  );
  console.log(
    "PASS: leaving the posting form during map setup causes no browser error",
  );
} finally {
  await browser.close();
}
