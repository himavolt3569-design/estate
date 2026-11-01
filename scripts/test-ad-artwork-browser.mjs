// Generated-banner QA against only demo-merokotha-feature-tests and local storage.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../.feature-tests/package.json',import.meta.url));
const{initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const{doc,getDoc,deleteDoc}=require('firebase/firestore');
const{chromium}=require('playwright');
const env=await initializeTestEnvironment({projectId:'demo-merokotha-feature-tests',firestore:{host:'127.0.0.1',port:8088,rules:await readFile('firebase/firestore.rules','utf8')}});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const folder=new URL('../.impeccable/review/generated-ad-artwork/',import.meta.url);await mkdir(folder,{recursive:true});
const checks=[],errors=[];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const images=async page=>{await page.locator('.landing-promos img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));assert.ok(await page.locator('.landing-promos img').evaluateAll(images=>images.every(image=>image.naturalWidth>0)));};
const capture=async(page,name,scope=false)=>{await page.evaluate(()=>scrollTo(0,0));await settle(page);await images(page);await(scope?page.locator('.landing-promos'):page).screenshot({path:fileURLToPath(new URL(`${name}.png`,folder)),animations:'disabled'});};
try{
 for(const[width,name]of[[390,'mobile'],[320,'narrow'],[500,'phone-wide'],[800,'tablet'],[1440,'desktop']]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(`${name}: ${error.message}`));
  await page.goto('http://localhost:3016');await page.locator('.landing-promo__artwork').first().waitFor();await page.locator('.rental-grid > article').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.addStyleTag({content:'nextjs-portal{display:none!important}'});await images(page);
  assert.equal(await page.locator('.landing-promo__artwork').count(),3);
  const sources=await page.locator('.landing-promo__artwork').evaluateAll(images=>images.map(image=>image.getAttribute('src')));
  assert.deepEqual(sources,['/images/partners/himavolt-generated-v1.webp','/images/partners/pitambari-generated-v1.webp','/images/partners/floor-cleaner-generated-v1.webp']);
  const hima=await page.locator('[data-campaign="partner-himavolt"]').evaluate(el=>({background:getComputedStyle(el).backgroundColor,cta:getComputedStyle(el.querySelector('.landing-promo__link')).backgroundColor}));
  assert.equal(hima.background,'rgb(234, 244, 255)');assert.equal(hima.cta,'rgb(29, 78, 216)');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await capture(page,name);checks.push(`${name}: all three generated raster banners loaded, no overflow, HimaVolt blue palette.`);
  if(width<=900){for(let i=1;i<=3;i++){await page.locator('.landing-promos').getByRole('button',{name:`Show advertisement ${i}`,exact:true}).click();await page.waitForFunction(i=>document.querySelector(`[aria-label="Show advertisement ${i}"]`).getAttribute('aria-pressed')==='true',i);await capture(page,`${name}-ad-${i}`);}}
  if(width===390){await page.locator('button[lang="ne"]:visible').click();await page.waitForFunction(()=>document.documentElement.lang==='ne');await capture(page,'mobile-nepali');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await context.close();
 }
 const adminContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const admin=await adminContext.newPage();admin.on('pageerror',error=>errors.push(`admin: ${error.message}`));
 await admin.goto('http://localhost:3016/sign-in');await admin.locator('#auth-email').fill('admin@example.test');await admin.locator('#auth-password').fill('Test-pass-123');await admin.getByRole('button',{name:'Sign in with email',exact:true}).click();await admin.waitForURL('**/dashboard');await admin.goto('http://localhost:3016/dashboard?tab=ads');await admin.getByRole('button',{name:'HimaVolt',exact:true}).click();
 assert.equal(await admin.getByRole('button',{name:'Remove image 1',exact:true}).count(),0,'Generated art must not occupy a client upload slot');
 await admin.locator('#sponsor-editor .sponsor-panel__art img').waitFor();assert.ok((await admin.locator('#sponsor-editor .sponsor-panel__art img').getAttribute('src')).includes('himavolt-generated-v1.webp'));
 await admin.locator('#ad-images').setInputFiles(fileURLToPath(new URL('../public/images/partners/himavolt-generated-v1.webp',import.meta.url)));await admin.getByRole('button',{name:'Save campaign',exact:true}).click();await admin.getByText('Campaign saved. Changes sync across devices.',{exact:true}).waitFor();
 let saved;await env.withSecurityRulesDisabled(async ctx=>{saved=(await getDoc(doc(ctx.firestore(),'ads','partner-himavolt'))).data();});assert.equal(saved.imageUrls.length,1);assert.ok(saved.imageUrls[0].startsWith('http://127.0.0.1:9198/'));
 const guest=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'});await guest.goto('http://localhost:3016');await guest.locator('[data-campaign="partner-himavolt"] .landing-promo__uploaded img').waitFor();await images(guest);assert.equal(await guest.locator('[data-campaign="partner-himavolt"] .landing-promo__artwork').count(),0);await guest.addStyleTag({content:'nextjs-portal{display:none!important}'});await capture(guest,'client-upload',true);checks.push('Superadmin preview uses default art; first upload replaces it, saves exactly one image, and renders on homepage without the generated text overlay.');
 await env.withSecurityRulesDisabled(ctx=>deleteDoc(doc(ctx.firestore(),'ads','partner-himavolt')));await guest.locator('[data-campaign="partner-himavolt"] .landing-promo__artwork').waitFor();checks.push('Removing client imagery restores generated fallback without changing campaign controls.');
 await guest.close();await adminContext.close();
 assert.deepEqual(errors,[]);await writeFile(new URL('checks.json',folder),JSON.stringify({checks,errors,fixtures:'Disposable local demo records only; no production writes'},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await env.withSecurityRulesDisabled(ctx=>deleteDoc(doc(ctx.firestore(),'ads','partner-himavolt')));await browser.close();await env.cleanup();}
