import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
const require=createRequire(new URL('../../.feature-tests/package.json',import.meta.url));
const {chromium}=require('playwright');
await mkdir('.impeccable/review/ads-visibility',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[];
try{
for(const[width,name]of[[390,'mobile'],[1440,'desktop']]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 await page.goto('http://localhost:3016');await page.locator('.landing-promo__artwork').first().waitFor();await page.locator('.landing-promo__artwork').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));await page.evaluate(()=>document.fonts.ready);await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
 for(let i=0;i<30;i++){await page.keyboard.press('Tab');if(await page.locator('.landing-promo > a:focus-visible').count())break;}
 await page.waitForFunction(()=>document.activeElement?.matches('.landing-promo > a:focus-visible')&&getComputedStyle(document.activeElement).outlineOffset==='-3px');
 const focus=page.locator('.landing-promo > a:focus-visible');assert.equal(await focus.count(),1);
 const style=await focus.evaluate(el=>({outline:getComputedStyle(el).outlineStyle,offset:getComputedStyle(el).outlineOffset,width:getComputedStyle(el).outlineWidth}));
 assert.equal(style.outline,'solid');assert.equal(style.offset,'-3px');assert.equal(style.width,'2px');
 await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:`.impeccable/review/ads-visibility/${name}-focus.png`,animations:'disabled'});
 checks.push({name,style,focus:'Reached ad link with keyboard Tab'});await page.close();
}
await writeFile('.impeccable/review/ads-visibility/focus-checks.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();}
