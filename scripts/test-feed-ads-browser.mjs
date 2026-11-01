// Real gestures against localhost and isolated demo Firebase only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const folder = '.impeccable/review/feed-ad-scrolling'; await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [], errors = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const stopped = page => page.waitForFunction(() => { const rail = document.querySelector('.feed-ad-rail'); const now = performance.now(); if (Math.abs((rail.__lastLeft ?? -1000) - rail.scrollLeft) > .5) { rail.__lastLeft = rail.scrollLeft; rail.__stableSince = now; return false; } const max = rail.scrollWidth - rail.clientWidth; const aligned = [...rail.children].some(child => Math.abs(Math.min(child.offsetLeft, max) - rail.scrollLeft) < 2); return aligned && now - rail.__stableSince > 150; });
const advanced = page => page.waitForFunction(() => { const rail = document.querySelector('.feed-ad-rail'); return rail.scrollLeft > rail.clientWidth * .6; });
try {
  for (const [width, name] of [[1440, 'desktop'], [390, 'mobile']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: name === 'desktop' ? 'no-preference' : 'reduce', hasTouch: width < 768, isMobile: width < 768 });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3016'); const rail = page.locator('.feed-ad-rail').first(); await rail.waitFor();
    assert.equal(await page.locator('.landing-promos [data-campaign]').count(), 3);
    assert.equal(await page.locator('.rental-grid__ad').count(), 2);
    const order = await page.locator('.rental-grid').evaluate(grid => [...grid.children].map(element => element.classList.contains('rental-grid__ad') ? 'ad' : 'listing'));
    assert.deepEqual(order.map((kind, index) => kind === 'ad' ? index : -1).filter(index => index >= 0), [4, 9]);
    assert.equal(await page.locator('.rental-grid__ad .ad-carousel__controls, .rental-grid__ad button').count(), 0);
    assert.ok(await rail.evaluate(element => element.scrollWidth > element.clientWidth));
    const initial = await page.locator('.feed-ad-rail').evaluateAll(rails => rails.map(rail => rail.firstElementChild.dataset.campaign)); assert.equal(new Set(initial).size, 2);
    await rail.scrollIntoViewIfNeeded(); await page.evaluate(() => document.fonts.ready); await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); await settle(page);
    const box = await rail.boundingBox(); const y = box.y + box.height / 2;
    if (name === 'desktop') {
      await page.mouse.move(box.x + box.width * .85, y); await page.mouse.down(); await page.mouse.move(box.x + box.width * .1, y, { steps: 14 }); await page.mouse.up();
      await advanced(page); assert.equal(context.pages().length, 1, 'Dragging must not open the advertiser');
      checks.push('Desktop mouse drag advances the native scroll position without navigating.');
    } else {
      const client = await context.newCDPSession(page); const start = box.x + box.width - 25; const end = box.x + 25;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
      for (let step = 1; step <= 12; step++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * step / 12, y }] }); await settle(page); }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await advanced(page);
      checks.push('Real phone touch swipe advances the native scroll position.');
    }
    await stopped(page);
    await rail.locator('img').evaluateAll(images => Promise.all(images.filter(image => { const rect = image.getBoundingClientRect(); return rect.right > 0 && rect.left < innerWidth; }).map(image => image.decode())));
    await page.screenshot({ path: `${folder}/${name}-scrolled.png` });
    await rail.focus(); await page.keyboard.press('Home'); await page.waitForFunction(() => document.querySelector('.feed-ad-rail').scrollLeft < 2);
    await page.screenshot({ path: `${folder}/${name}-start.png` }); await page.keyboard.press('ArrowRight'); await advanced(page);
    checks.push(`${name}: keyboard Home and ArrowRight browse ads without visible controls.`);
    if (name === 'desktop') {
      await page.keyboard.press('Home'); await page.waitForFunction(() => document.querySelector('.feed-ad-rail').scrollLeft < 2); await page.mouse.move(box.x + box.width / 2, y); await page.mouse.wheel(box.width, 0); await advanced(page);
      await stopped(page);
      checks.push('Desktop horizontal wheel/trackpad input scrolls the rail.');
      const active = await rail.evaluate(element => [...element.children].reduce((best, child, index, children) => Math.abs(child.offsetLeft - element.scrollLeft) < Math.abs(children[best].offsetLeft - element.scrollLeft) ? index : best, 0));
      await rail.evaluate(element => { window.__clickedAd = ''; element.addEventListener('click', event => { const link = event.target.closest('a'); if (link) { event.preventDefault(); window.__clickedAd = link.href; } }, { once: true }); });
      const link = rail.locator('a').nth(active); const href = await link.getAttribute('href'); await link.click(); assert.equal(await page.evaluate(() => window.__clickedAd), href);
      checks.push('A normal ad click still reaches its destination after dragging; test intercept prevents external navigation.');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', { name: 'Show more listings', exact: true }).click(); assert.equal(await page.locator('.rental-grid__ad').count(), 3);
    const starters = await page.locator('.feed-ad-rail').evaluateAll(rails => rails.map(rail => rail.firstElementChild.dataset.campaign)); assert.equal(new Set(starters).size, 3);
    const unique = await page.locator('.feed-ad-rail').evaluateAll(rails => rails.every(rail => new Set([...rail.children].map(slide => slide.dataset.campaign)).size === rail.children.length)); assert.ok(unique);
    checks.push(`${name}: distinct starting ads, no cloned campaigns inside a rail, no page overflow.`); await context.close();
  }
  assert.deepEqual(errors, []); await writeFile(`${folder}/checks.json`, JSON.stringify({ checks, errors, productionDataWrites: 0 }, null, 2)); console.log('Actual mouse drag, touch swipe, horizontal wheel and keyboard ad scrolling passed without visible controls.');
} finally { await browser.close(); }
