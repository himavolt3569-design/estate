// Read-only localhost browser QA. No sign-in or Firebase data writes.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const folder =
  process.env.LAND_SCREENSHOT_DIR ||
  'C:/Users/Prashon/.gemini/antigravity/brain/f9d566ff-5f56-4e61-aa06-0619d65a0af4/screenshots/land-measurement';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const checks = [], errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  acceptDownloads: true,
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});
page.setDefaultTimeout(30000);
const base = process.env.LAND_CALCULATOR_BASE_URL || 'http://127.0.0.1:3028';
const check = (label, condition) => {
  assert.ok(condition, label);
  checks.push(label);
};
const result = () => page.getByRole('heading', { name: 'Calculated boundary', exact: true });
const calculate = () => page.getByRole('button', { name: 'Calculate land', exact: true }).click();
const output = (label) =>
  page
    .locator('#measure-land dl > div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('dd');

async function capture(name) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal {display:none!important}' });
  check(
    `${name}: no viewport overflow`,
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  const path = `${folder}/${name}.png`;
  await page.screenshot({ path, fullPage: true, caret: 'initial' });
  return path;
}

async function fillCorners(values) {
  const rows = page.locator('#measure-land fieldset');
  while ((await rows.count()) < values.length)
    await page.getByRole('button', { name: 'Add corner', exact: true }).click();
  while ((await rows.count()) > values.length) await rows.last().getByRole('button').click();
  for (let i = 0; i < values.length; i++) {
    await rows.nth(i).locator('input').nth(0).fill(String(values[i][0]));
    await rows.nth(i).locator('input').nth(1).fill(String(values[i][1]));
  }
}

try {
  // 1. Header Tools dropdown separation on home page
  await page.goto(base + '/');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Tools', exact: true })
    .click();
  const toolMeasure = page.getByRole('menuitem', { name: 'Land measurement', exact: true });
  const toolSize = page.getByRole('menuitem', { name: 'Land size', exact: true });
  const toolEmi = page.getByRole('menuitem', { name: 'EMI calculator', exact: true });
  check(
    'Tools dropdown exposes 3 separated links',
    (await toolMeasure.getAttribute('href')) === '/land-measurement' &&
      (await toolSize.getAttribute('href')) === '/land-size' &&
      (await toolEmi.getAttribute('href')) === '/emi',
  );
  await toolMeasure.click();
  await page.waitForURL('**/land-measurement');

  // 2. Legacy /land-size#measure-land redirect -> /land-measurement
  await page.goto(base + '/land-size#measure-land');
  await page.waitForURL('**/land-measurement');
  await page.getByRole('heading', { name: 'Land measurement', exact: true }).waitFor();
  check(
    '/land-measurement hosts calculator without embedded converter',
    (await page.locator('#measure-land').count()) === 1 &&
      (await page.locator('#area-amount').count()) === 0,
  );
  await capture('desktop-empty');

  // 3. Actionable empty error
  await calculate();
  await page.locator('#measure-land [role=alert]').waitFor();
  check(
    'Blank measurements produce an actionable focused error',
    await page.locator('#measure-land [role=alert]').evaluate((el) => el === document.activeElement),
  );

  // 4. Rectangle calculation, dual Nepali+Metric units, dual m+ft measurements & 3D modes
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  check(
    'Examples are explicitly loaded and do not masquerade as calculated user data',
    (await result().count()) === 0,
  );
  await calculate();
  check(
    '30 × 20 m rectangle has area 600 m²',
    (await output('Area (square metres)').innerText()) === '600 m²',
  );
  await page.getByRole('button', { name: 'Calculate land', exact: true }).hover();
  await page.waitForTimeout(250);
  check(
    'Calculate hover has accessible white-on-dark-crimson contrast',
    (await page
      .getByRole('button', { name: 'Calculate land', exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(182, 17, 58)',
  );
  check(
    'Rectangle perimeter shows dual metres and feet',
    (await output('Perimeter').innerText()) === '100 m · 328.084 ft',
  );
  check(
    'Bounding box shows dual metres and feet',
    (await output('Bounding box (span X × Y)').innerText()) ===
      '30 × 20 m (98.4252 × 65.6168 ft)',
  );
  check(
    'Dual Nepali & Metric panels render alongside calculated boundary',
    (await page.locator('#measure-land section[aria-label="Nepali Units"]').count()) === 1 &&
      (await page.locator('#measure-land section[aria-label="Metric & Standard Units"]').count()) ===
        1 &&
      (await output('Hectares (ha)').innerText()) === '0.06 ha',
  );
  const firstRowText = await page.locator('#measure-land tbody tr').first().innerText();
  check(
    'Four corners, both diagonals, interior angles, dual m·ft edges, and 3D preview are visible',
    (await page.locator('#measure-land tbody tr').count()) === 4 &&
      firstRowText.includes('90°') &&
      firstRowText.includes('m ·') &&
      firstRowText.includes('ft') &&
      (await output('Diagonal AC').innerText()).includes('m ·') &&
      (await output('Diagonal BD').innerText()).includes('m ·') &&
      (await page.getByRole('img', { name: 'Scaled 3D boundary preview' }).count()) === 1,
  );
  check(
    'Dimensions do not invent a geographic location',
    (await page.getByText('Geographic location needs GPS coordinates.', { exact: false }).count()) ===
      1 && (await page.getByRole('link', { name: /Open corner A/ }).count()) === 0,
  );

  // 5. 3D camera modes, layer toggles, image overlay, and PNG export
  const isoBtn = page.getByRole('button', { name: '3D Isometric', exact: true });
  const perspBtn = page.getByRole('button', { name: '3D Perspective', exact: true });
  const planBtn = page.getByRole('button', { name: '2D Plan', exact: true });
  check('3D Isometric is active by default', (await isoBtn.getAttribute('aria-pressed')) === 'true');
  await perspBtn.click();
  check('3D Perspective mode activates cleanly', (await perspBtn.getAttribute('aria-pressed')) === 'true');
  await planBtn.click();
  check('2D Plan mode activates cleanly', (await planBtn.getAttribute('aria-pressed')) === 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  check('Reset restores 3D Isometric view', (await isoBtn.getAttribute('aria-pressed')) === 'true');

  const anglesLayerBtn = page.getByRole('button', { name: 'Angles', exact: true });
  await anglesLayerBtn.click();
  check('Layer toggles update aria-pressed state', (await anglesLayerBtn.getAttribute('aria-pressed')) === 'false');
  await anglesLayerBtn.click();

  const pngBase64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 56, 56);
    ctx.fillStyle = '#148e5a';
    ctx.fillRect(14, 14, 36, 36);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#measure-land input[type="file"]').setInputFiles({
    name: 'parcel-naksa.png',
    mimeType: 'image/png',
    buffer: Buffer.from(pngBase64, 'base64'),
  });
  await page.getByText('Clipped Boundary Image Overlay', { exact: true }).waitFor();
  const pngDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const pngDownload = await pngDownloadPromise;
  const pngBytes = await readFile(await pngDownload.path());
  check(
    'Download PNG exports a valid land-boundary-3d.png image',
    pngDownload.suggestedFilename() === 'land-boundary-3d.png' &&
      pngBytes.length > 1000 &&
      pngBytes[0] === 0x89 &&
      pngBytes[1] === 0x50 &&
      pngBytes[2] === 0x4e &&
      pngBytes[3] === 0x47,
  );
  await capture('desktop-3d');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();

  const converterLink = page.getByRole('link', { name: /Open in Land Size Converter/ });
  const converterHref = await converterLink.getAttribute('href');
  const converterSqm = Number(new URL(converterHref || '', base).searchParams.get('sqm'));
  check(
    'Land measurement links directly to /land-size?sqm=600',
    Boolean(converterHref?.startsWith('/land-size?sqm=')) && Math.abs(converterSqm - 600) < 1e-9,
  );

  // 6. Mobile 390px overflow, stale clearing, diagonal validation, feet JSON export
  await page.setViewportSize({ width: 390, height: 900 });
  await capture('mobile-3d');
  await page.locator('#parcel-diagonal').fill('35');
  check('Editing immediately removes stale results', (await result().count()) === 0);
  await calculate();
  check(
    'An inconsistent rectangle diagonal is rejected',
    (await page.locator('#measure-land [role=alert]').innerText()).includes('does not match'),
  );
  await capture('mobile-error');
  await page.locator('#parcel-unit').selectOption('ft');
  await page.locator('#parcel-length').fill('40');
  await page.locator('#parcel-width').fill('30');
  await page.locator('#parcel-diagonal').fill('50');
  await calculate();
  check(
    'Feet convert accurately to 111.483648 m²',
    (await output('Area (square metres)').innerText()) === '111.483648 m²',
  );
  const localDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download measurements', exact: true }).click();
  const localDownload = await localDownloadPromise;
  const localData = JSON.parse(await readFile(await localDownload.path(), 'utf8'));
  check(
    'Measurement download preserves raw metre coordinates and numeric precision',
    Math.abs(localData.areaSqm - 111.483648) < 1e-9 &&
      localData.lengthUnit === 'm' &&
      localData.corners.length === 4,
  );

  // 7. Four sides + diagonal
  await page.locator('#parcel-method').selectOption('diagonal');
  await page.locator('#parcel-unit').selectOption('m');
  for (const [id, value] of Object.entries({
    ab: 4,
    bc: Math.sqrt(10),
    cd: Math.sqrt(26),
    da: 4,
    ac: Math.sqrt(34),
  }))
    await page.locator(`#parcel-${id}`).fill(String(value));
  await calculate();
  check(
    'Irregular four-side/diagonal calculation returns 16 m²',
    (await output('Area (square metres)').innerText()) === '16 m²',
  );
  await page.locator('#parcel-ac').fill('100');
  await calculate();
  check(
    'Impossible triangle measurements are rejected',
    (await page.locator('#measure-land [role=alert]').innerText()).includes('two valid triangles'),
  );

  // 8. Concave L-shape example & custom All corners checks
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Load L-shaped example', exact: true }).click();
  await calculate();
  const lShapeTable = await page.locator('#measure-land tbody').innerText();
  check(
    'L-shaped concave preset calculates 240 m², 6 corners, and 270° reflex angle',
    (await output('Area (square metres)').innerText()) === '240 m²' &&
      (await page.locator('#measure-land tbody tr').count()) === 6 &&
      lShapeTable.includes('270°'),
  );
  await capture('desktop-l-shape');

  await page.setViewportSize({ width: 390, height: 900 });
  await fillCorners([
    [0, 0],
    [4, 0],
    [4, 1],
    [1, 1],
    [1, 4],
    [0, 4],
  ]);
  await calculate();
  check(
    'All-corners mode handles six-corner concave land',
    (await output('Area (square metres)').innerText()) === '7 m²' &&
      (await page.locator('#measure-land tbody tr').count()) === 6,
  );
  await fillCorners([
    [0, 0],
    [4, 4],
    [4, 0],
    [0, 4],
  ]);
  await calculate();
  check(
    'Crossed local boundaries are rejected',
    (await page.locator('#measure-land [role=alert]').innerText()).includes('cross'),
  );
  await fillCorners([
    [0, 0],
    [4, 0],
    [0, 3],
  ]);
  await calculate();
  check(
    'Triangle corners work and cannot be removed below three',
    (await output('Area (square metres)').innerText()) === '6 m²' &&
      (await page.locator('#measure-land fieldset button:disabled').count()) === 3,
  );

  // 9. GPS WGS84 corners & 320px range error
  await page.locator('#parcel-system').selectOption('gps');
  check(
    'Changing coordinate systems clears inputs and stale results',
    (await page.locator('#measure-land fieldset input').first().inputValue()) === '' &&
      (await result().count()) === 0,
  );
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await calculate();
  check(
    'GPS area matches independent reference in the UI',
    (await output('Area (square metres)').innerText()) === '655.797713 m²',
  );
  check(
    'GPS mode shows True North and maps corner A',
    (await page.getByText('True North', { exact: true }).count()) === 1 &&
      (await page.getByRole('link', { name: 'Open corner A on map', exact: true }).getAttribute('href')).includes(
        'query=27.7,85.3',
      ),
  );
  await capture('mobile-gps');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture('desktop-gps');
  const geoDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download measurements', exact: true }).click();
  const geoDownload = await geoDownloadPromise;
  const geoData = JSON.parse(await readFile(await geoDownload.path(), 'utf8'));
  check(
    'GPS JSON preserves ordered lat/lon vertices, explicit WGS84 geodesic model and full area precision',
    geoData.reference === 'WGS84' &&
      geoData.edgeModel === 'Shortest WGS84 ellipsoidal geodesics' &&
      geoData.corners.length === 4 &&
      geoData.corners[0].lat === 27.7 &&
      geoData.corners[0].lon === 85.3 &&
      !geoData.geometry &&
      Math.abs(geoData.areaSqm - 655.7977133691311) < 1e-5,
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.locator('#measure-land fieldset input').first().fill('90');
  await calculate();
  check(
    'GPS range errors are actionable',
    (await page.locator('#measure-land [role=alert]').innerText()).includes('between −85° and 85°'),
  );
  await capture('small-mobile-error');

  // 10. ?sqm= prefill on separated /land-size route
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/land-size?sqm=600');
  await page.getByRole('heading', { name: 'Land size', exact: true }).waitFor();
  check(
    '/land-size?sqm=600 pre-populates converter without LandCalculator',
    (await page.locator('#measure-land').count()) === 0 &&
      (await page.locator('#area-unit').inputValue()) === 'sqm' &&
      (await page.locator('#area-amount').inputValue()) === '600' &&
      (await page.locator('section[aria-label="Metric & Standard Units"]').innerText()).includes(
        '0.06 ha',
      ),
  );
  await page.getByRole('button', { name: '2:1', exact: true }).click();
  check(
    'Proportional 3D footprint aspect selector updates',
    (await page.getByRole('button', { name: '2:1', exact: true }).getAttribute('aria-pressed')) ===
      'true',
  );
  await capture('desktop-land-size');

  // 11. Nepali locale across both separated routes (320px & 390px)
  await context.addCookies([{ name: 'kitta_locale', value: 'ne', domain: '127.0.0.1', path: '/' }]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(base + '/land-measurement');
  await page.getByRole('heading', { name: 'जग्गाको मापन', exact: true }).waitFor();
  await page.getByRole('button', { name: 'उदाहरण राख्नुहोस्', exact: true }).click();
  await page.getByRole('button', { name: 'जग्गाको गणना गर्नुहोस्', exact: true }).click();
  check(
    'Nepali labels and results render on /land-measurement',
    (await output('क्षेत्रफल (वर्ग मिटर)').innerText()).includes('६००') &&
      (await page.locator('#measure-land [data-land-system=ropani]').innerText()).includes('रोपनी'),
  );
  await capture('small-mobile-nepali');
  await page.setViewportSize({ width: 390, height: 900 });
  await capture('mobile-nepali');

  await page.goto(base + '/land-size');
  await page.getByRole('heading', { name: 'जग्गाको क्षेत्रफल', exact: true }).waitFor();
  check(
    'Nepali converter route stays separated and usable',
    (await page.locator('#area-amount').count()) === 1 &&
      (await page.locator('#measure-land').count()) === 0,
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await capture('small-mobile-nepali-size');

  check('No uncaught console or page errors', errors.length === 0);
} finally {
  await writeFile(`${folder}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: checks.length, errors, folder }, null, 2));
