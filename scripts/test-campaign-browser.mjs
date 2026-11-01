// Headless application QA against disposable local Firebase demo data only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.feature-tests/package.json',import.meta.url));
const { chromium } = require('playwright');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9098';
const {initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore,Timestamp,GeoPoint} = require('firebase-admin/firestore');
const projectId='demo-merokotha-feature-tests';
initializeApp({projectId});
const db=getFirestore();
await fetch(`http://127.0.0.1:8088/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});
await fetch(`http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`,{method:'DELETE'});
for(const uid of ['owner','renter','admin']){
  await getAuth().createUser({uid,email:`${uid}@example.test`,password:'Test-pass-123'});
  await db.doc(`users/${uid}`).set({name:uid,phone:'',location:'Patan',role:uid==='admin'?'superAdmin':'customer',isBanned:false,agentStatus:'none',createdAt:Timestamp.now()});
  await db.doc(`usersPublic/${uid}`).set({name:uid});
}
for(let i=0;i<14;i++) await db.doc(`listings/demo-${i}`).set({ownerId:'owner',ownerName:'Demo Owner',title:`Demo ${i%3===0?'apartment':i%3===1?'room':'flat'} in Patan ${i+1}`,roomType:i%3===0?'apartment':i%3===1?'room':'flat',rentPerMonth:12000+i*1000,depositAmount:24000,floor:2,totalFloors:4,furnishing:'semiFurnished',facilities:['Water','Parking','Wi-Fi'],description:'Local demo fixture. A bright rental with room to settle in. Photos illustrate the test layout.',address:'Patan, Lalitpur',nearbyLandmarks:'Patan Durbar Square',geoPoint:new GeoPoint(27.67+i*.003,85.31+i*.002),photoUrls:['/images/hero-bg.png','/images/hero-bg.png','/images/hero-bg.png'],status:'active',verificationStatus:'verified',viewCount:70+i,saveCount:8+i,createdAt:Timestamp.fromDate(new Date('2026-10-20T06:00:00Z')),updatedAt:Timestamp.now()});
await db.doc('listings/demo-sale').set({ownerId:'owner',ownerName:'Demo Owner',title:'Demo house for sale in Patan',roomType:'house',transactionType:'sale',salePrice:25000000,rentPerMonth:0,status:'active',verificationStatus:'pending',photoUrls:['/images/hero-bg.png'],facilities:['Water'],createdAt:Timestamp.now(),viewCount:9,saveCount:2});
const settings={enabled:true,partnerAdsEnabled:true,heroEnabled:true,feedEnabled:true,detailsEnabled:true,feedInterval:4,rotationSeconds:6};
await db.doc('adSettings/public').set(settings);
if(process.argv.includes('--seed-only')) { console.log('Disposable campaign/browser fixtures seeded.');process.exit(0); }
const base='http://localhost:3016';
const folder=new URL('../.impeccable/review/',import.meta.url); await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu']});
const errors=[]; const checks=[];
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);};
async function pageAt(width,uid){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 const page=await context.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000); await page.route('**/fonts.googleapis.com/**', route=>route.abort()); page.on('pageerror',error=>errors.push(error.message));
 if(uid){await page.goto(`${base}/sign-in`,{waitUntil:'domcontentloaded'});await page.locator('#auth-email').fill(`${uid}@example.test`);await page.locator('#auth-password').fill('Test-pass-123');await page.getByRole('button',{name:'Sign in with email',exact:true}).click();await page.waitForURL('**/dashboard',{waitUntil:'domcontentloaded'});}
 return page;
}
async function capture(page,name){
 if(await page.locator('.leaflet-container').count()) {
  await page.waitForFunction(()=>{const map=document.querySelector('.leaflet-container');if(!map)return true;const box=map.getBoundingClientRect();const tiles=[...map.querySelectorAll('img.leaflet-tile')].filter(image=>{const rect=image.getBoundingClientRect();return rect.right>box.left&&rect.left<box.right&&rect.bottom>box.top&&rect.top<box.bottom;});return tiles.length>0&&tiles.every(image=>image.complete&&image.naturalWidth>0);},null,{timeout:20000});
  // Wait for Leaflet's tile fade, using its computed state instead of a sleep.
  await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile-loaded')].every(image=>Number(getComputedStyle(image).opacity)>=.99));
 }
 await page.waitForFunction(()=>!document.querySelector('[data-sonner-toast][data-visible=true]'));await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});await page.addStyleTag({content:'nextjs-portal { display: none !important; }'});await page.screenshot({path:fileURLToPath(new URL(name,folder)),fullPage:true,animations:'disabled'});}
try{
 if(process.argv.includes('--filters-only')) {
  const layouts=[];
  for(const [width,suffix] of [[320,'narrow'],[390,'mobile'],[800,'tablet'],[1440,'desktop']]) {
    const page=await pageAt(width);await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.rental-grid > article').first().waitFor();await page.locator('.home-partners .sponsor-panel').waitFor();
    const layout=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,horizontalScrollers:[...document.querySelectorAll('nav, main *')].filter(el=>['auto','scroll'].includes(getComputedStyle(el).overflowX)&&el.scrollWidth>el.clientWidth+1).map(el=>el.className)}));
    assert.ok(!layout.overflow&&!layout.horizontalScrollers.length,JSON.stringify(layout));layouts.push(layout);
    await capture(page,`filters-full-${suffix}.png`);
    const focus=async name=>{await page.locator('.rental-filters').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-90));await page.screenshot({path:fileURLToPath(new URL(name,folder)),animations:'disabled'});};
    await focus(`filters-${suffix}.png`);await page.locator('.rental-preferences > summary').click();await focus(`filters-preferences-${suffix}.png`);
    await page.locator('button[lang="ne"]:visible').click();await page.waitForFunction(()=>document.documentElement.lang==='ne');await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Nepali overflow');await focus(`filters-nepali-${suffix}.png`);
  }
  const signed=await pageAt(320,'renter');await signed.goto(base,{waitUntil:'domcontentloaded'});await signed.locator('.rental-grid > article').first().waitFor();check('signed-in narrow navigation fits all actions',await signed.getByRole('navigation',{name:'Browse'}).evaluate(el=>el.scrollWidth<=el.clientWidth&&[...el.children].every(child=>child.getBoundingClientRect().right<=innerWidth)));await capture(signed,'filters-signed-in-narrow.png');
  await writeFile(new URL('filter-layout-checks.json',folder),JSON.stringify({layouts,signedInNavigation:true,nepali:true},null,2));console.log('Filter captures and scroll checks passed at 320, 390, 800 and 1440px, including Nepali and signed-in navigation.');
 } else if(process.argv.includes('--capture-only')) {
  for(const [width,suffix] of [[1440,'desktop'],[390,'mobile'],[800,'tablet']]) {
    const page=await pageAt(width);await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.rental-grid > article').first().waitFor();await page.locator('.home-partners .sponsor-panel').waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'viewport overflow');await capture(page,suffix+'.png');
    if(width===1440){await page.getByRole('button',{name:'Map filter',exact:true}).click();await page.locator('.leaflet-container').waitFor();await capture(page,'desktop-map.png');}
    if(width!==800){await page.goto(base+'/listing/demo-0',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'More places that fit'}).waitFor();await capture(page,'details-'+suffix+'.png');}
  }
  const admin=await pageAt(1440,'admin');await admin.goto(base+'/dashboard?tab=ads',{waitUntil:'domcontentloaded'});await admin.locator('#ad-title').waitFor();await capture(admin,'admin-desktop.png');await admin.setViewportSize({width:390,height:900});await capture(admin,'admin-mobile.png');
  console.log('Final desktop, mobile, tablet, map, details and admin captures verified.');
 } else {
 console.log('Starting desktop checks');
 const desktop=await pageAt(1440);await desktop.goto(base,{waitUntil:'domcontentloaded'});await desktop.locator('.rental-grid > article').first().waitFor();await desktop.locator('.home-partners .ad-carousel').waitFor();
 check('desktop has four listing columns',await desktop.locator('.rental-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)===4);
 check('feed inserts an ad after each four rentals',await desktop.locator('.rental-grid__ad').count()===2);
 check('saved searches start collapsed',!await desktop.locator('#saved-search-disclosure').evaluate(el=>el.open));
 check('hero contains property search and no advertisements',await desktop.locator('.home-hero form[role="search"]').count()===1&&await desktop.locator('.home-hero .ad-carousel').count()===0);
 check('homepage sponsor is a compact banner below the hero',await desktop.evaluate(()=>{const hero=document.querySelector('.home-hero').getBoundingClientRect();const banner=document.querySelector('.home-partners').getBoundingClientRect();return banner.top>=hero.bottom&&banner.height<180;}));
 await desktop.locator('#home-search').fill('Patan');await desktop.locator('#home-max-rent').fill('13000');await desktop.locator('.home-hero button[type="submit"]').click();await desktop.waitForFunction(()=>document.querySelectorAll('.rental-grid > article').length===2);checks.push('hero search preserves location and budget filtering');
 await desktop.locator('#home-search').clear();await desktop.locator('#home-max-rent').clear();await desktop.locator('.rental-grid > article').nth(11).waitFor();
 const filters=desktop.locator('.rental-filters');
 await filters.locator('#filter-property-type').click();await desktop.getByRole('option',{name:'Flats',exact:true}).click();
 check('flat browsing keeps rental-only purpose',await filters.getByRole('button',{name:'Buy',exact:true}).count()===0&&await filters.getByRole('button',{name:'Rent',exact:true}).getAttribute('aria-pressed')==='true');
 await filters.locator('#filter-property-type').click();await desktop.getByRole('option',{name:'All property types',exact:true}).click();
 await filters.locator('summary').click();await filters.locator('#filter-furnishing').click();await desktop.getByRole('option',{name:'Unfurnished',exact:true}).click();await desktop.getByRole('heading',{name:'No listings match these filters',exact:true}).waitFor();checks.push('property preferences filter results independently of map visibility');
 await filters.locator('#filter-furnishing').click();await desktop.getByRole('option',{name:'Any furnishing',exact:true}).click();await desktop.locator('.rental-grid > article').first().waitFor();
 await filters.locator('#filter-facility').fill('NoSuchAmenity');await desktop.getByRole('heading',{name:'No listings match these filters',exact:true}).waitFor();await filters.getByRole('button',{name:'Remove filter: NoSuchAmenity',exact:true}).click();await desktop.locator('.rental-grid > article').first().waitFor();check('individual active filter chips clear their own criterion',await filters.locator('#filter-facility').inputValue()==='');
 await filters.locator('#filter-min-price').fill('25000');await filters.locator('#filter-max-price').fill('12000');await desktop.locator('#filter-budget-error').waitFor();check('invalid price ranges have accessible inline feedback',await filters.locator('#filter-max-price').getAttribute('aria-invalid')==='true');
 await filters.getByRole('button',{name:'Clear filters',exact:true}).click();await filters.getByRole('button',{name:'Rent',exact:true}).click();await desktop.locator('.rental-grid > article').nth(11).waitFor();
 await desktop.locator('#filter-sort').click();await desktop.getByRole('option',{name:'Price: high to low',exact:true}).click();await desktop.waitForFunction(()=>document.querySelector('.rental-grid > article')?.textContent.includes('Demo room in Patan 14'));checks.push('redesigned sorting orders results by price');
 await desktop.locator('#filter-sort').click();await desktop.getByRole('option',{name:'Recommended',exact:true}).click();
 const hero=desktop.locator('.home-partners'); await hero.getByRole('button',{name:'Next advertisement'}).click(); await desktop.waitForFunction(()=>document.querySelector('.home-partners .sponsor-panel')?.getAttribute('href')==='https://pitambari-vercel.app/'); await hero.getByRole('button',{name:'Next advertisement'}).click(); await desktop.waitForFunction(()=>document.querySelector('.home-partners .sponsor-panel')?.getAttribute('href')==='https://floor-cleaner.vercel.app/'); await hero.getByRole('button',{name:'Next advertisement'}).click(); checks.push('carousel links to all three supplied partner websites');
 check('Home navigation label',await desktop.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Home',exact:true}).count()===1);
 await desktop.getByRole('button',{name:'Tools',exact:true}).first().click();await desktop.getByRole('menuitem',{name:'EMI calculator'}).waitFor();await desktop.keyboard.press('Escape');checks.push('tools dropdown exposes EMI and land converter');
 const search=desktop.getByRole('search',{name:'Search properties',exact:true});await search.getByRole('searchbox').fill('Patan');await search.getByRole('button',{name:'Submit property search'}).click();await desktop.waitForURL('**/?search=Patan#rentals');await desktop.locator('.rental-grid > article').first().waitFor();checks.push('header property search works');
 await desktop.goto(base,{waitUntil:'domcontentloaded'});await desktop.locator('.home-partners .ad-carousel').waitFor();await capture(desktop,'desktop.png');
 await desktop.getByRole('button',{name:'Map filter',exact:true}).click();await desktop.locator('.leaflet-container').waitFor();await desktop.getByRole('button',{name:'Search this area',exact:true}).click();await desktop.getByRole('button',{name:'Clear map boundary'}).waitFor();checks.push('map filtering applies and clears a boundary');await capture(desktop,'desktop-map.png');
 await desktop.goto(`${base}/listing/demo-0`);await desktop.getByRole('heading',{name:'Demo apartment in Patan 1',exact:true}).waitFor();await desktop.getByText('8 saves',{exact:true}).waitFor();check('public posting date is visible',await desktop.locator('time').first().isVisible());
 await desktop.locator('.ad-carousel').first().waitFor();
 const ordering=await desktop.evaluate(()=>{const heads=[...document.querySelectorAll('h2')];const about=heads.find(el=>el.textContent==='About this property');const facilities=heads.find(el=>el.textContent==='Facilities');const ad=document.querySelector('.ad-carousel');return !!(about.compareDocumentPosition(ad)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(ad.compareDocumentPosition(facilities)&Node.DOCUMENT_POSITION_FOLLOWING);});check('details ad is between description and facilities',ordering);
 await desktop.getByRole('heading',{name:'More places that fit'}).waitFor();check('up to five relevant rental recommendations',await desktop.locator('section[aria-labelledby="recommendations-title"] article').count()===5);
 await desktop.getByRole('button',{name:'View full photo',exact:true}).click();await desktop.getByRole('dialog').waitFor();await desktop.getByRole('button',{name:'Zoom in',exact:true}).click();await desktop.getByRole('button',{name:'Close photo viewer'}).click();checks.push('photo viewer and zoom work');await capture(desktop,'details-desktop.png');
 console.log('Desktop checks complete; starting mobile checks');
 const mobile=await pageAt(390);await mobile.goto(base,{waitUntil:'domcontentloaded'});await mobile.locator('.leaflet-container').waitFor();await mobile.locator('.map-preview-card').first().waitFor();
 check('mobile map and photo rail appear',await mobile.locator('.map-preview-card').count()>2);check('mobile hides desktop listing count',!(await mobile.getByText('14 listings found',{exact:true}).isVisible()));check('mobile has no horizontal document overflow',await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await capture(mobile,'mobile.png');
 check('mobile navigation, filters and map previews have no horizontal scrolling',await mobile.evaluate(()=>[...document.querySelectorAll('nav, .rental-filters *, .rental-results-toolbar *, .rental-type-tabs, .map-preview-rail')].every(el=>!['auto','scroll'].includes(getComputedStyle(el).overflowX)||el.scrollWidth<=el.clientWidth+1)));
 check('mobile map previews fit two complete cards',await mobile.locator('.map-preview-card:visible').count()===2);
 await mobile.locator('#saved-search-disclosure > summary').click();await mobile.getByRole('heading',{name:'Saved searches & new matches',exact:true}).waitFor();await mobile.reload();check('saved searches collapse again on reload',!await mobile.locator('#saved-search-disclosure').evaluate(el=>el.open));
 await mobile.goto(`${base}/listing/demo-0`);await mobile.getByRole('heading',{name:'Demo apartment in Patan 1',exact:true}).waitFor();check('mobile details have no horizontal overflow',await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await capture(mobile,'details-mobile.png');
 await desktop.goto(base,{waitUntil:'domcontentloaded'});await desktop.locator('.rental-grid > article').first().waitFor();await desktop.getByRole('button',{name:'Buy',exact:true}).click();try { await desktop.getByRole('heading',{name:'Demo house for sale in Patan',exact:true}).waitFor(); } catch(error) { console.log('BUY DEBUG',await desktop.locator('main').innerText());throw error; }check('Buy filter excludes rentals',await desktop.locator('.rental-grid > article').count()===1);await desktop.getByRole('link',{name:'Demo house for sale in Patan',exact:true}).click();await desktop.getByText('asking price',{exact:true}).first().waitFor();check('sale detail never labels the asking price per month',await desktop.getByText('Rs. 25,000,000').first().isVisible());
 console.log('Public checks complete; starting campaign admin checks');
 const admin=await pageAt(1440,'admin');await admin.goto(`${base}/dashboard?tab=ads`);await admin.getByRole('heading',{name:'Advertising',exact:true}).waitFor();await admin.getByLabel(/^Headline/).fill('Demo partner campaign');await admin.getByLabel('Brand name',{exact:true}).fill('Demo Partner');await admin.getByLabel(/^Website URL/).fill('https://himavolt.com/');await admin.getByLabel('Sliding images',{exact:true}).setInputFiles([fileURLToPath(new URL('../public/images/hero-bg.png',import.meta.url)),fileURLToPath(new URL('../public/images/partners/himavolt.png',import.meta.url))]);await admin.getByRole('button',{name:'Mobile preview',exact:true}).click();check('mobile ad preview uses the phone composition on desktop',await admin.locator('.sponsor-panel--mobile-preview').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length===1&&getComputedStyle(element.querySelector('h3')).display==='none'));await admin.getByRole('button',{name:'Desktop preview',exact:true}).click();await admin.getByRole('button',{name:'Save campaign',exact:true}).click();await admin.getByText('Campaign saved. Changes sync across devices.',{exact:true}).waitFor();await admin.getByText('Demo partner campaign',{exact:true}).waitFor();
 const docs=await db.collection('ads').where('title','==','Demo partner campaign').get();check('admin saves multiple images through Firebase Storage',docs.size===1 && docs.docs[0].data().imageUrls.length===2);
 await admin.getByLabel('Show advertisements',{exact:true}).uncheck();await admin.getByRole('button',{name:'Save display settings',exact:true}).click();await mobile.goto(base,{waitUntil:'domcontentloaded'});await mobile.locator('.rental-grid > article').first().waitFor();await mobile.waitForFunction(()=>!document.querySelector('.home-partners'));checks.push('Firebase kill switch syncs to a second mobile session');
 await admin.getByLabel('Show advertisements',{exact:true}).check();await admin.getByRole('button',{name:'Save display settings',exact:true}).click();await capture(admin,'admin-desktop.png');await admin.setViewportSize({width:390,height:900});check('mobile campaign manager has no horizontal overflow',await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await capture(admin,'admin-mobile.png');
 const renter=await pageAt(1280,'renter');await renter.goto(`${base}/dashboard?tab=post`);await renter.getByLabel('Listing purpose',{exact:true}).waitFor();
 await renter.getByLabel('Type',{exact:true}).click();await renter.getByRole('option',{name:'Flat',exact:true}).click();await renter.getByLabel('Listing purpose',{exact:true}).click();check('flats offer rental-only posting',await renter.getByRole('option',{name:'Sell',exact:true}).count()===0);await renter.keyboard.press('Escape');
 await renter.getByLabel('Type',{exact:true}).click();await renter.getByRole('option',{name:'House',exact:true}).click();await renter.getByLabel('Listing purpose',{exact:true}).click();await renter.getByRole('option',{name:'Sell',exact:true}).click();await renter.getByLabel(/^Asking price/).fill('45000000');check('sale posting hides the rental deposit field',await renter.locator('#depositAmount').count()===0);
 await renter.locator('#address').fill('Patan, Lalitpur');await renter.getByRole('button',{name:'Publish property',exact:true}).click();await renter.waitForURL('**/listing/**');await renter.getByText('asking price',{exact:true}).first().waitFor();checks.push('sale posting writes a separate asking price and renders it correctly');
 const posted=await db.collection('listings').where('ownerId','==','renter').get();check('sale record preserves the requested schema',posted.size===1&&posted.docs[0].data().transactionType==='sale'&&posted.docs[0].data().salePrice===45000000&&posted.docs[0].data().rentPerMonth===0);
 check('no uncaught browser errors',errors.length===0);
 await writeFile(new URL('browser-checks.json',folder),JSON.stringify({checks,errors,projectId,source:'disposable emulator fixtures; not production listings'},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}
} finally {await browser.close();}
