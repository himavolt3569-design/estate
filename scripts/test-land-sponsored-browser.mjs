import { showHeroAd } from './hero-ad-navigation.mjs';
// Browser QA uses only localhost and disposable demo Firebase data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
initializeApp({ projectId: 'demo-merokotha-feature-tests' });
const db = getFirestore();
const base = 'http://localhost:3016';
const folder = '.impeccable/review/land-sponsored';
await mkdir(folder, { recursive: true });
const checks = [], errors = [];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const makePage = async (width = 1440, uid) => {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', error => errors.push(error.message));
  if (uid) {
    await page.goto(base + '/sign-in'); await page.locator('#auth-email').fill(`${uid}@example.test`); await page.locator('#auth-password').fill('Test-pass-123');
    await page.getByRole('button', { name: 'Sign in with email', exact: true }).click(); await page.waitForURL('**/dashboard');
  }
  return page;
};
const choose = async (page, id, name) => { await page.locator(`#${id}`).click(); await page.getByRole('option', { name, exact: true }).click(); };
const capture = async (page, name, locator) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.locator('img').evaluateAll(images => Promise.all(images.filter(image => image.complete || image.getBoundingClientRect().top < innerHeight).map(image => image.decode().catch(() => {}))));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: overflow`);
  if (locator && name.startsWith('home-property-top-')) await locator.screenshot({ path: `${folder}/${name}.png` });
  else if (locator) {
    const box = await locator.boundingBox();
    const buffer = await page.screenshot({ fullPage: true });
    await sharp(buffer).extract({ left: Math.floor(box.x), top: Math.floor(box.y), width: Math.floor(box.width), height: Math.floor(box.height) }).toFile(`${folder}/${name}.png`);
  }
  else await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true });
};
try {
  const owner = await makePage(1440, 'owner');
  await owner.goto(base + '/dashboard?tab=post');
  await choose(owner, 'roomType', 'Land'); await choose(owner, 'listing-purpose', 'Sell');
  await owner.locator('#rentPerMonth').fill('8000000');
  await owner.locator('#land-area').fill('4.5'); await owner.locator('#land-area-unit').selectOption('aana');
  await owner.locator('#land-use').selectOption('residential'); await owner.locator('#land-road').selectOption('motorable');
  await owner.locator('#land-road-width').fill('20'); await owner.locator('#land-frontage').fill('30'); await owner.locator('#land-facing').selectOption('east');
  await owner.locator('#address').fill('Patan, Lalitpur');
  assert.equal(await owner.locator('#floor, #furnishing, #totalFloors').count(), 0);
  assert.ok((await owner.locator('#description').inputValue()).includes('Land area: 4.5 Aana.'));
  await capture(owner, 'post-desktop'); await owner.setViewportSize({ width: 390, height: 1000 }); await capture(owner, 'post-mobile');
  await owner.getByRole('button', { name: 'Publish property', exact: true }).click(); await owner.waitForURL(/\/listing\/[^/]+$/);
  const id = new URL(owner.url()).pathname.split('/').at(-1);
  const saved = (await db.doc(`listings/${id}`).get()).data();
  assert.equal(saved.land.area, 4.5); assert.equal(saved.land.roadWidth, 20); assert.equal(saved.salePrice, 8000000); assert.equal(saved.floor, undefined); assert.equal(saved.furnishing, undefined);
  await db.doc(`listings/${id}`).update({ photoUrls: ['/images/hero-bg.png', '/images/hero-bg.png'] });
  checks.push('New land sale persists area, units, access, dimensions and facing without building fields.');
  await owner.goto(base + `/listing/${id}/edit`); assert.equal(await owner.locator('#land-area').inputValue(), '4.5'); assert.equal(await owner.locator('#edit-floor, #edit-furnishing').count(), 0);
  await owner.locator('#land-area').fill('5'); await capture(owner, 'edit-mobile');
  await owner.locator('form').getByRole('button', { name: /Save changes|Save rental|Update rental|Save property/ }).click(); await owner.waitForURL(base + `/listing/${id}`);
  await owner.getByText('5 Aana', { exact: true }).first().waitFor(); await capture(owner, 'detail-mobile');
  await owner.setViewportSize({ width: 1440, height: 1000 }); await capture(owner, 'detail-desktop');
  assert.equal((await db.doc(`listings/${id}`).get()).data().land.area, 5);
  checks.push('Land edit and public details preserve measurements and hide building facts.');

  // A legacy land record can still be saved without inventing an area.
  await db.doc('listings/demo-legacy-land').set({ ...saved, title: 'Demo legacy land', land: null, createdAt: Timestamp.now() });
  await owner.goto(base + '/listing/demo-legacy-land/edit'); await owner.locator('form').getByRole('button', { name: /Save changes|Save rental|Update rental|Save property/ }).click(); await owner.waitForURL(base + '/listing/demo-legacy-land');
  checks.push('Legacy land remains editable without area.');
  const landSearch = await makePage(390); await landSearch.goto(base + '/?roomType=land&landUse=residential&roadAccess=motorable&transactionType=sale');
  await landSearch.locator('.rental-grid article').getByText('5 Aana', { exact: true }).waitFor();
  assert.equal(await landSearch.locator('.rental-grid article').getByText('Floor', { exact: true }).count(), 0);
  await capture(landSearch, 'land-results-mobile'); await landSearch.context().close();

  const admin = await makePage(1440, 'admin'); await admin.goto(base + '/dashboard?tab=ads');
  await choose(admin, 'ad-link', 'Sponsored property'); await admin.locator('#sponsored-property-type').selectOption('land'); await admin.locator('#sponsored-property-search').fill(id);
  await admin.locator(`input[name="sponsoredProperty"][value="${id}"]`).check(); await choose(admin, 'ad-placement', 'Between listings'); await admin.locator('#ad-priority').fill('100');
  assert.equal(await admin.locator('#ad-title, #ad-images, #ad-url').count(), 0);
  await capture(admin, 'admin-desktop', admin.locator('#sponsor-editor'));
  await admin.setViewportSize({ width: 390, height: 1000 }); await capture(admin, 'admin-mobile', admin.locator('#sponsor-editor'));
  await admin.getByRole('button', { name: 'Save campaign', exact: true }).click(); await admin.getByText('Campaign saved. Changes sync across devices.', { exact: true }).waitFor();
  const campaign = (await db.doc(`ads/listing-${id}`).get()).data(); assert.equal(campaign.listingId, id); assert.equal(campaign.title, saved.title); assert.ok(campaign.subtitle.includes('5 Aana'));
  checks.push('Superadmin can search, select and sponsor a land listing with automatic creative.');
  // Website duplicates are deliberately inserted to prove destination deduplication.
  await db.doc('ads/demo-duplicate-hima').set({ title: 'Duplicate HimaVolt', status: 'active', linkType: 'external', externalUrl: 'https://himavolt.com/', placement: 'home', priority: 0 });
  const visitor = await makePage(1440); await visitor.goto(base); await visitor.locator('.rental-grid__ad .sponsor-panel').first().waitFor();
  assert.equal(await visitor.locator('.rental-grid__ad').count(), 2); assert.equal(await visitor.locator('.rental-grid .ad-carousel__controls').count(), 0);
  assert.equal(await visitor.locator(`a[href="/listing/${id}"]`).count(), 2);
  for (const [width, name] of [[1440, 'home-desktop'], [800, 'home-tablet'], [390, 'home-mobile'], [320, 'home-narrow']]) { await visitor.setViewportSize({ width, height: 1000 }); await capture(visitor, name); await capture(visitor, name.replace('home-', 'feed-'), visitor.locator('.rental-grid__ad').first()); }
  await db.doc(`listings/${id}`).update({ title: 'Demo land price updated', salePrice: 9000000, address: 'Updated Patan location' });
  await visitor.locator('.rental-grid__ad h3').getByText('Demo land price updated', { exact: true }).first().waitFor(); assert.ok((await visitor.locator('.rental-grid__ad').filter({ hasText: 'Demo land price updated' }).first().innerText()).includes('9,000,000'));
  checks.push('Ad updates follow listing changes, with no duplicate banners, repeated property or circled carousel footer.');
  await db.doc(`listings/${id}`).update({ status: 'paused' }); await visitor.waitForFunction(id => !document.querySelector(`.rental-grid__ad a[href="/listing/${id}"]`), id);
  checks.push('Paused properties automatically disappear from advertising.');
  await choose(admin, 'ad-link', 'Sponsored property'); await admin.locator('#sponsored-property-type').selectOption('flat'); await admin.locator('#sponsored-property-purpose').selectOption('rent'); await admin.locator('#sponsored-property-search').fill('demo-2');
  await admin.locator('input[name="sponsoredProperty"][value="demo-2"]').check();
  await admin.getByRole('button', { name: 'Save campaign', exact: true }).click(); await admin.getByText('Campaign saved. Changes sync across devices.', { exact: true }).waitFor();
  await visitor.goto(base); await visitor.locator('.landing-promos [data-campaign="listing-demo-2"]').waitFor({ state: 'attached' });
  assert.equal(await visitor.locator('.landing-promos [data-campaign="listing-demo-2"]').count(), 1); assert.equal(await visitor.locator('.rental-grid__ad').count(), 2); assert.equal(await visitor.locator('a[href="/listing/demo-2"]').count(), 3);
  for (const [width, name] of [[1440, 'home-property-top-desktop'], [390, 'home-property-top-mobile']]) {
    await visitor.setViewportSize({ width, height: 1000 }); await visitor.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await showHeroAd(visitor, 3);
    await visitor.waitForFunction(() => { const rail = document.querySelector('.landing-promos__rail').getBoundingClientRect(); const card = document.querySelector('[data-campaign="listing-demo-2"]').getBoundingClientRect(); return card.left >= rail.left - 2 && card.right <= rail.right + 2; });
    await visitor.locator('.landing-promos [data-campaign="listing-demo-2"] h3').waitFor(); await capture(visitor, name, visitor.locator('.home-discovery'));
  }
  checks.push('Flat rentals can be sponsored in the homepage rail with a single cover, while partner ads remain between listings without repeated feed campaigns.');
  await visitor.getByRole('button', { name: 'Lands', exact: true }).click(); await visitor.getByRole('button', { name: 'Filters', exact: true }).click();
  assert.equal(await visitor.locator('#filter-furnishing').count(), 0); await choose(visitor, 'filter-land-use', 'Residential'); await choose(visitor, 'filter-road-access', 'Motorable road');
  await showHeroAd(visitor, 0);
  await visitor.waitForFunction(() => document.querySelector('.landing-promos__rail').scrollLeft < 2);
  await capture(visitor, 'land-filter-mobile');
  checks.push('Land search exposes use/access filters and hides furnishing.');
  assert.deepEqual(errors, []);
  await writeFile(`${folder}/browser-checks.json`, JSON.stringify({ checks, errors, productionDataWrites: 0 }, null, 2)); console.log(`${checks.length} complete land and advertising browser scenarios passed.`);
} finally { await browser.close(); }
