import { showHeroAd } from './hero-ad-navigation.mjs';
// Reproduces the production ad-settings permission failure using local demo rules only.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, deleteDoc } = require('firebase/firestore');
const { chromium } = require('playwright');
const projectId='demo-merokotha-feature-tests';
const original=await readFile(new URL('../firebase/firestore.rules',import.meta.url),'utf8').then(text=>text.replaceAll('\r\n','\n'));
const defaults={enabled:true,partnerAdsEnabled:true,heroEnabled:true,feedEnabled:true,detailsEnabled:true,feedInterval:4,rotationSeconds:6};
let env;
const loadRules=async rules=>{if(env)await env.cleanup();env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8088,rules}});};
const settings=async patch=>env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'adSettings','public'),{...defaults,...patch}));
const folder=new URL('../.impeccable/review/ads-visibility/',import.meta.url);await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[],errors=[];
try{
 await loadRules(original);await settings({});
 const context=await browser.newContext({viewport:{width:390,height:1000},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:3016');await page.locator('.landing-promo').first().waitFor();
 assert.equal(await page.locator('.landing-promo').count(),3);
 for(const patch of [{enabled:false},{partnerAdsEnabled:false},{heroEnabled:false}]){
   await settings(patch);await page.locator('.landing-promos').waitFor({state:'hidden'});
   await settings({});await page.locator('.landing-promos').waitFor();
 }
 checks.push('Known master, partner-preset and homepage off switches still hide ads; re-enabling restores them.');
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'ads','partner-himavolt'),{id:'partner-himavolt',sponsorName:'HimaVolt',title:'Paused partner',externalUrl:'https://himavolt.com/',linkType:'external',status:'paused',placement:'all'}));
 await page.waitForFunction(()=>document.querySelectorAll('.landing-promo').length===2);
 await env.withSecurityRulesDisabled(context=>deleteDoc(doc(context.firestore(),'ads','partner-himavolt')));
 await page.waitForFunction(()=>document.querySelectorAll('.landing-promo').length===3);
 checks.push('Paused partner override remains paused and does not resurrect its preset.');
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'ads','partner-himavolt'),{id:'partner-himavolt',sponsorName:'HimaVolt',title:'Demo mobile artwork',externalUrl:'https://himavolt.com/',linkType:'external',status:'active',placement:'all',mobileImageUrl:'/images/hero-bg.png'}));
 await page.locator('.landing-promo__uploaded img').waitFor();
 await page.waitForFunction(()=>document.querySelector('.landing-promo__uploaded img').naturalWidth>0);
 await env.withSecurityRulesDisabled(context=>deleteDoc(doc(context.firestore(),'ads','partner-himavolt')));
 checks.push('Partner overrides with mobile-only uploaded artwork render successfully.');
 await context.close();
 const denied=original.replace("allow read: if settingsId == 'public';",'allow read: if false;');assert.notEqual(denied,original);
 await loadRules(denied);
 for(const [width,name]of[[390,'mobile'],[320,'narrow'],[500,'phone-wide'],[800,'tablet'],[1440,'desktop']]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(`${name}: ${error.message}`));
  await page.goto('http://localhost:3016');await page.locator('.landing-promo').first().waitFor();await page.locator('.rental-grid > article').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  assert.equal(await page.locator('.landing-promo').count(),3);
  assert.ok(await page.getByRole('heading',{name:'From our partners',exact:true}).isVisible());
  const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,ads:document.querySelector('.landing-promos').getBoundingClientRect().top,types:document.querySelector('.property-categories').getBoundingClientRect().top,listings:document.querySelector('.rental-grid').getBoundingClientRect().top}));
  assert.ok(layout.scrollWidth<=width+1,`${name}: page overflows`);assert.ok(layout.ads<layout.types&&layout.types<layout.listings);
  await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,folder)),animations:'disabled'});
  if(width<=900){for(let i=1;i<=3;i++){
    await showHeroAd(page, i - 1);
    await page.evaluate(()=>scrollTo(0,0));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.locator('.landing-promos').screenshot({path:fileURLToPath(new URL(`${name}-ad-${i}.png`,folder)),animations:'disabled'});
  }}
  checks.push({name,settings:'public read denied',campaignsVisible:3,layout});await context.close();
 }
 const allDenied=denied.replace('allow read: if true;\n\n      // Only superAdmin can create, update, or delete ads','allow read: if false;\n\n      // Only superAdmin can create, update, or delete ads');assert.notEqual(allDenied,denied);
 await loadRules(allDenied);
 const fallback=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'});await fallback.goto('http://localhost:3016');await fallback.locator('.landing-promo').first().waitFor();assert.equal(await fallback.locator('.landing-promo').count(),3);
 checks.push('Bundled partner ads also remain visible when remote campaign and settings reads are both denied.');await fallback.close();
 assert.deepEqual(errors,[]);await writeFile(new URL('checks.json',folder),JSON.stringify({checks,errors,mode:'local demo only; production rules and data unchanged'},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();await loadRules(original);await settings({});await env.cleanup();}
