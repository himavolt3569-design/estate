// Local demo regression: land criteria must survive creation, editing and reopening.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
initializeApp({ projectId: 'demo-merokotha-feature-tests' }); const db = getFirestore();
for (const record of (await db.collection('users/owner/savedSearches').where('name', '==', 'Demo residential land search').get()).docs) await record.ref.delete();
await db.doc('listings/demo-saved-land').set({ ownerId: 'owner', ownerName: 'Demo Owner', title: 'Demo saved-search land', roomType: 'land', purpose: 'sale', transactionType: 'sale', salePrice: 5000000, rentPerMonth: 0, status: 'active', land: { area: 5, areaUnit: 'aana', landUse: 'residential', roadAccess: 'motorable' }, createdAt: Timestamp.now() });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce' }); const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://localhost:3016/sign-in'); await page.locator('#auth-email').fill('owner@example.test'); await page.locator('#auth-password').fill('Test-pass-123'); await page.getByRole('button', { name: 'Sign in with email', exact: true }).click(); await page.waitForURL('**/dashboard');
  await page.goto('http://localhost:3016/?roomType=land&landUse=residential&roadAccess=motorable&transactionType=sale'); await page.locator('.rental-grid article').first().waitFor();
  await page.locator('#saved-search-disclosure > summary').click();
  const creator = page.locator('#saved-search-disclosure form'); await creator.waitFor();
  await creator.getByLabel('Search name (optional)', { exact: true }).fill('Demo residential land search'); await creator.getByText('Refine search criteria', { exact: true }).click();
  assert.equal(await creator.getByLabel('Land use', { exact: true }).inputValue(), 'residential'); assert.equal(await creator.getByLabel('Road access', { exact: true }).inputValue(), 'motorable'); assert.equal(await creator.getByLabel('Furnishing', { exact: true }).count(), 0);
  await creator.getByRole('button', { name: 'Save search', exact: true }).click(); await page.waitForURL(/search=/); const id = new URL(page.url()).searchParams.get('search');
  let saved = (await db.doc(`users/owner/savedSearches/${id}`).get()).data(); assert.equal(saved.filters.landUse, 'residential'); assert.equal(saved.filters.roadAccess, 'motorable');
  const results = page.locator('#saved-search-results'); await results.getByRole('heading', { name: 'Demo residential land search', exact: true }).waitFor(); await results.getByRole('button', { name: 'Edit search', exact: true }).click();
  const editor = results.locator('form'); await editor.getByText('Refine search criteria', { exact: true }).click(); assert.equal(await editor.getByLabel('Land use', { exact: true }).inputValue(), 'residential'); assert.equal(await editor.getByLabel('Road access', { exact: true }).inputValue(), 'motorable');
  await editor.getByLabel('Road access', { exact: true }).selectOption('footpath');
  await page.evaluate(() => scrollTo(0, 0)); await page.evaluate(() => document.fonts.ready); await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); const box = await editor.boundingBox(); const buffer = await page.screenshot({ fullPage: true }); await sharp(buffer).extract({ left: Math.floor(box.x), top: Math.floor(box.y), width: Math.floor(box.width), height: Math.floor(box.height) }).toFile('.impeccable/review/land-sponsored/saved-search-editor-mobile.png');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click(); await editor.waitFor({ state: 'detached' }); await page.reload(); await results.getByRole('button', { name: 'Edit search', exact: true }).click(); await results.locator('form').getByText('Refine search criteria', { exact: true }).click();
  assert.equal(await results.locator('form').getByLabel('Land use', { exact: true }).inputValue(), 'residential'); assert.equal(await results.locator('form').getByLabel('Road access', { exact: true }).inputValue(), 'footpath');
  saved = (await db.doc(`users/owner/savedSearches/${id}`).get()).data(); assert.equal(saved.filters.landUse, 'residential'); assert.equal(saved.filters.roadAccess, 'footpath'); assert.equal(saved.filters.furnishing, '');
  assert.deepEqual(errors, []); await writeFile('.impeccable/review/land-sponsored/saved-search-checks.json', JSON.stringify({ creationRetainsLandCriteria: true, editingRetainsLandCriteria: true, reopeningRetainsLandCriteria: true, furnishingHiddenAndCleared: true, errors, productionDataWrites: 0 }, null, 2)); console.log('Land saved-search creation, editing, reopening and mobile editor checks passed.');
} finally { await browser.close(); }
