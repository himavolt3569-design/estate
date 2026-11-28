// Read-only localhost browser QA for Nepali units & dual metric/Nepali system parity.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const folder =
  process.env.LAND_NEPALI_SCREENSHOT_DIR ||
  'C:/Users/Prashon/.gemini/antigravity/brain/f9d566ff-5f56-4e61-aa06-0619d65a0af4/screenshots/land-nepali-system';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  acceptDownloads: true,
});
const page = await context.newPage();
const checks = [], errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});
page.setDefaultTimeout(30000);
const base = process.env.LAND_CALCULATOR_BASE_URL || 'http://127.0.0.1:3028';
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
};
const calc = page.locator('#measure-land');
const converter = page.locator('section[aria-labelledby=land-converter-title]');
const metric = (region, label) =>
  region.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd');
const values = (region, system) =>
  region.locator('[data-land-system=' + system + '] dd span.text-base').allTextContents();

async function capture(name) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal {display:none!important}' });
  check(
    name + ': no viewport overflow',
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  const path = `${folder}/${name}.png`;
  await page.screenshot({ path, fullPage: true, caret: 'initial' });
  return path;
}

async function rectangleRopani(ne = false) {
  await calc.locator('#parcel-unit').selectOption('ft');
  await calc.locator('#parcel-length').fill('७४');
  await calc.locator('#parcel-width').fill('७४');
  await calc
    .getByRole('button', { name: ne ? 'जग्गाको गणना गर्नुहोस्' : 'Calculate land', exact: true })
    .click();
}

