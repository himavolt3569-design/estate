// Local demo fixtures only: owner contact actions and the actual inquiry flow.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { chromium } = require('playwright');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
initializeApp({ projectId: 'demo-merokotha-feature-tests' });
const db = getFirestore(), base = 'http://localhost:3016', dir = '.impeccable/review/listing-contact-panel';
await mkdir(dir, { recursive: true });
await db.doc('listings/demo-0').update({ contactIsAnonymous: true, ownerName: 'Private lister', publicCallNumber: '', publicWhatsAppNumber: '' });
await db.doc('listings/demo-1').update({ publicCallNumber: '9800000000', publicWhatsAppNumber: '9800000000' });
try { await getAuth().getUser('contact-incomplete'); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; await getAuth().createUser({ uid: 'contact-incomplete', email: 'contact-incomplete@example.test', password: 'Test-pass-123' }); }
const checks = [], errors = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const makePage = async (width, uid) => {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Kathmandu' });
  const page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  if (uid) {
    await page.goto(base + '/sign-in'); await page.locator('#auth-email').fill(`${uid}@example.test`); await page.locator('#auth-password').fill('Test-pass-123');
    await page.getByRole('button', { name: 'Sign in with email', exact: true }).click(); await page.waitForURL('**/dashboard');
  }
  return page;
};
const capture = async (page, panel, name, context = false) => {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })));
  await page.addStyleTag({ content: 'nextjs-portal,[data-sonner-toaster]{display:none!important}' });
  await page.evaluate(() => scrollTo(0, 0));
  const box = await panel.boundingBox();
  const shot = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await sharp(shot).extract({ left: Math.floor(box.x), top: Math.floor(box.y), width: Math.floor(box.width), height: Math.floor(box.height) }).png().toFile(`${dir}/${name}.png`);
  if (context) await writeFile(`${dir}/${name}-context.png`, shot);
};
try {
  for (const width of [1440, 390]) {
    const owner = await makePage(width, 'owner'); await owner.goto(base + '/listing/demo-0');
    const ownerPanel = owner.getByRole('region', { name: 'Manage this listing' }); await ownerPanel.waitFor();
    check(`${width}px owner gets useful management actions`, await ownerPanel.getByRole('link', { name: 'Edit contact options' }).count() === 1 && await ownerPanel.getByRole('link', { name: 'View inquiries' }).count() === 1);
    check(`${width}px owner cannot send a self-inquiry`, await owner.locator('#message').count() === 0);
    check(`${width}px placeholder replaced`, await owner.getByText('This lister accepts inquiries through HamroKotha.', { exact: true }).count() === 0);
    await capture(owner, ownerPanel, `owner-${width}`, true);
    await ownerPanel.getByRole('link', { name: 'Edit contact options' }).click(); await owner.waitForURL('**/edit#edit-call'); await owner.locator('#edit-call').waitFor();
    await owner.waitForFunction(() => document.activeElement?.id === 'edit-call');
    check(`${width}px edit action lands at contact input`, await owner.locator('#edit-call').evaluate(element => { const box = element.getBoundingClientRect(); return document.activeElement === element && box.top >= 80 && box.bottom <= innerHeight; }));
    await owner.goto(base + '/listing/demo-0'); await owner.getByRole('link', { name: 'View inquiries', exact: true }).click(); await owner.waitForURL('**/dashboard?tab=inquiries');
    await owner.getByRole('heading', { name: 'Received inquiries', exact: true }).waitFor(); checks.push(`${width}px inquiries action opens received inquiries`);
    await owner.context().close();

    const visitor = await makePage(width, 'renter'); await visitor.goto(base + '/listing/demo-0');
    const panel = visitor.getByRole('region', { name: 'Ask about this property', exact: true }); await panel.waitFor();
    check(`${width}px one integrated contact form`, await visitor.locator('#message').count() === 1 && await visitor.getByText('This lister accepts inquiries through HamroKotha.', { exact: true }).count() === 0);
    await panel.getByRole('button', { name: 'Availability', exact: true }).click();
    const availability = await visitor.locator('#message').inputValue();
    check(`${width}px suggestion fills and focuses message`, availability.includes('still available') && await visitor.locator('#message').evaluate(element => document.activeElement === element));
    await visitor.locator('#message').fill(availability + '\nPlease tell me about parking.');
    await panel.getByRole('button', { name: 'Arrange a viewing', exact: true }).click();
    check(`${width}px second suggestion preserves draft`, (await visitor.locator('#message').inputValue()).includes('Please tell me about parking.') && (await visitor.locator('#message').inputValue()).includes('view this property'));
    await visitor.locator('#moveInDate').fill('2026-11-15'); await capture(visitor, panel, `visitor-${width}`, true);
    const before = (await db.collection('inquiries').where('listingId', '==', 'demo-0').get()).size;
    await panel.getByRole('button', { name: 'Send inquiry', exact: true }).click();
    await panel.getByText('Your inquiry has been sent.', { exact: true }).waitFor();
    const after = await db.collection('inquiries').where('listingId', '==', 'demo-0').get();
    check(`${width}px one real inquiry created for the correct owner`, after.size === before + 1 && after.docs.every(doc => doc.data().ownerId === 'owner' && doc.data().customerId === 'renter' && doc.data().moveInDate.toDate().toISOString().startsWith('2026-11-15')));
    check(`${width}px confirmation links to sent inquiries`, await panel.getByRole('link', { name: 'View my inquiry' }).getAttribute('href') === '/dashboard?tab=inquiries');
    await capture(visitor, panel, `sent-${width}`);
    await panel.getByRole('button', { name: 'Write another inquiry' }).click();
    check(`${width}px another inquiry starts empty`, await visitor.locator('#message').inputValue() === '' && await visitor.locator('#moveInDate').inputValue() === '');
    if (width === 390) {
      await visitor.locator('button[lang="ne"]:visible').click(); await visitor.waitForFunction(() => document.documentElement.lang === 'ne');
      await capture(visitor, visitor.locator('section[aria-labelledby="listing-contact-heading"]'), 'visitor-nepali');
      check('Nepali panel fits phone width', await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await visitor.locator('button[lang="en"]:visible').click(); await visitor.waitForFunction(() => document.documentElement.lang === 'en');
    }
    await visitor.goto(base + '/listing/demo-1'); await visitor.locator('#message').waitFor();
    check(`${width}px direct call and WhatsApp still available`, await visitor.locator('a[href="tel:9800000000"]').count() === 1 && await visitor.locator('a[href="https://wa.me/9779800000000"]').count() === 1);
    await visitor.goto(base + '/listing/demo-sale'); await visitor.locator('#message').waitFor();
    check(`${width}px sale inquiry asks for a viewing date`, await visitor.getByLabel('Preferred viewing date', { exact: true }).count() === 1);
    check(`${width}px no viewport overflow or ad controls`, await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await visitor.locator('.ad-carousel button,.ad-carousel__controls').count() === 0);
    await visitor.context().close();
    const guest = await makePage(width); await guest.goto(base + '/listing/demo-0');
    const guestPanel = guest.getByRole('region', { name: 'Ask about this property', exact: true }); await guestPanel.waitFor();
    check(`${width}px guest has actionable sign-in`, await guestPanel.getByRole('link', { name: 'Sign in to inquire' }).getAttribute('href') === '/sign-in?next=%2Flisting%2Fdemo-0');
    await capture(guest, guestPanel, `guest-${width}`); await guest.context().close();
  }
  const incomplete = await makePage(390, 'contact-incomplete'); await incomplete.goto(base + '/listing/demo-0');
  await incomplete.getByRole('region', { name: 'Ask about this property', exact: true }).getByRole('link', { name: 'Complete your profile', exact: true }).waitFor();
  check('incomplete profile has a clear next step', await incomplete.locator('#message').count() === 0);
  check('no uncaught browser errors', errors.length === 0);
  await writeFile(`${dir}/checks.json`, JSON.stringify({ passed: checks.length, checks, errors, scope: 'Disposable local demo Firebase; real local inquiry writes only; no production writes' }, null, 2));
} finally { await browser.close(); }
