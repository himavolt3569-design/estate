// Restored feed placements: localhost and isolated demo Firebase only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const folder = '.impeccable/review/feed-ads-restored'; await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [], errors = [];
try {
  for (const [width, name] of [[1440, 'desktop'], [390, 'mobile']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' }); const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3016'); await page.locator('.rental-grid__ad').first().waitFor();
    assert.equal(await page.locator('.landing-promos [data-campaign]').count(), 3);
    assert.equal(await page.locator('.rental-grid__ad').count(), 2);
    const order = await page.locator('.rental-grid').evaluate(grid => [...grid.children].map(element => element.classList.contains('rental-grid__ad') ? 'ad' : 'listing'));
    assert.deepEqual(order.map((kind, index) => kind === 'ad' ? index : -1).filter(index => index >= 0), [4, 9]);
    assert.equal(await page.locator('.rental-grid__ad .ad-carousel__controls, .rental-grid__ad button').count(), 0);
    const first = page.locator('.rental-grid__ad').first(); await first.scrollIntoViewIfNeeded(); await first.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.evaluate(() => document.fonts.ready); await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); await page.screenshot({ path: `${folder}/${name}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: 'Show more listings', exact: true }).click();
    assert.equal(await page.locator('.rental-grid__ad').count(), 3);
    const destinations = await page.locator('.rental-grid__ad a').evaluateAll(links => links.map(link => link.href)); assert.equal(new Set(destinations).size, 3);
    assert.equal(await page.locator('.rental-grid__ad .ad-carousel__controls, .rental-grid__ad button').count(), 0);
    checks.push(`${name}: top ads retained; ads after four and eight listings; all three unique feed campaigns on Show more; no feed controls or overflow.`);
    await context.close();
  }
  assert.deepEqual(errors, []); await writeFile(`${folder}/checks.json`, JSON.stringify({ checks, errors, productionDataWrites: 0 }, null, 2)); console.log('Desktop and mobile middle ads restored, unique within the feed, with no carousel controls.');
} finally { await browser.close(); }
