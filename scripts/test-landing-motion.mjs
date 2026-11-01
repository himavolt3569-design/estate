import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
 const page = await browser.newPage({ viewport: {width:390,height:900}, reducedMotion:'no-preference' });
 await page.goto('http://localhost:3016');
 const promos=page.locator('.landing-promos');
 await promos.getByRole('button',{name:'Pause advertisements'}).waitFor();
 await page.mouse.move(385,125);
 await page.waitForFunction(() => document.querySelector('.landing-promos__rail').scrollLeft > 100, {timeout:12000});
 await promos.getByRole('button',{name:'Pause advertisements'}).click();
 await promos.getByRole('button',{name:'Play advertisements'}).waitFor();
 await promos.getByRole('button',{name:'Show advertisement 3'}).click();
 await page.waitForFunction(() => document.querySelector('[aria-label="Show advertisement 3"]').getAttribute('aria-pressed')==='true');
 await page.waitForFunction(() => { const rail=document.querySelector('.landing-promos__rail'); return Math.abs(rail.scrollLeft-(rail.scrollWidth-rail.clientWidth))<2; });
 const before=await page.locator('.landing-promos__rail').evaluate(el=>el.scrollLeft);
 await page.waitForTimeout(6500);
 const after=await page.locator('.landing-promos__rail').evaluate(el=>el.scrollLeft);
 assert.ok(Math.abs(before-after)<2);
 const tablet = await browser.newPage({ viewport: {width:800,height:900}, reducedMotion:'no-preference' });
 await tablet.goto('http://localhost:3016');
 await tablet.locator('.landing-promos').getByRole('button',{name:'Pause advertisements'}).waitFor();
 await tablet.mouse.move(1,1);
 await tablet.waitForFunction(() => document.querySelector('.landing-promos__rail').scrollLeft > 100);
 await tablet.waitForFunction(() => document.querySelector('.landing-promos__rail').scrollLeft < 2);
 console.log('Automatic sliding, pause/play, direct slide selection, pause persistence and tablet boundary cycling passed.');
} finally {await browser.close();}
