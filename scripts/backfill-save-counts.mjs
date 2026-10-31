// Dry-run by default. Use trusted local Application Default Credentials when
// reviewing production; never put an Admin key in the website environment.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.feature-tests/package.json', import.meta.url));
const projectId = process.argv.find(value => value.startsWith('--project='))?.slice(10);
assert.ok(projectId, 'Pass --project=<firebase-project-id>.');
const apply = process.argv.includes('--apply');
if (process.env.FIRESTORE_EMULATOR_HOST) assert.ok(projectId.startsWith('demo-'), 'An emulator backfill must use a demo project.');
const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const app = initializeApp({ projectId, ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }) });
const db = getFirestore(app);
const { campaignHandlers } = createRequire(import.meta.url)('../../merokotha/functions/campaign-handlers.js');
const handlers = campaignHandlers(db, FieldValue);
try {
  const listings = await db.collection('listings').select('saveCount').get();
  const results = [];
  for (const listing of listings.docs) {
    const favourites = await db.collectionGroup('favourites').where('listingId', '==', listing.id).select('listingId').get();
    const count = favourites.docs.filter(item => item.id === listing.id && item.ref.parent.parent?.parent.id === 'users').length;
    results.push({ id: listing.id, before: listing.data().saveCount ?? null, currentSaves: count });
    if (apply) await handlers.favouriteWritten({ params: { listingId: listing.id } });
  }
  console.log(JSON.stringify({ projectId, mode: apply ? 'applied' : 'dry-run; no writes', listings: results }, null, 2));
} finally { await deleteApp(app); }