try {
  // 1. /land-measurement with Nepali digits (74 × 74 ft = 1 ropani = 5,476 ft²)
  await page.goto(base + '/land-measurement');
  await rectangleRopani();
  check(
    'Nepali rectangle digits calculate one exact ropani from 74 × 74 ft',
    (await values(calc, 'ropani')).join(',') === '1,0,0,0',
  );
  check(
    'Both Nepali systems and Metric panel are visible in calculated land results',
    (await calc.locator('[data-land-system]').count()) === 2 &&
      (await calc.locator('section[aria-label="Metric & Standard Units"]').count()) === 1,
  );
  check(
    'Nepali conversion retains the geometric area in square feet and hectares',
    (await metric(calc, 'Area (square feet)').innerText()) === '5,476 ft²' &&
      (await metric(calc, 'Hectares (ha)').innerText()).includes('ha'),
  );
  const downloadPromise = page.waitForEvent('download');
  await calc.getByRole('button', { name: 'Download measurements', exact: true }).click();
  const data = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  check(
    'Downloads include named Nepali units and explicit square-foot convention',
    data.nepaliArea.ropaniAanaPaisaDaam.ropani === 1 &&
      data.nepaliArea.ropaniAanaPaisaDaam.aana === 0 &&
      data.nepaliArea.convention.ropaniSqFt === 5476,
  );

  await calc.locator('#parcel-method').selectOption('diagonal');
  await calc.locator('#parcel-unit').selectOption('m');
  for (const [side, value] of Object.entries({ ab: '४', bc: '३', cd: '४', da: '३', ac: '५' }))
    await calc.locator('#parcel-' + side).fill(value);
  await calc.getByRole('button', { name: 'Calculate land', exact: true }).click();
  check(
    'Sides and diagonal accept Nepali numerals',
    (await metric(calc, 'Area (square metres)').innerText()) === '12 m²',
  );

  await calc.locator('#parcel-method').selectOption('corners');
  await calc.locator('#parcel-system').selectOption('gps');
  const corners = [
    ['२७.७', '८५.३'],
    ['२७.७', '८५.३००३'],
    ['२७.७००२', '८५.३००३'],
    ['२७.७००२', '८५.३'],
  ];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++)
      await calc.locator('fieldset').nth(i).locator('input').nth(j).fill(corners[i][j]);
  await calc.getByRole('button', { name: 'Calculate land', exact: true }).click();
  check(
    'GPS corners accept Nepali numerals without changing the WGS84 result',
    (await metric(calc, 'Area (square metres)').innerText()) === '655.797713 m²',
  );
  await capture('desktop-measurement-nepali-digits');

  // Handoff from /land-measurement -> /land-size?sqm=...
  await calc.getByRole('link', { name: /Open in Land Size Converter/ }).click();
  await page.waitForURL('**/land-size?sqm=*');
  check(
    'Land measurement hands off exact sqm to /land-size?sqm=...',
    (await converter.locator('#area-unit').inputValue()) === 'sqm' &&
      (await converter.locator('#area-amount').inputValue()).startsWith('655.797713'),
  );

  // 2. /land-size separated converter & Proportional 3D Plot Footprint
  await page.goto(base + '/land-size');
  check('Separated /land-size omits #measure-land', (await calc.count()) === 0);
  await converter.locator('#area-unit').selectOption('ropani');
  await converter.locator('#area-amount').fill('१');
  check(
    'Single-unit converter agrees with rectangle calculation',
    (await metric(converter, 'Square feet').innerText()) === '5,476',
  );
  check(
    'Paisa, daam, and hectare are available as input units',
    (await converter
      .locator('#area-unit option[value=paisa], #area-unit option[value=daam], #area-unit option[value=hectare]')
      .count()) === 3,
  );
  await converter.locator('#area-unit').selectOption('hectare');
  await converter.locator('#area-amount').fill('१');
  check(
    'Hectare input converts accurately to 10,000 m²',
    (await metric(converter, 'Square metres').innerText()) === '10,000',
  );

  await converter.locator('#area-input-system').selectOption('ropani');
  for (const [unit, value] of Object.entries({ ropani: '१', aana: '२', paisa: '३', daam: '०.५' }))
    await converter.locator('#area-' + unit).fill(value);
  check(
    'Compound Ropani–Aana–Paisa–Daam accepts Nepali numerals and fractional daam',
    (await metric(converter, 'Square feet').innerText()) === '6,427.882813' &&
      (await values(converter, 'ropani')).join(',') === '1,2,3,0.5',
  );
  await converter.getByRole('button', { name: '3D Perspective', exact: true }).click();
  await converter.getByRole('button', { name: '1:1', exact: true }).click();
  check(
    'Proportional 3D footprint renders canvas and responds to aspect & projection controls',
    (await converter.locator('canvas').count()) === 1 &&
      (await converter.getByRole('button', { name: '1:1', exact: true }).getAttribute('aria-pressed')) ===
        'true' &&
      (await converter
        .getByRole('button', { name: '3D Perspective', exact: true })
        .getAttribute('aria-pressed')) === 'true',
  );
  await capture('desktop-land-size');

  for (const [unit, value] of Object.entries({ ropani: '०', aana: '१६', paisa: '०', daam: '०' }))
    await converter.locator('#area-' + unit).fill(value);
  check('Sixteen aana carries to one ropani', (await values(converter, 'ropani')).join(',') === '1,0,0,0');

  await converter.locator('#area-input-system').selectOption('bigha');
  for (const [unit, value] of Object.entries({ bigha: '१', kattha: '२', dhur: '३.५' }))
    await converter.locator('#area-' + unit).fill(value);
  check(
    'Bigha–Kattha–Dhur accepts fractional dhur',
    (await metric(converter, 'Square feet').innerText()) === '80,827.875' &&
      (await values(converter, 'bigha')).join(',') === '1,2,3.5',
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await capture('mobile');
  await converter.locator('#area-bigha').fill('१.५');
  check(
    'Invalid fractional larger units clear stale converter results',
    (await metric(converter, 'Square feet').innerText()) === '-' &&
      (await converter.locator('[data-land-system]').count()) === 0 &&
      (await converter.locator('#area-converter-error').getAttribute('role')) === 'alert',
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await capture('small-mobile-error');
  await converter.locator('#area-bigha').fill('१');
  await converter.locator('#area-input-system').selectOption('single');
  await converter.locator('#area-unit').selectOption('daam');
  await converter.locator('#area-amount').fill('०.५');
  check(
    'Fractional single-unit input remains precise',
    (await metric(converter, 'Square feet').innerText()) === '10.695313',
  );
  await converter.locator('#area-amount').fill('१२abc');
  check(
    'Malformed numbers are rejected instead of partially parsed',
    (await metric(converter, 'Square feet').innerText()) === '-',
  );
  await converter.locator('#area-unit').selectOption('sqm');
  await converter.locator('#area-amount').fill('1e300');
  check(
    'Finite but unsupported extreme inputs are rejected without Infinity or NaN outputs',
    (await metric(converter, 'Square feet').innerText()) === '-' &&
      !(await converter.innerText()).includes('NaN'),
  );

  // 3. Nepali UI locale on BOTH /land-measurement and /land-size
  await context.addCookies([{ name: 'kitta_locale', value: 'ne', domain: '127.0.0.1', path: '/' }]);
  await page.goto(base + '/land-measurement');
  await rectangleRopani(true);
  check(
    'Nepali language measurement uses local unit names and Nepali numeral code points',
    (await calc.locator('[data-land-system=ropani]').innerText()).includes('रोपनी') &&
      (await values(calc, 'ropani')).join(',') === '१,०,०,०',
  );
  await capture('small-mobile-nepali-measurement');
  await page.setViewportSize({ width: 390, height: 900 });
  await capture('mobile-nepali-measurement');

  await page.goto(base + '/land-size');
  await converter.locator('#area-input-system').selectOption('ropani');
  for (const [unit, value] of Object.entries({ ropani: '१', aana: '२', paisa: '३', daam: '०.५' }))
    await converter.locator('#area-' + unit).fill(value);
  check(
    'Nepali language land-size converter uses local unit names and Devanagari digits',
    (await converter.locator('[data-land-system=ropani]').innerText()).includes('रोपनी') &&
      (await values(converter, 'ropani')).join(',') === '१,२,३,०.५' &&
      (await converter.locator('#area-unit').count()) === 0,
  );
  await capture('mobile-nepali');
  await page.setViewportSize({ width: 320, height: 900 });
  await capture('small-mobile-nepali');

  check('No uncaught console or page errors', errors.length === 0);
} finally {
  await writeFile(`${folder}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: checks.length, errors, folder }, null, 2));
