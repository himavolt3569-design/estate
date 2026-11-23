// Local application regression checks; seed with test-campaign-browser.mjs --seed-only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-gpu'] });
const folder = new URL('../.impeccable/review/', import.meta.url);
await mkdir(folder, { recursive: true });
const checks = [];
const errors = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
const snapshot = page => page.evaluate(() => {
  const rect = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; };
  return { scrollY, header: rect('header'), filters: rect('.rental-filters'), bodyWidth: document.body.getBoundingClientRect().width };
});
function unchanged(before, after, label) {
  assert.ok(Math.abs(before.scrollY - after.scrollY) <= 1, `${label}: scroll position changed`);
  for (const region of ['header', 'filters']) for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[region][key] - after[region][key]) <= 1, `${label}: ${region}.${key} changed`);
  assert.ok(Math.abs(after.header.y) <= 1, `${label}: sticky navbar disappeared`);
  assert.ok(Math.abs(before.bodyWidth - after.bodyWidth) <= 1, `${label}: page width changed`);
}
try {
  for (const [width, name, mobile, classic] of [[1440, 'desktop', false, false], [1440, 'desktop-gutter', false, true], [800, 'tablet', false, false], [390, 'mobile', true, false], [320, 'narrow', true, false]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3016', { waitUntil: 'domcontentloaded' });
    await page.locator('.rental-grid > article').first().waitFor();
    await page.locator('.home-partners .sponsor-panel').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' + (classic ? 'html::-webkit-scrollbar{width:16px}' : '') });
    await settle(page);

    const tools = page.getByRole('navigation', { name: width >= 1024 ? 'Main navigation' : 'Browse', exact: true }).getByRole('button', { name: 'Tools', exact: true });
    if (width >= 1024) await page.evaluate(() => scrollTo(0, 900));
    await tools.scrollIntoViewIfNeeded();
    await settle(page);
    const toolsBefore = await snapshot(page);
    await tools.click();
    await page.getByRole('menu').waitFor();
    await settle(page);
    unchanged(toolsBefore, await snapshot(page), `${name} Tools open`);
    await page.screenshot({ path: fileURLToPath(new URL(`dropdown-tools-${name}.png`, folder)), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('menu').waitFor({ state: 'hidden' });
    await settle(page);
    unchanged(toolsBefore, await snapshot(page), `${name} Tools close`);
    assert.ok(await tools.evaluate(element => element === document.activeElement), 'Tools restores keyboard focus');
    checks.push(`${name}: Tools opens/closes without moving the navbar or page`);

    await page.locator('.rental-preferences > summary').click();
    for (const id of ['home-property-type', 'filter-property-type', 'filter-furnishing', 'filter-sort']) {
      const trigger = page.locator(`#${id}`);
      await trigger.scrollIntoViewIfNeeded();
      await settle(page);
      const before = await snapshot(page);
      await trigger.click();
      await page.getByRole('listbox').waitFor();
      await settle(page);
      unchanged(before, await snapshot(page), `${name} ${id} open`);
      if (id === 'filter-sort') {
        await page.screenshot({ path: fileURLToPath(new URL(`dropdown-sort-${name}.png`, folder)), animations: 'disabled' });
        await page.mouse.move(3, 300);
        await page.mouse.wheel(0, 180);
        await settle(page);
        unchanged(before, await snapshot(page), `${name} ${id} background wheel`);
      }
      await page.keyboard.press('Escape');
      await page.getByRole('listbox').waitFor({ state: 'hidden' });
      await settle(page);
      unchanged(before, await snapshot(page), `${name} ${id} close`);
      assert.ok(await trigger.evaluate(element => element === document.activeElement), `${id} restores focus`);
      checks.push(`${name}: ${id} preserves layout, scroll and focus`);
    }
    const sort = page.locator('#filter-sort');
    await sort.focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('listbox').waitFor();
    await settle(page);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.getByRole('listbox').waitFor({ state: 'hidden' });
    assert.match(await sort.innerText(), /Price: high to low/);
    checks.push(`${name}: keyboard option selection works`);
    await sort.click();
    await page.getByRole('listbox').waitFor();
    await settle(page);
    await page.mouse.click(3, 300);
    await page.getByRole('listbox').waitFor({ state: 'hidden' });
    checks.push(`${name}: outside click dismisses the dropdown`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  await writeFile(new URL('dropdown-stability-checks.json', folder), JSON.stringify({ checks, errors, source: 'Local website and disposable Firebase emulator fixtures' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} finally { await browser.close(); }
