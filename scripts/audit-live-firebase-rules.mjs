// Read-only audit using the existing Firebase CLI login. Never publishes rules.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const project = process.argv.find(arg => arg.startsWith('--project='))?.slice(10);
assert.ok(project, 'Required: --project=<firebase-project-id>');
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
require('firebase-tools/lib/logger').logger.silent = true;
const { getProjectDefaultAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const account = getProjectDefaultAccount(process.cwd());
assert.ok(account, 'Sign in with Firebase CLI first.');
await requireAuth({ project, ...account });
const client = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
const releases = (await client.get(`/projects/${project}/releases`)).body.releases || [];
const folder = new URL(`../../.feature-tests/artifacts/rules-audit-${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url);
await mkdir(folder, { recursive: true });
const normalize = source => source.replaceAll('\r\n', '\n').trim();
const sha256 = source => createHash('sha256').update(normalize(source)).digest('hex');
const result = { project, checkedAt: new Date().toISOString(), mode: 'read-only', releases: [] };
for (const release of releases.filter(item => /\/cloud[.]firestore$|\/firebase[.]storage\//.test(item.name))) {
  const ruleset = (await client.get(`/${release.rulesetName}`)).body;
  const storage = release.name.includes('firebase.storage/');
  const filename = storage ? 'storage.rules' : 'firestore.rules';
  const sources = ruleset.source.files;
  const deployed = sources.find(file => file.name.endsWith(filename)) || (sources.length === 1 ? sources[0] : undefined);
  assert.ok(deployed, `Cannot identify rule source in ${release.name}`);
  const android = await readFile(new URL(`../../merokotha/${filename}`, import.meta.url), 'utf8');
  const website = await readFile(new URL(`../firebase/${filename}`, import.meta.url), 'utf8');
  const entry = {
    name: release.name, rulesetName: release.rulesetName, updateTime: release.updateTime,
    deployedSha256: sha256(deployed.content),
    matchesAndroid: normalize(deployed.content) === normalize(android),
    matchesWebsite: normalize(deployed.content) === normalize(website),
  };
  result.releases.push(entry);
  await writeFile(new URL(`${result.releases.length}-${filename}`, folder), deployed.content);
  await writeFile(new URL(`${result.releases.length}-release.json`, folder), JSON.stringify({ release, ruleset }, null, 2));
}
assert.ok(result.releases.some(item => item.name.endsWith('/cloud.firestore')), 'No active Firestore release returned.');
// Index definitions contain schema metadata only, not application records.
const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
const indexes = [];
let pageToken;
do {
  const page = (await firestore.get(`/projects/${project}/databases/(default)/collectionGroups/-/indexes`, {
    queryParams: { ...(pageToken ? { pageToken } : {}) },
  })).body;
  indexes.push(...(page.indexes || []));
  pageToken = page.nextPageToken;
} while (pageToken);
await writeFile(new URL('deployed-indexes.json', folder), JSON.stringify(indexes, null, 2));
result.indexes = { total: indexes.length, states: indexes.reduce((counts, index) => {
  counts[index.state] = (counts[index.state] || 0) + 1;
  return counts;
}, {}) };
await writeFile(new URL('summary.json', folder), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, artifactFolder: fileURLToPath(folder) }, null, 2));
