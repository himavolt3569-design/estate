// Checks both deployment sources against a demo Firestore emulator only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(
  new URL("../../.feature-tests/package.json", import.meta.url),
);
const { initializeTestEnvironment, assertFails, assertSucceeds } = require(
  "@firebase/rules-unit-testing",
);
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
} = require("firebase/firestore");

setLogLevel("silent");
const sources = [
  ["website", new URL("../firebase/firestore.rules", import.meta.url)],
  ["Android", new URL("../../merokotha/firestore.rules", import.meta.url)],
];

for (const [name, source] of sources) {
  await test(`${name} saved-search permissions`, async (t) => {
    const env = await initializeTestEnvironment({
      projectId: "demo-merokotha-saved-search-tests",
      firestore: {
        host: "127.0.0.1",
        port: 8088,
        rules: await readFile(source, "utf8"),
      },
    });
    const client = (uid) => env.authenticatedContext(uid).firestore();
    const search = () => ({
      name: "Patan rentals",
      filters: { query: "Patan", roomType: "flat" },
      createdAt: serverTimestamp(),
      lastViewedAt: serverTimestamp(),
    });
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (context) => {
        for (const uid of ["admin", "renter", "stranger", "banned"]) {
          await setDoc(doc(context.firestore(), "users", uid), {
            role: uid === "admin" ? "superAdmin" : "customer",
            isBanned: uid === "banned",
          });
        }
      });

      for (const uid of ["admin", "renter"]) {
        await t.test(`${uid} can load an empty collection and save, view, and delete their search`, async () => {
          const db = client(uid);
          const searches = collection(db, "users", uid, "savedSearches");
          const item = doc(searches, "patan");
          const empty = await assertSucceeds(getDocs(searches));
          assert.equal(empty.empty, true);
          await assertSucceeds(setDoc(item, search()));
          await assertSucceeds(getDoc(item));
          const saved = await assertSucceeds(getDocs(searches));
          assert.equal(saved.size, 1);
          await assertSucceeds(
            updateDoc(item, { lastViewedAt: serverTimestamp() }),
          );
          await assertSucceeds(deleteDoc(item));
        });
      }

      await t.test("guests and other accounts, including admins, cannot access another user's searches", async () => {
        const own = doc(client("renter"), "users/renter/savedSearches/private");
        await assertSucceeds(setDoc(own, search()));
        for (const db of [
          env.unauthenticatedContext().firestore(),
          client("stranger"),
          client("admin"),
        ]) {
          const item = doc(db, "users/renter/savedSearches/private");
          await assertFails(getDoc(item));
          await assertFails(getDocs(collection(db, "users/renter/savedSearches")));
          await assertFails(getDocs(collection(db, "users/no-searches/savedSearches")));
          await assertFails(setDoc(doc(db, "users/renter/savedSearches/forged"), search()));
          await assertFails(updateDoc(item, { lastViewedAt: serverTimestamp() }));
          await assertFails(deleteDoc(item));
        }
      });

      await t.test("banned users retain read access but cannot change saved searches", async () => {
        await env.withSecurityRulesDisabled(async (context) => {
          await setDoc(
            doc(context.firestore(), "users/banned/savedSearches/existing"),
            search(),
          );
        });
        const db = client("banned");
        const item = doc(db, "users/banned/savedSearches/existing");
        await assertSucceeds(getDoc(item));
        await assertSucceeds(getDocs(collection(db, "users/banned/savedSearches")));
        await assertFails(setDoc(doc(db, "users/banned/savedSearches/new"), search()));
        await assertFails(updateDoc(item, { lastViewedAt: serverTimestamp() }));
        await assertFails(deleteDoc(item));
      });
    } finally {
      await env.cleanup();
    }
  });
}
