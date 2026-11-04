// Check the new fields against both the versioned rules and the last released
// snapshot in a DEMO emulator. Does not inspect or change live Firebase rules.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const checks = [];
for (const path of ['firebase/firestore.rules', '.impeccable/review/land-sponsored/live-candidate.rules']) {
  const env = await initializeTestEnvironment({ projectId: 'demo-merokotha-feature-tests', firestore: { host: '127.0.0.1', port: 8088, rules: await readFile(path, 'utf8') } });
  const client = uid => env.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: true }).firestore();
  try {
    await env.withSecurityRulesDisabled(async context => {
      for (const [id, role, agentStatus] of [['detail-qa-admin', 'superAdmin', 'none'], ['detail-qa-agent', 'agent', 'verified'], ['detail-qa-customer', 'customer', 'none']]) {
        await setDoc(doc(context.firestore(), 'users', id), { name: 'Local QA', role, agentStatus, isBanned: false, createdAt: new Date() });
      }
      await setDoc(doc(context.firestore(), 'agentsPublic', 'detail-qa-agent'), { name: 'Demo agent', status: 'active' });
    });
    const admin = client('detail-qa-admin'), agent = client('detail-qa-agent'), customer = client('detail-qa-customer'), guest = env.unauthenticatedContext().firestore();
    const settings = { enabled: true, partnerAdsEnabled: true, heroEnabled: true, feedEnabled: true, detailsEnabled: true, detailTitleEnabled: false, detailPriceEnabled: true, detailRecommendationsEnabled: false, detailAgentEnabled: true, feedInterval: 4, rotationSeconds: 6 };
    await assertSucceeds(setDoc(doc(admin, 'adSettings', 'public'), settings)); checks.push(`${path}: superadmin can save independent slot flags`);
    await assertSucceeds(setDoc(doc(admin, 'ads', 'detail-qa-ad'), { title: 'Demo targeted ad', placement: 'details', detailSlots: ['price', 'agent'], status: 'active', externalUrl: 'https://example.test' })); checks.push(`${path}: superadmin can target campaigns`);
    for (const [name, connection] of [['guest', guest], ['agent', agent], ['customer', customer]]) {
      await assertFails(setDoc(doc(connection, 'adSettings', 'public'), settings));
      await assertFails(setDoc(doc(connection, 'ads', 'detail-qa-forged'), { detailSlots: ['price'] }));
      checks.push(`${path}: ${name} cannot manage advertisements`);
    }
    await assertSucceeds(updateDoc(doc(agent, 'users', 'detail-qa-agent'), { agentBio: 'Demo public bio', publicPhone: '9800000000', whatsappNumber: '9800000000' }));
    await assertSucceeds(updateDoc(doc(agent, 'agentsPublic', 'detail-qa-agent'), { bio: 'Demo public bio', publicPhone: '9800000000', whatsappNumber: '9800000000' }));
    await assertSucceeds(getDoc(doc(guest, 'agentsPublic', 'detail-qa-agent'))); checks.push(`${path}: verified agent can publish public bio/contacts for guests`);
    await assertFails(updateDoc(doc(customer, 'agentsPublic', 'detail-qa-agent'), { publicPhone: '9811111111' }));
    await assertFails(getDoc(doc(guest, 'users', 'detail-qa-agent'))); checks.push(`${path}: private profiles and agent edits remain protected`);
  } finally { await env.cleanup(); }
}
await writeFile('.impeccable/review/property-detail-ads/rule-checks.json', JSON.stringify({ passed: checks.length, checks, scope: 'Local demo emulator, versioned candidate and last released snapshot only. Zero live rule or document changes.' }, null, 2));
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
