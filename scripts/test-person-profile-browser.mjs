// Click-through identity regression using only disposable demo Firebase records.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
initializeApp({ projectId: 'demo-merokotha-feature-tests' });
const db = getFirestore();
const base = 'http://localhost:3016';
const folder = '.impeccable/review/person-profile-click';
await mkdir(folder, { recursive: true });
const checks = [], errors = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
const people = [
  ['person-alpha', 'Demo Alpha', 'Alpha shared introduction.', '9800000001'],
  ['person-bravo', 'Demo Bravo', 'Bravo shared introduction.', '9800000002'],
  ['person-charlie', 'Demo Charlie', 'Charlie shared introduction.', '9800000003'],
];
for (const [id, name, bio, publicPhone] of people) {
  await db.doc(`users/${id}`).set({ name, role: 'owner', phone: 'PRIVATE-PHONE', email: 'private@example.test', isBanned: false, createdAt: Timestamp.now() });
  await db.doc(`usersPublic/${id}`).set({ id: 'misleading-document-field', name, bio, photoUrl: '/images/hero-bg.png', publicPhone, whatsappNumber: publicPhone });
}
await db.doc('agentsPublic/person-alpha').delete();
await db.doc('agentsPublic/person-charlie').delete();
await db.doc('agentsPublic/person-bravo').set({ name: 'Demo Bravo', bio: 'Bravo shared introduction.', location: 'Patan', photoUrl: '/images/hero-bg.png', publicPhone: '9800000002', status: 'active' });
const template = (await db.doc('listings/demo-0').get()).data();
for (const [suffix, ownerId, agentId, ownerName, anonymous] of [
  ['alpha', 'person-alpha', 'person-alpha', 'Demo Alpha', false],
  ['bravo', 'different-owner', 'person-bravo', 'Different Owner', false],
  ['charlie', 'person-charlie', null, 'Demo Charlie', false],
  ['anonymous', 'person-alpha', 'person-alpha', 'Private lister', true],
]) await db.doc(`listings/person-${suffix}`).set({ ...template, title: `Demo property ${suffix}`, ownerId, ownerName, agentId, contactIsAnonymous: anonymous });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
async function pageAt(width, signedIn = false) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  if (signedIn) {
    await page.goto(base + '/sign-in');
    await page.locator('#auth-email').fill('renter@example.test');
    await page.locator('#auth-password').fill('Test-pass-123');
    await page.getByRole('button', { name: 'Sign in with email', exact: true }).click();
    await page.waitForURL('**/dashboard');
  }
  return page;
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })));
  await page.addStyleTag({ content: 'nextjs-portal,[data-sonner-toaster]{display:none!important}' });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true, animations: 'disabled' });
}
try {
  for (const width of [1440, 390]) {
    const page = await pageAt(width, true);
    for (const [suffix, name, bio, phone] of people.map(([id, ...rest]) => [id.replace('person-', ''), ...rest])) {
      await page.goto(`${base}/listing/person-${suffix}`);
      const identity = page.locator('.agent-summary > a').first();
      await identity.getByText(name, { exact: true }).waitFor();
      await page.locator('.agent-summary').getByText(bio, { exact: true }).waitFor();
      check(`${width}px ${suffix} name and photo link to the exact person`, await identity.getAttribute('href') === `/profile/person-${suffix}?listing=person-${suffix}` && await identity.locator('img').count() === 1);
      if (suffix === 'alpha') await capture(page, `listing-${width}`);
      await identity.click();
      await page.waitForURL(`**/profile/person-${suffix}*`);
      await page.getByRole('heading', { name, exact: true }).waitFor();
      await page.getByText(bio, { exact: true }).waitFor();
      check(`${width}px ${suffix} opens their own shared details`, await page.locator(`a[href="tel:${phone}"]`).count() === 1);
      const properties = page.locator('section').filter({ has: page.getByRole('heading', { name: /Properties from/ }) }).locator('article');
      check(`${width}px ${suffix} only their properties appear`, await properties.count() === 1 && await properties.getByRole('heading', { name: `Demo property ${suffix}`, exact: true }).count() === 1);
      check(`${width}px ${suffix} private account fields stay private`, !/PRIVATE-PHONE|private@example.test/.test(await page.locator('main').innerText()));
      check(`${width}px ${suffix} fallback does not invent verification`, (await page.getByText('Verified agent', { exact: true }).count() > 0) === (suffix === 'bravo'));
      check(`${width}px ${suffix} profile fits`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (suffix === 'alpha') await capture(page, `profile-${width}`);
    }
    await page.goto(base + '/listing/person-anonymous');
    await page.locator('.agent-summary').getByText('Private lister', { exact: true }).waitFor();
    check(`${width}px anonymous card never links to a person`, await page.locator('.agent-summary a').count() === 0);
    await page.goto(base + '/agents/person-alpha');
    await page.getByRole('heading', { name: 'Demo Alpha', exact: true }).waitFor();
    check(`${width}px old agent URLs still resolve missing directory entries`, await page.getByText('Alpha shared introduction.', { exact: true }).count() === 1);
    if (width === 390) {
      await page.locator('button[lang="ne"]:visible').click();
      await page.waitForFunction(() => document.documentElement.lang === 'ne');
      await capture(page, 'profile-nepali');
      check('Nepali person profile fits', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.context().close();
  }
  const guest = await pageAt(390);
  await guest.goto(base + '/listing/person-alpha');
  const link = guest.locator('.agent-summary > a').first();
  await link.waitFor(); await link.click();
  await guest.getByRole('heading', { name: 'Demo Alpha', exact: true }).waitFor();
  check('guest legacy card also opens the specific person', guest.url().includes('/profile/person-alpha'));
  check('guest respects signed-in-only shared profile rules', await guest.getByText('Alpha shared introduction.', { exact: true }).count() === 0 && await guest.locator('main a[href^="/sign-in?next="]').count() === 1);
  await capture(guest, 'guest-profile-mobile');
  await db.doc('agentsPublic/person-alpha').set({ name: 'Suspended Person', status: 'suspended' });
  await guest.reload();
  await guest.getByRole('heading', { name: 'Profile unavailable', exact: true }).waitFor();
  check('inactive public directory does not reappear through fallback', await guest.getByRole('heading', { name: 'Demo Alpha', exact: true }).count() === 0);
  check('no uncaught browser errors', errors.length === 0);
  await writeFile(`${folder}/checks.json`, JSON.stringify({ passed: checks.length, checks, errors, scope: 'Local demo Firebase; no production writes' }, null, 2));
} finally { await browser.close(); }
