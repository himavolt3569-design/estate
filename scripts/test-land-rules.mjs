// Only the isolated Firebase demo emulator is used. No production data writes.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const path = process.argv.find(arg => arg.startsWith('--rules='))?.slice(8) || 'firebase/firestore.rules';
const rules = await readFile(path, 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-merokotha-feature-tests', firestore: { host: '127.0.0.1', port: 8088, rules } });
let passed = 0;
const check = async (allowed, operation) => { await (allowed ? assertSucceeds(operation) : assertFails(operation)); passed++; };
const owner = env.authenticatedContext('land-rule-owner').firestore();
const stranger = env.authenticatedContext('land-rule-stranger').firestore();
const land = { area: 4.5, areaUnit: 'aana', landUse: 'residential', roadAccess: 'motorable', roadWidth: 20, frontage: 30, lengthUnit: 'ft', facing: 'east' };
const base = { ownerId: 'land-rule-owner', ownerName: 'Demo owner', title: 'Disposable land rule fixture', roomType: 'land', rentPerMonth: 10000, status: 'active', verificationStatus: 'pending', createdAt: serverTimestamp() };
const ids = [];
const create = (id, input) => { ids.push(id); return setDoc(doc(owner, 'listings', id), input); };
try {
  await env.withSecurityRulesDisabled(async context => {
    for (const uid of ['land-rule-owner', 'land-rule-stranger']) await setDoc(doc(context.firestore(), 'users', uid), { role: 'customer', isBanned: false });
  });
  await check(true, create('land-rule-legacy', base));
  await check(true, updateDoc(doc(owner, 'listings', 'land-rule-legacy'), { title: 'Legacy land still editable' }));
  await check(true, create('land-rule-valid', { ...base, land }));
  await check(true, create('land-rule-sale', { ...base, land, purpose: 'sale', transactionType: 'sale', rentPerMonth: 0, salePrice: 8000000 }));
  await check(true, create('land-rule-native-sale', { ...base, land, purpose: 'sale', rentPerMonth: 0, salePrice: 8000000 }));
  await check(false, updateDoc(doc(stranger, 'listings', 'land-rule-valid'), { 'land.area': 20 }));
  for (const invalid of [{ ...land, area: 0 }, { ...land, area: -1 }, { ...land, area: '4' }, { ...land, areaUnit: 'made-up' }, { ...land, roadWidth: -1 }, { ...land, frontage: 0 }, { ...land, roadAccess: 'none' }, { ...land, facing: 'made-up' }, { ...land, landUse: 'made-up' }, { ...land, privateDeed: 'forbidden' }]) {
    await check(false, create(`land-rule-invalid-${passed}`, { ...base, land: invalid }));
  }
  await check(false, create('land-rule-building', { ...base, roomType: 'house', land }));
  await check(false, updateDoc(doc(owner, 'listings', 'land-rule-valid'), { 'land.area': -2 }));
  await check(true, updateDoc(doc(owner, 'listings', 'land-rule-valid'), { 'land.area': 6 }));
  await check(true, updateDoc(doc(owner, 'listings', 'land-rule-valid'), { roomType: 'house', land: null }));
  assert.ok(passed >= 19);
  await mkdir('.impeccable/review/land-sponsored', { recursive: true });
  await writeFile('.impeccable/review/land-sponsored/rule-checks.json', JSON.stringify({ rules: path, rulesSha256: createHash('sha256').update(rules.replaceAll('\r\n', '\n')).digest('hex'), passed, productionDataWrites: 0 }, null, 2));
  console.log(`${passed} land schema, legacy compatibility and ownership rule checks passed.`);
} finally {
  await env.withSecurityRulesDisabled(async context => { for (const id of ids) await deleteDoc(doc(context.firestore(), 'listings', id)); });
  await env.cleanup();
}
