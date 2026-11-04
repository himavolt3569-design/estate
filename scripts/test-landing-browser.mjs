import { showHeroAd } from './hero-ad-navigation.mjs';
// Local UI acceptance checks. Uses only seeded demo-merokotha-feature-tests data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const folder = new URL('../.impeccable/review/landing-refresh/', import.meta.url);
await mkdir(folder, { recursive: true });
const checks = [], errors = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const screenshot = async (page, name, fullPage = false) => {
  if (fullPage) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) {
        scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    });
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
    await page.evaluate(() => scrollTo(0, 0));
    await settle(page);
  }
  return page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, folder)), fullPage, animations: 'disabled' });
};
try {
  for (const [width, name] of [[390, 'mobile'], [320, 'narrow'], [500, 'phone-wide'], [800, 'tablet'], [1440, 'desktop']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    await page.goto('http://localhost:3016', { waitUntil: 'domcontentloaded' });
    await page.locator('.rental-grid > article').first().waitFor();
    await page.locator('.landing-promo').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal { display:none!important; }' });
    const layout = await page.evaluate(() => {
      const top = selector => document.querySelector(selector).getBoundingClientRect().top + scrollY;
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, ads: top('.landing-promos'), types: top('.property-categories'), filters: top('.rental-filters'), listings: top('.rental-grid'), map: !!document.querySelector('#rental-map-filter') };
    });
    assert.ok(layout.scrollWidth <= width + 1, `${name}: page overflows`);
    assert.ok(layout.ads < layout.types && layout.types < layout.filters && layout.filters < layout.listings, `${name}: requested content order`);
    assert.equal(layout.map, false, `${name}: listings are immediate without a default map`);
    assert.equal(await page.locator('.property-categories > button').count(), 8);
    assert.equal(await page.locator('#saved-search-disclosure').getAttribute('open'), null);
    assert.ok(layout.listings < (width < 1024 ? 900 : 780), `${name}: listings start too far down: ${layout.listings}`);
    await screenshot(page, name);
    await screenshot(page, `${name}-full`, true);
    checks.push({ name, layout });

    const categories = page.getByRole('group', { name: 'Property types', exact: true });
    await categories.getByRole('button', { name: 'Rooms', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.rental-grid > article h3')].every(x => x.textContent.includes('room')) && document.querySelectorAll('.rental-grid > article').length > 0);
    await categories.getByRole('button', { name: 'House', exact: true }).click();
    await page.getByRole('group', { name: 'Rent or buy' }).getByRole('button', { name: 'Buy', exact: true }).click();
    await page.getByRole('link', { name: 'Demo house for sale in Patan', exact: true }).waitFor();
    await categories.getByRole('button', { name: 'Flats', exact: true }).click();
    assert.equal(await page.getByRole('group', { name: 'Rent or buy' }).getByRole('button', { name: 'Buy', exact: true }).count(), 0);
    await categories.getByRole('button', { name: 'All properties', exact: true }).click();
    await page.getByRole('group', { name: 'Rent or buy' }).getByRole('button', { name: 'All', exact: true }).click();

    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.locator('#filter-min-price').fill('20000');
    await page.locator('#filter-max-price').fill('10000');
    await page.locator('#filter-budget-error').waitFor();
    assert.ok(await page.getByRole('button', { name: 'Show results', exact: true }).isDisabled());
    await page.locator('#filter-min-price').fill('12000');
    await page.locator('#filter-max-price').fill('16000');
    await page.locator('#filter-furnishing').click();
    await page.getByRole('option', { name: 'Semi furnished', exact: true }).click();
    await page.locator('.rental-filters').screenshot({ path: fileURLToPath(new URL(`${name}-filters.png`, folder)), animations: 'disabled' });
    await page.getByRole('button', { name: 'Show results', exact: true }).click();
    assert.equal(await page.locator('#property-filter-options').count(), 0);
    await page.waitForFunction(() => document.querySelectorAll('.rental-grid > article').length === 5);
    await page.locator('#filter-sort').click();
    await page.getByRole('option', { name: 'Price: high to low', exact: true }).click();
    assert.ok((await page.locator('.rental-grid > article h3').first().textContent()).includes('5'));
    await page.getByRole('button', { name: /Filters/ }).first().click();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: 'Show results', exact: true }).click();
    await page.locator('#filter-location').fill('No matching place xyz');
    await page.getByRole('heading', { name: 'No listings match these filters' }).waitFor();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.locator('.rental-grid > article').first().waitFor();
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.locator('#rental-map-filter .leaflet-container').waitFor();
    await page.getByRole('button', { name: 'Hide map', exact: true }).click();
    if (width <= 900) {
      await showHeroAd(page, 1);
      await settle(page);
      assert.equal(await page.locator('.landing-promos button').count(), 0);
      const hrefs = await page.locator('.landing-promo > a').evaluateAll(elements => elements.map(x => x.href));
      assert.deepEqual(hrefs, ['https://himavolt.com/', 'https://pitambari.vercel.app/', 'https://floor-clearner.vercel.app/']);
    }
    const language = page.locator('button[lang="ne"]:visible').first();
    await language.click();
    await page.waitForFunction(() => document.documentElement.lang === 'ne');
    await settle(page);
    await page.evaluate(() => scrollTo(0, 0));
    await screenshot(page, `${name}-nepali`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: translated overflow`);
    checks.push(`${name}: categories, rent/buy, flat rule, budget validation, furnishing, sort, reset, empty state, optional map and carousel passed`);
    await context.close();
  }
  await writeFile(new URL('checks.json', folder), JSON.stringify({ checks, errors, fixtures: 'Disposable local demo listings; screenshots are not production records' }, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} finally { await browser.close(); }
