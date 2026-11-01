// Tests superadmin ad controls before/after the ad-settings rule in a DEMO emulator.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../.feature-tests/package.json',import.meta.url));
const{initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const{doc,setDoc,getDoc,updateDoc,deleteDoc,setLogLevel}=require('firebase/firestore');setLogLevel('silent');
const dir='.impeccable/review/ad-admin/';await mkdir(dir,{recursive:true});
const canonical=(await readFile(new URL('../firebase/firestore.rules',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const blockStart=canonical.indexOf('    // Shared web/Android campaign display settings.');
const blockEnd=canonical.indexOf('    // Anonymous campaign events',blockStart);
assert.ok(blockStart>0&&blockEnd>blockStart,'Cannot locate the versioned ad-settings rule.');
const block=canonical.slice(blockStart,blockEnd);
const baselinePath=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11);
const baseline=baselinePath?(await readFile(baselinePath,'utf8')).replaceAll('\r\n','\n'):canonical.replace(block,'');
assert.ok(!baseline.includes('match /adSettings/'),'Baseline must precede the ad-settings addition.');
const insertion=baseline.lastIndexOf('    match /{document=**}');assert.ok(insertion>0,'Missing catch-all rule.');
const candidate=baselinePath?baseline.slice(0,insertion)+block+baseline.slice(insertion):canonical;
const settings={enabled:true,partnerAdsEnabled:true,heroEnabled:true,feedEnabled:true,detailsEnabled:true,feedInterval:4,rotationSeconds:6};
let env;const checks=[];
const load=async rules=>{if(env)await env.cleanup();env=await initializeTestEnvironment({projectId:'demo-merokotha-feature-tests',firestore:{host:'127.0.0.1',port:8088,rules}});};
const authDb=(uid,email='customer@example.test')=>env.authenticatedContext(uid,{email,email_verified:true}).firestore();
const namedAdmin=()=>authDb('ad-control-admin','himavolt3569@gmail.com');
try{
 await load(baseline);
 await env.withSecurityRulesDisabled(async ctx=>{
  for(const [uid,role]of[['ad-control-admin','superAdmin'],['ad-control-customer','customer'],['ad-control-owner','owner'],['ad-control-agent','agent'],['ad-control-email-spoof','customer']])await setDoc(doc(ctx.firestore(),'users',uid),{name:'Disposable ad permission fixture',role});
 });
 await assertFails(setDoc(doc(namedAdmin(),'adSettings','public'),settings));checks.push('A baseline without the ad-settings rule denies the superadmin settings save.');
 await load(candidate);
 const admin=namedAdmin();const guest=env.unauthenticatedContext().firestore();
 await assertSucceeds(setDoc(doc(admin,'adSettings','public'),settings));
 await assertSucceeds(updateDoc(doc(admin,'adSettings','public'),{enabled:false,heroEnabled:false,rotationSeconds:8}));
 assert.equal((await assertSucceeds(getDoc(doc(guest,'adSettings','public')))).data().enabled,false);
 checks.push('Superadmin can save settings and turn ads off; guests can read the resulting public flags.');
 await assertSucceeds(setDoc(doc(admin,'ads','ad-control-fixture'),{title:'Disposable ad',status:'active',priority:10,externalUrl:'https://himavolt.com/'}));
 await assertSucceeds(updateDoc(doc(admin,'ads','ad-control-fixture'),{title:'Edited ad',status:'paused',priority:30,externalUrl:'https://pitambari.vercel.app/'}));
 await assertSucceeds(deleteDoc(doc(admin,'ads','ad-control-fixture')));checks.push('Existing superadmin campaign create/edit/pause/priority/URL/delete permissions remain working.');
 for(const [label,client]of[['guest',guest],['customer',authDb('ad-control-customer')],['owner',authDb('ad-control-owner')],['agent',authDb('ad-control-agent')],['same-email-without-role',authDb('ad-control-email-spoof','himavolt3569@gmail.com')]]){
  await assertFails(setDoc(doc(client,'adSettings','public'),settings));
  await assertFails(setDoc(doc(client,'ads','ad-control-forged'),{title:'Unauthorized',status:'active'}));
  checks.push(`${label} cannot change display settings or campaigns.`);
 }
 await assertFails(updateDoc(doc(authDb('ad-control-customer'),'users','ad-control-customer'),{role:'superAdmin'}));
 checks.push('Ordinary users cannot promote their own account to superadmin.');
 for(const patch of [{feedInterval:1},{feedInterval:6},{feedInterval:3.5},{rotationSeconds:3},{rotationSeconds:16},{enabled:'true'},{heroEnabled:1}])await assertFails(setDoc(doc(admin,'adSettings','public'),{...settings,...patch}));
 checks.push('Malformed flags and unbounded/noninteger intervals are rejected.');
 await assertFails(setDoc(doc(admin,'adSettings','private'),settings));await assertFails(getDoc(doc(guest,'adSettings','private')));checks.push('Only the public ad-settings document is enabled; other settings IDs stay denied.');
 await assertFails(getDoc(doc(guest,'users','ad-control-customer')));await assertFails(getDoc(doc(authDb('ad-control-customer'),'users','ad-control-owner')));checks.push('Unrelated private profile access stays denied.');
 await assertSucceeds(setDoc(doc(admin,'adSettings','public'),settings));
 const report={passed:checks.length,checks,mode:'DEMO emulator only; no production writes',candidateSha256:createHash('sha256').update(candidate).digest('hex')};await writeFile(dir+'permission-regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(env)await env.cleanup();}
