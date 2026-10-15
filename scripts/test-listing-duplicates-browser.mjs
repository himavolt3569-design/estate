// Posting regression: rapid submits and failed-photo retries, demo emulators only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const projectId = 'demo-merokotha-feature-tests';
initializeApp({ projectId });
const db = getFirestore();
const uid = 'duplicate-posting-test';
await fetch(`http://127.0.0.1:8088/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
await getAuth().deleteUser(uid).catch(() => {});
await getAuth().createUser({ uid, email: 'posting@example.test', password: 'Posting-test-123' });
await db.doc(`users/${uid}`).set({ name: 'Posting Tester', phone: '', location: 'Patan', role: 'customer', agentStatus: 'none', isBanned: false, createdAt: FieldValue.serverTimestamp() });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/fonts.googleapis.com/**', route => route.abort());
const owned = () => db.collection('listings').where('ownerId', '==', uid).get();
try {
  await page.goto('http://localhost:3014/sign-in', { waitUntil: 'domcontentloaded' });
  await page.locator('#auth-email').fill('posting@example.test');
  await page.locator('#auth-password').fill('Posting-test-123');
  await page.getByRole('button', { name: 'Sign in with email', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.goto('http://localhost:3014/dashboard?tab=post', { waitUntil: 'domcontentloaded' });
  await page.locator('#title').fill('Retry-safe Maitidevi flat');
  await page.locator('#rentPerMonth').fill('15000');
  await page.locator('#address').fill('Maitidevi');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles(fileURLToPath(new URL('../public/images/hero-bg.png', import.meta.url)));
  let denyUploads = true;
  await page.route('http://127.0.0.1:9198/**', route => {
    if (denyUploads && route.request().method() === 'POST') return route.fulfill({ status: 403, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: { code: 403, message: 'Permission denied.' } }) });
    return route.continue();
  });
  const submit = page.getByRole('button', { name: 'Publish rental', exact: true });
  // One event-loop turn deliberately bypasses the disabled button's UX guard.
  await page.locator('#title').evaluate(input => { for (let i = 0; i < 6; i++) input.form.requestSubmit(); });
  await page.getByText(/Firebase Storage: User does not have permission/).waitFor({ timeout: 45000 });
  await submit.waitFor({ state: 'visible' });
  assert.ok(await submit.isEnabled());
  let listings = await owned();
  assert.equal(listings.size, 1, 'Rapid submits must create only one rental, even with a failed upload.');
  const savedId = listings.docs[0].id;
  const savedAt = listings.docs[0].data().createdAt.toMillis();
  assert.deepEqual(listings.docs[0].data().photoUrls, []);
  console.log('PASS: six synchronous submits create one rental when photo upload fails');

  // A moderator update between attempts must survive the retry.
  await db.doc(`listings/${savedId}`).update({ viewCount: 17 });
  denyUploads = false;
  await submit.click();
  await page.waitForURL(`**/listing/${savedId}`, { timeout: 45000 });
  listings = await owned();
  assert.equal(listings.size, 1, 'Retrying the partial submission must reuse the saved ID.');
  const saved = listings.docs[0].data();
  assert.equal(saved.createdAt.toMillis(), savedAt);
  assert.ok(saved.viewCount >= 17);
  assert.equal(saved.photoUrls.length, 1);
  console.log('PASS: retry uploads photos to the original rental and preserves its creation time and existing data');

  await page.goto('http://localhost:3014/dashboard?tab=post', { waitUntil: 'domcontentloaded' });
  await page.locator('#title').fill('A separate Kirtipur room');
  await page.locator('#rentPerMonth').fill('4500');
  await page.locator('#title').evaluate(input => { for (let i = 0; i < 6; i++) input.form.requestSubmit(); });
  await page.waitForURL('**/listing/*');
  listings = await owned();
  assert.equal(listings.size, 2, 'A new form must still allow a distinct listing.');
  assert.notEqual(page.url().split('/').at(-1), savedId);
  assert.deepEqual(errors, []);
  console.log('PASS: a new form can publish a separate rental without duplicating rapid submissions');
} finally {
  await browser.close();
}
