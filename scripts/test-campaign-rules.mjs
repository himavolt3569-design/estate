// Local demo emulator only. Never reads or writes production application data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const projectId = 'demo-merokotha-feature-tests';
const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8088, rules: await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8') } });
await env.clearFirestore();
const guest = env.unauthenticatedContext().firestore();
const owner = env.authenticatedContext('owner').firestore();
const admin = env.authenticatedContext('admin').firestore();
const banned = env.authenticatedContext('banned').firestore();
const agent = env.authenticatedContext('agent').firestore();
const settings = { enabled: true, partnerAdsEnabled: true, heroEnabled: true, feedEnabled: true, detailsEnabled: true, feedInterval: 4, rotationSeconds: 6 };
const rental = (overrides = {}) => ({ ownerId: 'owner', ownerName: 'Owner', title: 'Emulator property', roomType: 'house', status: 'active', rentPerMonth: 22000, viewCount: 0, verificationStatus: 'pending', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...overrides });
const eventData = (overrides = {}) => ({ adId: 'partner-himavolt', type: 'impression', placement: 'landing', device: 'mobile', createdAt: serverTimestamp(), ...overrides });
await env.withSecurityRulesDisabled(async context => {
  for (const [uid, role, isBanned] of [['owner','customer',false],['admin','superAdmin',false],['banned','customer',true]]) await setDoc(doc(context.firestore(),'users',uid),{name:uid,role,isBanned});
  await setDoc(doc(context.firestore(),'listings','rental'),rental({saveCount:0}));
  await setDoc(doc(context.firestore(),'users','agent'),{name:'Agent',role:'agent',agentStatus:'verified',isBanned:false});
  await setDoc(doc(context.firestore(),'agentsPublic','agent'),{name:'Agent',status:'active'});
  await setDoc(doc(context.firestore(),'listings','old-reviewed'),rental({verificationStatus:'verified',reviewedAt:Timestamp.now(),reviewedBy:'admin',reviewReason:'Reviewed'}));
  await setDoc(doc(context.firestore(),'listings','old-web-reviewed'),rental({verificationStatus:'verified',verifiedAt:Timestamp.now(),verifiedBy:'admin',verificationReason:'Reviewed'}));
  await setDoc(doc(context.firestore(),'listings','legacy-price'),rental({rentPerMonth:0}));
});
try {
  await test('campaign settings are publicly readable and writable only by super admins with bounded values', async () => {
    await assertSucceeds(setDoc(doc(admin,'adSettings','public'),settings));
    await assertSucceeds(getDoc(doc(guest,'adSettings','public')));
    await assertFails(setDoc(doc(owner,'adSettings','public'),settings));
    await assertFails(setDoc(doc(admin,'adSettings','public'),{...settings,feedInterval:1}));
    await assertFails(setDoc(doc(admin,'adSettings','public'),{...settings,rotationSeconds:100}));
  });
  await test('campaigns are public and guest/customer/banned users cannot manage them', async () => {
    await assertSucceeds(setDoc(doc(admin,'ads','custom'),{title:'Test campaign',status:'active'}));
    await assertSucceeds(getDoc(doc(guest,'ads','custom')));
    await assertFails(updateDoc(doc(owner,'ads','custom'),{status:'paused'}));
    await assertFails(updateDoc(doc(banned,'ads','custom'),{title:'Forged'}));
  });
  await test('anonymous ad telemetry is append-only, schema checked and private', async () => {
    await assertSucceeds(setDoc(doc(guest,'adEvents','visible'),eventData()));
    await assertFails(updateDoc(doc(guest,'adEvents','visible'),{type:'click'}));
    await assertFails(getDoc(doc(guest,'adEvents','visible')));
    await assertSucceeds(getDoc(doc(admin,'adEvents','visible')));
    await assertFails(setDoc(doc(guest,'adEvents','bad-type'),eventData({type:'purchase'})));
    await assertFails(setDoc(doc(guest,'adEvents','private-data'),eventData({email:'no@example.test'})));
    await assertFails(setDoc(doc(guest,'adEvents','made-up-campaign'),eventData({adId:'missing'})));
    await assertFails(setDoc(doc(guest,'adStats','fake'),{impressions:999}));
    await assertFails(setDoc(doc(admin,'adStats','fake'),{impressions:999}));
  });
  await test('legacy rentals remain valid, all six other types can sell, flats cannot sell and prices cannot be swapped', async () => {
    await assertSucceeds(setDoc(doc(owner,'listings','legacy'),rental()));
    for (const roomType of ['room','apartment','house','office','shop','land']) await assertSucceeds(setDoc(doc(owner,'listings',`sale-${roomType}`),rental({roomType,transactionType:'sale',salePrice:5000000,rentPerMonth:0,saveCount:0})));
    await assertFails(setDoc(doc(owner,'listings','sale-flat'),rental({roomType:'flat',transactionType:'sale',salePrice:5000000,rentPerMonth:0})));
    await assertFails(updateDoc(doc(owner,'listings','legacy'),{roomType:'flat',transactionType:'sale',salePrice:5000000,rentPerMonth:0}));
    await assertFails(setDoc(doc(owner,'listings','price-zero'),rental({rentPerMonth:0})));
    await assertFails(setDoc(doc(owner,'listings','mixed-price'),rental({transactionType:'sale',salePrice:5000000})));
    await assertFails(setDoc(doc(owner,'listings','fake-count'),rental({saveCount:999})));
    await assertFails(updateDoc(doc(owner,'listings','rental'),{saveCount:999}));
    await assertSucceeds(updateDoc(doc(owner,'listings','legacy'),{title:'Updated rental',verificationStatus:'pending'}));
    await assertSucceeds(updateDoc(doc(guest,'listings','rental'),{viewCount:1}));
  });
  await test('saved-list identities stay private and counts are publicly readable', async () => {
    await assertSucceeds(setDoc(doc(owner,'users','owner','favourites','rental'),{listingId:'rental',createdAt:serverTimestamp()}));
    await assertFails(getDoc(doc(guest,'users','owner','favourites','rental')));
    await assertFails(setDoc(doc(owner,'users','owner','favourites','legacy'),{listingId:'rental'}));
    await assertSucceeds(getDoc(doc(guest,'listings','rental')));
  });
  await test('approved compatibility preserves existing saved-search and public-agent payloads', async () => {
    await assertSucceeds(setDoc(doc(owner,'users','owner','savedSearches','legacy'),{name:'Patan',filters:{search:'Patan'}}));
    await assertSucceeds(getDoc(doc(admin,'users','owner','savedSearches','legacy')));
    await assertFails(getDoc(doc(guest,'users','owner','savedSearches','legacy')));
    await assertFails(getDoc(doc(banned,'users','owner','savedSearches','legacy')));
    await assertSucceeds(setDoc(doc(agent,'agentsPublic','agent'),{uid:'agent',name:'Updated public agent',status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(agent,'agentsPublic','agent'),{status:'suspended'}));
  });
  await test('older review resets and moderation work without authorizing new review metadata or bad pricing', async () => {
    await assertSucceeds(updateDoc(doc(owner,'listings','old-reviewed'),{title:'Owner edit',verificationStatus:'pending'}));
    await assertFails(updateDoc(doc(owner,'listings','old-reviewed'),{reviewedBy:'owner'}));
    await assertSucceeds(updateDoc(doc(owner,'listings','old-web-reviewed'),{title:'Legacy web edit',verificationStatus:'pending'}));
    await assertFails(updateDoc(doc(owner,'listings','old-web-reviewed'),{verifiedBy:'owner'}));
    await assertSucceeds(updateDoc(doc(admin,'listings','legacy-price'),{status:'paused'}));
    await assertFails(updateDoc(doc(admin,'listings','legacy-price'),{rentPerMonth:-100}));
  });
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
  const { initializeApp, deleteApp } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  const app = initializeApp({projectId},'campaign-aggregate-tests');
  const db = getFirestore(app);
  const factory = createRequire(import.meta.url)('../../merokotha/functions/campaign-handlers.js');
  const handlers = factory.campaignHandlers(db,FieldValue);
  await test('real emulator transactions aggregate each ad event exactly once, including duplicate delivery', async () => {
    const snapshot = await db.doc('adEvents/visible').get();
    const event = {data:snapshot,params:{eventId:'visible'}};
    await handlers.adCreated(event); await handlers.adCreated(event);
    const day=snapshot.data().createdAt.toDate().toISOString().slice(0,10);
    const stats=await db.doc(`adStats/partner-himavolt_${day}`).get();
    assert.equal(stats.data().impressions,1);
    await assertFails(getDoc(doc(guest,'adStats',stats.id)));
    await assertSucceeds(getDoc(doc(admin,'adStats',stats.id)));
  });
  await test('favourite reconciliation remains correct after duplicate and out-of-order events', async () => {
    await db.doc('users/renter/favourites/rental').set({listingId:'rental'});
    const event={params:{uid:'owner',listingId:'rental'}};
    await handlers.favouriteWritten(event); await handlers.favouriteWritten(event);
    assert.equal((await db.doc('listings/rental').get()).data().saveCount,2);
    await db.doc('users/owner/favourites/rental').delete(); await handlers.favouriteWritten(event);
    assert.equal((await db.doc('listings/rental').get()).data().saveCount,1);
    await db.doc('users/renter/favourites/rental').delete(); await handlers.favouriteWritten(event); await handlers.favouriteWritten(event);
    assert.equal((await db.doc('listings/rental').get()).data().saveCount,0);
  });
  await deleteApp(app);
} finally { await env.cleanup(); }
