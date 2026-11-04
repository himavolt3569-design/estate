// Local demo Firebase only. Covers placements, administration, privacy and uploads.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
initializeApp({ projectId: 'demo-merokotha-feature-tests' });
const db = getFirestore();
const base = 'http://localhost:3016';
const folder = '.impeccable/review/property-detail-ads';
await mkdir(folder, { recursive: true });
const checks = [], errors = [], metrics = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
await db.doc('users/owner').update({ name: 'Demo Agent', role: 'agent', agentStatus: 'verified', agentBio: 'Demo profile for local layout testing.', publicPhone: '+977 9800000000', whatsappNumber: '9800000000' });
await db.doc('usersPublic/owner').update({ name: 'Demo Agent' });
await db.doc('agentsPublic/owner').set({ name: 'Demo Agent', location: 'Patan, Lalitpur', photoUrl: '/images/hero-bg.png', bio: 'Demo profile for local layout testing. Helping people explore properties around Patan.', publicPhone: '+977 9800000000', whatsappNumber: '9800000000', status: 'active' });
await db.doc('listings/demo-0').update({ agentId: 'owner', publicCallNumber: '9800000000' });
await db.doc('listings/demo-1').update({ agentId: 'owner', contactIsAnonymous: true, ownerName: 'Private lister' });
await db.doc('listings/demo-2').update({ photoUrls: ['/images/hero-bg.png'] });
for (const uid of ['owner', 'admin', 'renter']) await getAuth().updateUser(uid, { emailVerified: true });
const settings = (await db.doc('adSettings/public').get()).data();
await db.doc('adSettings/public').set({ ...settings, enabled: true, detailPriceEnabled: true });
const previous = await db.collection('ads').where('title', '==', 'Demo price-slot campaign').get();
for (const campaign of previous.docs) await campaign.ref.delete();
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const makePage = async (width, uid) => {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  if (uid) {
    await page.goto(base + '/sign-in');
    await page.locator('#auth-email').fill(`${uid}@example.test`);
    await page.locator('#auth-password').fill('Test-pass-123');
    await page.getByRole('button', { name: 'Sign in with email', exact: true }).click();
    await page.waitForURL('**/dashboard');
  }
  return page;
};
const capture = async (page, name, locator) => {
  await page.evaluate(() => document.fonts.ready);
  const hideOverlays = await page.addStyleTag({ content: 'nextjs-portal,[data-sonner-toaster]{display:none!important}' });
  await page.evaluate(() => Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); })));
  await page.evaluate(() => scrollTo(0, 0));
  if (locator) {
    // Crop the full-page image without scrolling a tall sticky sidebar behind
    // the sticky navbar; locator.screenshot would produce a misleading overlap.
    const bounds = await locator.boundingBox();
    const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
    await sharp(screenshot).extract({ left: Math.floor(bounds.x), top: Math.floor(bounds.y), width: Math.floor(bounds.width), height: Math.floor(bounds.height) }).png().toFile(`${folder}/${name}.png`);
  } else await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true, animations: 'disabled' });
  await hideOverlays.evaluate(el => el.remove());
};
try {
  if (process.argv.includes('--controls-fix')) {
    await db.doc('adSettings/public').set({ enabled: true, partnerAdsEnabled: true, heroEnabled: true, feedEnabled: true, detailsEnabled: true, detailTitleEnabled: true, detailPriceEnabled: true, detailRecommendationsEnabled: true, detailAgentEnabled: true, feedInterval: 4, rotationSeconds: 6 });
    for (const ad of (await db.collection('ads').get()).docs) await ad.ref.delete();
    for (const width of [1440, 390]) {
      const page = await makePage(width);
      await page.goto(base + '/listing/demo-0');
      await page.locator('[data-ad-slot="recommendations"]').waitFor();
      await page.locator('.agent-summary').getByText('Demo Agent', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Show photo 2', exact: true }).click();
      check(`${width}px property ads have no visible control strips`, await page.locator('.ad-carousel__controls, .carousel-button').count() === 0);
      check(`${width}px corrected ads remain contained`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture(page, `details-${width}`);
      await capture(page, `agent-card-${width}`, page.locator('aside').first());
      if (width === 390) {
        await page.locator('button[lang="ne"]:visible').click();
        await page.waitForFunction(() => document.documentElement.lang === 'ne');
        check('Nepali corrected ads remain contained', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await capture(page, 'details-nepali');
      }
      await page.context().close();
    }
    check('no browser errors after target correction', errors.length === 0);
    await writeFile(`${folder}/controls-fix-checks.json`, JSON.stringify({ passed: checks.length, checks, errors, scope: 'Current behavior: no visible advertisement controls; local demo data only' }, null, 2));
  } else {
  for (const width of [1440, 800, 390, 320]) {
    const page = await makePage(width);
    await page.goto(base);
    await page.locator('.rental-grid > article').first().waitFor();
    const categories = await page.locator('.property-categories button').allTextContents();
    check(`${width}px category order`, JSON.stringify(categories) === JSON.stringify(['Rooms', 'Flats', 'House', 'Apartments', 'Office', 'Shop', 'Lands', 'Others (All Properties)']));
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.rental-grid > article')].every(el => /room/.test(el.textContent)));
    await page.getByRole('button', { name: 'Others (All Properties)', exact: true }).click();
    await page.locator('.rental-grid > article').nth(11).waitFor();
    const header = await page.locator('.site-header__inner').evaluate(el => el.getBoundingClientRect().height);
    check(`${width}px navbar size`, header === (width < 768 ? 80 : 68));
    check(`${width}px homepage contained`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width === 1440 || width === 390) await capture(page, `home-${width}`);
    metrics.push({ width, headerHeight: header });
    await page.goto(base + '/listing/demo-0');
    await page.locator('[data-ad-slot="recommendations"]').waitFor();
    await page.locator('.agent-summary').getByText('Demo Agent', { exact: true }).waitFor();
    check(`${width}px all four ads present`, await page.locator('[data-ad-slot]').count() === 4);
    check(`${width}px full photo control removed`, await page.getByRole('button', { name: /View full/ }).count() === 0 && await page.locator('dialog').count() === 0);
    await page.getByRole('button', { name: 'Show photo 2', exact: true }).click();
    check(`${width}px thumbnail selection preserved`, await page.getByRole('button', { name: 'Show photo 2', exact: true }).getAttribute('aria-pressed') === 'true');
    check(`${width}px agent has photo, bio and public contacts`, await page.locator('.agent-summary img').count() === 1 && await page.locator('.agent-summary a[href^="tel:"]').count() === 1 && await page.locator('.agent-summary a[href^="https://wa.me/"]').count() === 1);
    check(`${width}px ad placement order`, await page.evaluate(() => {
      const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const title = document.querySelector('[data-ad-slot="title"]'), price = document.querySelector('[data-ad-slot="price"]'), recommended = document.querySelector('[data-ad-slot="recommendations"]');
      return before(document.querySelector('nav[aria-label="Breadcrumb"]'), title) && before(title, document.querySelector('.listing-gallery')) && before(document.querySelector('h1'), price) && before(price, document.querySelector('dl')) && before(recommended, document.querySelector('#recommendations-title'));
    }));
    check(`${width}px details contained`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width === 1440 || width === 390) {
      await capture(page, `details-${width}`);
      await capture(page, `agent-card-${width}`, page.locator('aside').first());
    }
    await page.getByRole('button', { name: 'Close advertisement', exact: true }).click();
    check(`${width}px mini closes without removing other ads`, await page.locator('[data-ad-slot]').count() === 3);
    await page.reload(); await page.locator('[data-ad-slot="recommendations"]').waitFor();
    check(`${width}px dismissal survives reload`, await page.locator('[data-ad-slot="agent"]').count() === 0);
    await page.goto(base + '/agents/owner');
    await page.getByRole('heading', { name: 'Demo Agent', exact: true }).waitFor();
    check(`${width}px complete agent profile and shared dismissal`, await page.getByRole('heading', { name: 'About the agent' }).count() === 1 && await page.locator('a[href^="tel:"]').count() === 1 && await page.locator('[data-ad-slot="agent"]').count() === 0);
    if (width === 1440 || width === 390) await capture(page, `profile-${width}`);
    await page.goto(base + '/listing/demo-1'); await page.locator('.agent-summary').waitFor();
    check(`${width}px anonymous lister stays private`, await page.locator('.agent-summary').getByText('Private lister', { exact: true }).count() === 1 && await page.locator('.agent-summary a').count() === 0 && !await page.locator('.agent-summary').textContent().then(t => t.includes('Demo Agent')));
    if (width === 390) {
      await page.goto(base + '/listing/demo-0'); await page.locator('[data-ad-slot="price"]').waitFor();
      await page.locator('button[lang="ne"]:visible').click();
      await page.waitForFunction(() => document.documentElement.lang === 'ne');
      check('Nepali detail layout contained', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture(page, 'details-nepali');
    }
    await page.context().close();
  }
  const admin = await makePage(1440, 'admin');
  await admin.goto(base + '/dashboard?tab=ads');
  await admin.locator('#ad-title').waitFor();
  const display = admin.getByRole('group', { name: 'Property-page placements', exact: true });
  await display.getByLabel('Below the property price', { exact: true }).uncheck();
  await admin.getByRole('button', { name: 'Save display settings', exact: true }).click();
  await admin.getByText('Ad settings saved', { exact: true }).waitFor();
  const visitor = await makePage(390);
  await visitor.goto(base + '/listing/demo-0'); await visitor.locator('[data-ad-slot="recommendations"]').waitFor();
  check('superadmin price-slot switch syncs to visitor', await visitor.locator('[data-ad-slot="price"]').count() === 0 && await visitor.locator('[data-ad-slot]').count() === 3);
  await display.getByLabel('Below the property price', { exact: true }).check();
  await admin.getByRole('button', { name: 'Save display settings', exact: true }).click();
  await visitor.locator('[data-ad-slot="price"]').waitFor();
  await admin.locator('#ad-title').fill('Demo price-slot campaign');
  await admin.locator('#ad-brand').fill('Demo partner');
  await admin.locator('#ad-url').fill('https://example.test/price-ad');
  await admin.locator('#ad-priority').fill('100');
  await admin.locator('#ad-placement').click(); await admin.getByRole('option', { name: 'Property pages', exact: true }).click();
  const slots = admin.getByRole('group', { name: 'Property-page slots', exact: true });
  for (const label of ['Below the listing title', 'Above similar properties', 'Agent mini ad']) await slots.getByLabel(label, { exact: false }).uncheck();
  await admin.getByRole('button', { name: 'Save campaign', exact: true }).click();
  await admin.getByText('Campaign saved. Changes sync across devices.', { exact: true }).waitFor();
  const campaigns = await db.collection('ads').where('title', '==', 'Demo price-slot campaign').get();
  check('campaign targets only its selected slot', campaigns.size === 1 && JSON.stringify(campaigns.docs[0].data().detailSlots) === '["price"]');
  await visitor.locator('[data-ad-slot="price"]').getByRole('heading', { name: 'Demo price-slot campaign' }).waitFor();
  check('campaign does not leak into other slots', await visitor.getByRole('heading', { name: 'Demo price-slot campaign' }).count() === 1);
  await capture(admin, 'admin-desktop');
  await admin.setViewportSize({ width: 390, height: 1000 });
  check('mobile superadmin contained', await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture(admin, 'admin-mobile');
  const owner = await makePage(390, 'owner');
  await owner.goto(base + '/dashboard?tab=profile');
  await owner.locator('#agentPublicPhone').fill('+977 9811111111');
  await owner.locator('#agentWhatsApp').fill('9811111111');
  await owner.locator('#agentBio').fill('Demo updated public agent introduction.');
  await owner.getByRole('button', { name: 'Save changes', exact: true }).click();
  await owner.getByText('Profile updated', { exact: true }).waitFor();
  check('agent publishes only explicitly public contacts', (await db.doc('agentsPublic/owner').get()).data().publicPhone === '+977 9811111111' && !(await db.doc('agentsPublic/owner').get()).data().email);
  await visitor.locator('.agent-summary').getByText('Demo updated public agent introduction.', { exact: true }).waitFor();
  await capture(owner, 'agent-editor-mobile');
  const original = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#576b7c' } }).png().toBuffer();
  await writeFile(`${folder}/upload-original.png`, original);
  await owner.goto(base + '/listing/demo-2/edit');
  await owner.getByRole('button', { name: 'Add photos', exact: true }).waitFor();
  await owner.locator('input[type="file"][multiple]').setInputFiles({ name: 'demo-photo.png', mimeType: 'image/png', buffer: original });
  await owner.getByRole('button', { name: 'Save changes', exact: true }).click();
  await owner.waitForURL('**/listing/demo-2');
  const edited = (await db.doc('listings/demo-2').get()).data();
  const imageUrl = edited.photoUrls.at(-1);
  check('edited photo stored as processed WebP', imageUrl.includes('.webp'));
  const watermarked = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
  await writeFile(`${folder}/uploaded-watermark.webp`, watermarked);
  const { data, info } = await sharp(watermarked).raw().toBuffer({ resolveWithObject: true });
  let changed = 0, outerChanges = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    const diff = Math.abs(data[i] - 87) + Math.abs(data[i + 1] - 107) + Math.abs(data[i + 2] - 124);
    if (diff > 18) { if (y > 300 && y < 500 && x > 200 && x < 1000) changed++; else outerChanges++; }
  }
  check('watermark baked into central pixels at original aspect ratio', info.width === 1200 && info.height === 800 && changed > 2000 && outerChanges < 100);
  await owner.getByRole('button', { name: 'Show photo 2', exact: true }).click();
  await capture(owner, 'watermark-in-gallery', owner.locator('.listing-gallery'));
  await owner.goto(base + '/listing/demo-2/edit');
  await owner.getByRole('button', { name: 'Add photos', exact: true }).waitFor();
  await owner.locator('input[type="file"][multiple]').setInputFiles({ name: 'broken-photo.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
  await owner.getByRole('button', { name: 'Save changes', exact: true }).click();
  await owner.getByText('Could not read broken-photo.png. Use a JPG, PNG or WebP photo.', { exact: true }).waitFor();
  check('unreadable photo cannot bypass watermark processing', (await db.doc('listings/demo-2').get()).data().photoUrls.length === edited.photoUrls.length);
  await db.doc('adSettings/public').set({ ...settings, enabled: false });
  await visitor.waitForFunction(() => document.querySelectorAll('[data-ad-slot]').length === 0);
  check('master off removes all new placements', await visitor.locator('[data-ad-slot]').count() === 0);
  await db.doc('adSettings/public').set(settings);
  check('no uncaught browser errors', errors.length === 0);
  await writeFile(`${folder}/checks.json`, JSON.stringify({ passed: checks.length, checks, errors, metrics, mode: 'local disposable demo Firebase; no production writes' }, null, 2));
  }
} finally { await browser.close(); }
