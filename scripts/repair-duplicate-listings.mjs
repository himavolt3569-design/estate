// Targeted, reversible repair. Pass an explicit reviewed plan; dry-run is default.
// Uses the signed-in Firebase CLI account, never a browser/service-account key.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const { logger } = require('firebase-tools/lib/logger');
logger.silent = true;
const { getProjectDefaultAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const args = process.argv.slice(2);
const project = args.find(arg => arg.startsWith('--project='))?.slice(10);
const planPath = args.find(arg => arg.startsWith('--plan='))?.slice(7);
const apply = args.includes('--apply');
assert.ok(project && planPath, 'Required: --project=<id> --plan=<reviewed-plan.json> [--apply]');
assert.ok(!process.env.FIRESTORE_EMULATOR_HOST, 'Unset FIRESTORE_EMULATOR_HOST for a live repair.');
const plan = JSON.parse(await readFile(planPath, 'utf8'));
assert.equal(plan.project, project, 'The plan must target the explicitly selected project.');
assert.ok(plan.groups?.length, 'The reviewed plan contains no groups.');
const account = getProjectDefaultAccount(process.cwd());
assert.ok(account, 'Sign in with Firebase CLI first.');
await requireAuth({ project, ...account });
const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
const database = `/projects/${project}/databases/(default)`;
const ignored = new Set(['createdAt', 'updatedAt', 'availableFrom', 'photoUrls', 'viewCount', 'verificationStatus', 'verifiedBy', 'verificationReason', 'verifiedAt']);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, stable(val)])) : value;
const signature = document => JSON.stringify(stable(Object.fromEntries(Object.entries(document.fields).filter(([key]) => !ignored.has(key)))));
const folder = resolve(fileURLToPath(new URL('../../.feature-tests/artifacts/', import.meta.url)), `duplicate-repair-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(folder, { recursive: true });
let transaction;
try {
  if (apply) transaction = (await client.post(`${database}/documents:beginTransaction`, {})).body.transaction;
  const response = await client.post(`${database}/documents:runQuery`, {
    structuredQuery: { from: [{ collectionId: 'listings' }] }, ...(transaction ? { transaction } : {}),
  });
  const documents = response.body.filter(item => item.document).map(item => item.document);
  const writes = [];
  const used = new Set();
  for (const group of plan.groups) {
    assert.ok(group.duplicateIds.length, 'Each group needs duplicate IDs.');
    const canonical = documents.find(document => document.name.endsWith(`/${group.canonicalId}`));
    assert.ok(canonical, `Missing canonical listing ${group.canonicalId}`);
    assert.equal(canonical.fields.status.stringValue, 'active', 'Canonical listing must remain active.');
    for (const id of [group.canonicalId, ...group.duplicateIds]) {
      assert.ok(!used.has(id), `Listing ${id} appears twice in the plan.`);
      used.add(id);
    }
    for (const id of group.duplicateIds) {
      const duplicate = documents.find(document => document.name.endsWith(`/${id}`));
      assert.ok(duplicate, `Missing duplicate ${id}`);
      if (duplicate.fields.status?.stringValue === 'paused' && duplicate.fields.duplicateOf?.stringValue === group.canonicalId) continue;
      assert.equal(duplicate.fields.status?.stringValue, 'active', `Unexpected status for ${id}`);
      assert.equal(signature(duplicate), signature(canonical), `Property details differ for ${id}; review manually.`);
      writes.push({
        update: { name: duplicate.name, fields: {
          status: { stringValue: 'paused' }, duplicateOf: { stringValue: group.canonicalId },
          duplicateArchivedReason: { stringValue: 'Confirmed duplicate from repeated submission; original data and media retained.' },
        } },
        updateMask: { fieldPaths: ['status', 'duplicateOf', 'duplicateArchivedReason'] },
        updateTransforms: [{ fieldPath: 'duplicateArchivedAt', setToServerValue: 'REQUEST_TIME' }, { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { updateTime: duplicate.updateTime },
      });
    }
  }
  await writeFile(resolve(folder, 'before.json'), JSON.stringify({ project, plan, documents, writes }, null, 2), { flag: 'wx' });
  if (apply && writes.length) {
    const committed = await client.post(`${database}/documents:commit`, { writes, transaction });
    transaction = undefined;
    await writeFile(resolve(folder, 'commit.json'), JSON.stringify(committed.body, null, 2));
  }
  const after = await client.post(`${database}/documents:runQuery`, { structuredQuery: { from: [{ collectionId: 'listings' }] } });
  const afterDocs = after.body.filter(item => item.document).map(item => item.document);
  if (apply) for (const group of plan.groups) {
    assert.equal(afterDocs.find(d => d.name.endsWith(`/${group.canonicalId}`)).fields.status.stringValue, 'active');
    for (const id of group.duplicateIds) {
      const document = afterDocs.find(d => d.name.endsWith(`/${id}`));
      assert.equal(document.fields.status.stringValue, 'paused');
      assert.equal(document.fields.duplicateOf.stringValue, group.canonicalId);
    }
  }
  await writeFile(resolve(folder, 'after.json'), JSON.stringify({ project, documents: afterDocs }, null, 2));
  console.log(JSON.stringify({ project, mode: apply ? 'applied and verified' : 'dry-run', paused: writes.length, active: afterDocs.filter(d => d.fields.status?.stringValue === 'active').length, backup: folder }));
} finally {
  if (transaction) await client.post(`${database}/documents:rollback`, { transaction });
}
