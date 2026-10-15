// Isolated regression flows. Requires demo emulators and the dev server on 3014.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const projectId = 'demo-merokotha-feature-tests';
initializeApp({ projectId });
const db = getFirestore();
const uid = 'saved-search-browser';
const base = 'http://localhost:3014';
const artifacts = new URL('../../.feature-tests/artifacts/saved-searches/', import.meta.url);
await mkdir(artifacts, { recursive: true });
await fetch(`http://127.0.0.1:8088/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
await getAuth().deleteUser(uid).catch(() => {});
await getAuth().createUser({ uid, email: 'searcher@example.test', password: 'Search-test-123' });
const now = Date.now();
const old = Timestamp.fromMillis(now - 60000);
const seen = Timestamp.fromMillis(now - 1000);
await db.doc(`users/${uid}`).set({ name: 'Search Tester', phone: '', role: 'customer', agentStatus: 'none', isBanned: false, createdAt: old });
const empty = { search: '', roomType: '', minRent: '', maxRent: '', furnishing: '', facility: '', verifiedOnly: false, nearby: null };
const rental = (id, address, rent = 12000, fresh = false, status = 'active') => ({
  id, ownerId: 'test-owner', ownerName: 'Test Owner', title: `${address} rental ${id}`, address, roomType: 'room',
  rentPerMonth: rent, status, facilities: ['Water'], photoUrls: ['/images/hero-bg.png'],
  createdAt: fresh ? Timestamp.fromMillis(now - 500) : old, verificationStatus: 'pending',
});
const fixtures = [rental('j1', 'Janakpur'), rental('b1', 'Bhaktapur'), rental('b2', 'Bhaktapur', 14000, true),
  rental('k1', 'Kapan', 8000), rental('k2', 'Kapan', 10000), rental('k3', 'Kapan', 16000),
  ...Array.from({ length: 7 }, (_, i) => rental(`p${i}`, 'Patan')), rental('paused', 'Kapan', 7000, false, 'paused')];
await Promise.all(fixtures.map(({ id, ...data }) => db.doc(`listings/${id}`).set(data)));
for (const name of ['janakpur', 'bhaktapur', 'kapan', 'pokhara']) {
  await db.doc(`users/${uid}/savedSearches/${name}`).set({ name, filters: empty, createdAt: old, lastViewedAt: seen });
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/fonts.googleapis.com/**', route => route.abort());
const row = id => page.locator(`[data-saved-search="${id}"]`);
const results = page.locator('#saved-search-results');
async function screenshot(name) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: fileURLToPath(new URL(name, artifacts)), fullPage: true });
}
try {
  await page.goto(`${base}/sign-in`);
  await page.locator('#auth-email').fill('searcher@example.test');
  await page.locator('#auth-password').fill('Search-test-123');
  await page.getByRole('button', { name: 'Sign in with email', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: /Hello, Search Tester/ }).waitFor();
  await page.goto(`${base}/#rentals`);
  await row('janakpur').getByText('1 match', { exact: true }).waitFor();
  await row('bhaktapur').getByText('2 matches', { exact: true }).waitFor();
  await row('kapan').getByText('3 matches', { exact: true }).waitFor();
  await row('pokhara').getByText('0 matches', { exact: true }).waitFor();
  assert.equal(await row('bhaktapur').getByText('1 new', { exact: true }).count(), 1);
  console.log('PASS: 13 active listings produce distinct real counts (1, 2, 3, 0), with paused rentals excluded');

  await row('bhaktapur').getByRole('link').click();
  await page.waitForURL('**/dashboard?tab=searches&search=bhaktapur#saved-search-results');
  await results.getByRole('heading', { name: 'bhaktapur', exact: true }).waitFor();
  await results.getByRole('button', { name: 'All matches (2)', exact: true }).waitFor();
  assert.deepEqual((await results.locator('article h3 a').allTextContents()).sort(), ['Bhaktapur rental b1', 'Bhaktapur rental b2']);
  await results.getByRole('button', { name: 'New since last visit (1)', exact: true }).click();
  assert.deepEqual(await results.locator('article h3 a').allTextContents(), ['Bhaktapur rental b2']);
  const viewed = (await db.doc(`users/${uid}/savedSearches/bhaktapur`).get()).data().lastViewedAt;
  assert.ok(viewed.toMillis() > seen.toMillis());
  await page.reload();
  await results.getByRole('button', { name: 'New since last visit (0)', exact: true }).waitFor();
  await results.getByRole('button', { name: 'New since last visit (0)', exact: true }).click();
  await results.getByRole('heading', { name: 'You’re up to date' }).waitFor();
  await results.getByRole('button', { name: 'See all matches' }).click();
  console.log('PASS: selected section, exact rental navigation, unseen-only filter, and persisted visit tracking');

  await db.doc('listings/b3').set({ ...rental('b3', 'Bhaktapur', 9000), createdAt: Timestamp.now() });
  await row('bhaktapur').getByText('3 matches', { exact: true }).waitFor();
  await results.getByRole('button', { name: 'New since last visit (1)', exact: true }).waitFor();
  await results.getByLabel('Sort matching rentals').selectOption('rent-low');
  assert.deepEqual(await results.locator('article h3 a').allTextContents(), ['Bhaktapur rental b3', 'Bhaktapur rental b1', 'Bhaktapur rental b2']);
  await screenshot('desktop.png');
  console.log('PASS: live matching listing updates, new badge, and price sorting');

  await row('pokhara').getByRole('link').click();
  await results.getByRole('heading', { name: 'No matching rentals yet' }).waitFor();
  await results.getByRole('button', { name: 'Adjust criteria' }).click();
  await results.getByLabel('Location or keyword', { exact: true }).fill('Janakpur');
  await results.getByLabel('Search name (optional)', { exact: true }).fill('My Janakpur home');
  await results.getByRole('button', { name: 'Save changes', exact: true }).click();
  await results.getByRole('heading', { name: 'My Janakpur home', exact: true }).waitFor();
  await results.getByRole('button', { name: 'All matches (1)', exact: true }).waitFor();
  assert.equal((await db.doc(`users/${uid}/savedSearches/pokhara`).get()).data().filters.search, 'Janakpur');
  console.log('PASS: useful zero-results state and editing legacy criteria independently of their display name');

  await page.getByText('Create a saved search', { exact: true }).click();
  const creator = page.locator('details').filter({ has: page.getByText('Create a saved search', { exact: true }) });
  await creator.getByLabel('Location or keyword', { exact: true }).fill('Kapan');
  await creator.getByLabel('Search name (optional)', { exact: true }).fill('Affordable Kapan');
  await creator.getByText('Refine search criteria', { exact: true }).click();
  await creator.getByLabel('Maximum rent (Rs.)', { exact: true }).fill('9000');
  await creator.getByText('1 match right now', { exact: true }).waitFor();
  await creator.getByRole('button', { name: 'Save search', exact: true }).click();
  await results.getByRole('heading', { name: 'Affordable Kapan', exact: true }).waitFor();
  await results.getByRole('button', { name: 'All matches (1)', exact: true }).waitFor();
  assert.deepEqual(await results.locator('article h3 a').allTextContents(), ['Kapan rental k1']);
  const createdId = new URL(page.url()).searchParams.get('search');
  const created = (await db.doc(`users/${uid}/savedSearches/${createdId}`).get()).data();
  assert.equal(created.filters.search, 'Kapan');
  assert.equal(created.filters.maxRent, '9000');
  assert.equal(created.name, 'Affordable Kapan');
  assert.equal(created.criteriaVersion, 1);
  console.log('PASS: keyword, optional label, and budget save together and open the correct results');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= 390 && document.body.scrollWidth <= 390);
  await screenshot('mobile.png');
  await row('janakpur').getByRole('link').click();
  await results.getByRole('heading', { name: 'janakpur', exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'saved-search-results');
  await page.reload();
  await results.getByRole('heading', { name: 'janakpur', exact: true }).waitFor();
  await page.goBack();
  await results.getByRole('heading', { name: 'Affordable Kapan', exact: true }).waitFor();
  await row(createdId).getByRole('button', { name: 'Delete saved search: Affordable Kapan', exact: true }).click();
  await row(createdId).waitFor({ state: 'detached' });
  await results.getByRole('heading', { name: 'Your next place starts with a search', exact: true }).waitFor();
  assert.equal((await db.doc(`users/${uid}/savedSearches/${createdId}`).get()).exists, false);
  console.log('PASS: 390px layout, focused navigation, reload/back links, and deletion');

  const rulesEndpoint = `http://127.0.0.1:8088/emulator/v1/projects/${projectId}:securityRules`;
  const rules = await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
  const setRules = content => fetch(rulesEndpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }) });
  try {
    const denial = rules.replace("allow read: if resource.data.get('status', '') == 'active';", 'allow read: if false;').replace('allow read: if isAuth() && notBanned();', 'allow read: if false;').replace('allow read: if isAdmin();', 'allow read: if false;');
    const response = await setRules(denial);
    assert.equal(response.ok, true);
    await page.reload();
    await row('kapan').getByText('Matches unavailable', { exact: true }).waitFor();
    assert.equal(await row('kapan').getByText('0 matches', { exact: true }).count(), 0);
    console.log('PASS: failed listing reads show unavailable counts rather than false zero matches');
  } finally { await setRules(rules); }
  assert.deepEqual(errors, []);
  console.log('PASS: no browser runtime errors');
} catch (error) {
  await screenshot('failure.png').catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await db.terminate();
}
