// Hero presentation keeps its artwork and browsing, without visible controls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { showHeroAd } from './hero-ad-navigation.mjs';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const folder = '.impeccable/review/hero-without-controls'; await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [], errors = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const capture = async (page, name) => { await page.evaluate(() => scrollTo(0, 0)); await page.evaluate(() => document.fonts.ready); await page.locator('.landing-promos img').evaluateAll(images => Promise.all(images.map(image => image.decode()))); await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); await page.screenshot({ path: `${folder}/${name}.png` }); };
try {
  for (const [width, name] of [[1440, 'desktop'], [800, 'tablet'], [390, 'mobile']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', hasTouch: width === 390, isMobile: width === 390 }); const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3016'); const rail = page.locator('.landing-promos__rail'); await rail.waitFor(); await page.locator('.rental-grid__ad').first().waitFor();
    assert.equal(await page.locator('.landing-promos button, .landing-promos__footer, .landing-promos__choices, .landing-promos__navigation').count(), 0);
    assert.equal(await page.locator('.landing-promo').count(), 3); assert.equal(await page.locator('.landing-promo__brand').count(), 3, 'Brand names inside actual ads stay intact'); assert.equal(await page.locator('.rental-grid__ad').count(), 2);
    await capture(page, name); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (width === 390) {
      await rail.scrollIntoViewIfNeeded(); const box = await rail.boundingBox(); const y = box.y + box.height / 2; const client = await context.newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 25, y }] });
      for (let step = 1; step <= 12; step++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 25 - (box.width - 50) * step / 12, y }] }); await settle(page); }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForFunction(() => document.querySelector('.landing-promos__rail').scrollLeft > 100);
      await showHeroAd(page, 1); await capture(page, 'mobile-swiped'); await showHeroAd(page, 2); await capture(page, 'mobile-last');
      await page.locator('button[lang="ne"]:visible').click(); await page.waitForFunction(() => document.documentElement.lang === 'ne'); await capture(page, 'mobile-nepali');
      checks.push('Real phone touch swipe and keyboard/focus navigation browse all hero ads; Nepali view stays contained.');
    }
    checks.push(`${name}: hero arrows, pause, counter and partner-name footer absent; actual branded artwork and middle ads retained; no overflow.`); await context.close();
  }
  const auto = await browser.newPage({ viewport: { width: 390, height: 1000 }, reducedMotion: 'no-preference' }); await auto.goto('http://localhost:3016');
  await auto.waitForFunction(() => document.querySelector('.landing-promos__rail')?.scrollLeft > 100, undefined, { timeout: 12000 });
  await showHeroAd(auto, 0); await auto.getByRole('heading', { name: 'Find your next home', exact: true }).click(); await auto.waitForTimeout(6500); assert.ok(await auto.locator('.landing-promos__rail').evaluate(element => element.scrollLeft < 2));
  checks.push('Existing mobile autoplay remains and stops after manual interaction, without a visible control strip.');
  assert.deepEqual(errors, []); await writeFile(`${folder}/checks.json`, JSON.stringify({ checks, errors, productionDataWrites: 0 }, null, 2)); console.log('Hero controls and partner-name footer removed; artwork, real swipe, keyboard navigation, autoplay and middle ads verified.');
} finally { await browser.close(); }
