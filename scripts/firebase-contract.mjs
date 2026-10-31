// Shared backend contract. No network calls, credentials, or deployments.
// Android owns the canonical files; the website receives a verified mirror.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const config = await readJson(resolve(root, 'firebase.json'));
const isAndroid = config.firestore.rules === 'firestore.rules';
const canonical = isAndroid ? root : resolve(root, '../merokotha');
const website = isAndroid ? resolve(root, '../estate-merokotha-website') : root;
const manifestPath = (folder, cfg) => resolve(folder, dirname(cfg.firestore.rules), 'firebase-contract.json');
const entries = cfg => ({
  'firestore.rules': cfg.firestore.rules,
  'firestore.indexes.json': cfg.firestore.indexes,
  'storage.rules': cfg.storage.rules,
});
const digest = content => createHash('sha256').update(content.replaceAll('\r\n', '\n')).digest('hex');
const hashes = async (folder, cfg) => Object.fromEntries(await Promise.all(
  Object.entries(entries(cfg)).map(async ([name, path]) => [name, digest(await readFile(resolve(folder, path), 'utf8'))]),
));
const exists = async path => { try { await access(path); return true; } catch { return false; } };

if (process.argv.includes('--sync')) {
  const version = process.argv.find(arg => arg.startsWith('--version='))?.slice(10);
  assert.ok(version, 'Sync requires --version=<reviewed-contract-version>.');
  const androidConfig = await readJson(resolve(canonical, 'firebase.json'));
  const webConfig = await readJson(resolve(website, 'firebase.json'));
  const manifest = { version, source: 'Android canonical files; website mirror', files: await hashes(canonical, androidConfig) };
  for (const [name, source] of Object.entries(entries(androidConfig))) {
    const target = resolve(website, entries(webConfig)[name]);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(canonical, source), target);
  }
  for (const [folder, cfg] of [[canonical, androidConfig], [website, webConfig]]) {
    await writeFile(manifestPath(folder, cfg), JSON.stringify(manifest, null, 2) + '\n');
  }
  const helperTarget = resolve(website, 'scripts/firebase-contract.mjs');
  if (helperTarget !== fileURLToPath(import.meta.url)) await copyFile(fileURLToPath(import.meta.url), helperTarget);
  console.log(`Synchronized contract ${version} from Android to website.`);
}

const manifest = await readJson(manifestPath(root, config));
assert.deepEqual(await hashes(root, config), manifest.files,
  'Firebase files differ from the versioned contract. Review canonical Android changes, then run --sync --version=<new-version>.');
const otherRoot = isAndroid ? website : canonical;
if (await exists(resolve(otherRoot, 'firebase.json'))) {
  const otherConfig = await readJson(resolve(otherRoot, 'firebase.json'));
  assert.deepEqual(await readJson(manifestPath(otherRoot, otherConfig)), manifest,
    'Android and website contract versions differ. Synchronize before deployment.');
  assert.deepEqual(await hashes(otherRoot, otherConfig), manifest.files,
    'Android and website Firebase files differ. Synchronize before deployment.');
}
console.log(`Firebase contract ${manifest.version}: rules, Storage, and indexes verified.`);
