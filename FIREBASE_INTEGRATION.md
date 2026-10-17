# Shared Firebase contract and release handoff

The Android app and the Firebase website share project `mero-kotha-1f4f3`.
There is one active ruleset per database, not separate Android and web permissions.
`estate/` remains the original Supabase website and is outside this change.

## Canonical files

- Android: `firestore.rules`, `storage.rules`, `firestore.indexes.json`.
- Website: generated mirrors in `../estate-merokotha-website/firebase/`.
- Both contain `firebase-contract.json` with version and normalized SHA-256 hashes.
- Both Firebase configurations run `node scripts/firebase-contract.mjs` before
  deploying Firestore rules/indexes or Storage rules. A mismatch aborts deployment.
- A standalone checkout validates its own manifest. When the sibling checkout
  exists, the check also compares its manifest and file hashes. This is a local
  drift guard; it cannot prevent someone deploying an older Git revision or
  making a direct Console/API change. Use one backend release owner and audit live
  rules before every deployment. The manifest does not mean production is synced.

Review canonical edits, then synchronize from the Android directory:

```powershell
node scripts/firebase-contract.mjs --sync --version=<new-version>
node scripts/firebase-contract.mjs
```

`--sync` requires both checkouts and replaces the website mirrors with Android's
files. Commit the rules, indexes, manifest, helper and Firebase configuration in
each release repository together. Do not independently edit generated mirrors.

## Candidate 2026-10-17.1

Read-only CLI audit on October 17 found that production Firestore uses ruleset
`2630778c-05dc-4c00-b2f2-90021e4ca63a`, last updated October 15 at 21:41:08 Nepal time.
It differs from both prior local rule files. Production Storage matches both.
All 26 production composite indexes were READY at audit time. The candidate
retains those definitions and includes five additional web indexes (31 total).

Changes in the candidate:

- Retain production profile fields and optional contact phone. Add the web
  `contactEmail` and `agentBio` permissions. New accounts cannot self-register
  with verified agent privileges or admin roles.
- Accept a missing listing verification field as legacy pending on creation;
  patched Android explicitly creates with `verificationStatus: pending`.
- Content edits reset verification and remove both `verified*` / `verificationReason`
  and production `reviewed*` / `reviewReason` metadata. Availability-only toggles
  preserve the verdict. Suspended listings stay under admin control.
- Agent listing edits and private real-owner contact updates use one batch.
  The contact rule checks the listing's post-batch state with `getAfter`.
- Permit signed-in clients to get a not-found chat result before creating its
  deterministic ID. Existing chats remain participant/admin scoped and creation
  still requires an accepted inquiry.
- Add private saved searches, web tours, visits, reports and append-only web
  admin decisions without deleting the deployed Android paths.
- Preserve identical Storage permissions and public-profile fields already live.

## Remaining data contract differences

Matching permission files is necessary but does not merge different data models.
Production rules describe newer Android features absent from this local checkout.
The latest Android source/build is needed to confirm the actual writes and UI.

| Area | Newer deployed Android contract | Current website | Required follow-up |
| --- | --- | --- | --- |
| Reports | `reports`, `category`, initially `pending` | `listingReports`, `reason`, initially `open`, then `reviewing` | Choose one model and migrate or provide a tested adapter before promising a shared moderation queue. Both paths are retained provisionally. |
| Analytics | `listingEvents`, event `type` | `listingVisits`, visitor/source/device information | Define common event semantics and aggregation. Retaining both paths does not combine their dashboards. Legacy event attribution is not authoritative. |
| Moderation audit | `moderationHistory` | `adminDecisions` | Decide a common append-only event format. The legacy permissions are retained; the new web log is append-only. |
| Review metadata | `reviewedAt`, `reviewedBy`, `reviewReason` | `verifiedAt`, `verifiedBy`, `verificationReason` | Both resets are implemented; unify admin writes/readers after reviewing latest Android code. |
| Public contacts | Production profile `publicPhone`, `whatsappNumber`, `hideDisplayName` | Listing `publicCallNumber`, `publicWhatsAppNumber`, `contactIsAnonymous` | Verify the latest Android listing reader/writer; do not expose private `ownerContact` as fallback. |
| Agent directory lifecycle | Rules allow projection writes; latest client/trigger unknown | Web approval/profile/ban actions maintain `agentsPublic` | Check approvals, revocations, bans and edits from Android update the directory. Rules alone do not synchronize documents. |

No report/event records were migrated, no directory was backfilled and no
production records, rules, indexes, Auth settings or Functions were changed.

## Validation and rollout

The new compatibility suite exercises legacy/current listing creation, review
reset and availability changes, atomic private contacts, suspension restrictions,
signup privileges, both profile projections, directory controls, retained Android
paths, first-chat creation, inquiry acceptance, messaging, favourites and agent
applications. Existing suites cover web tours, Storage ownership, analytics,
reports, audit immutability and saved-search privacy.

The machine has no Flutter/Dart SDK or generated Riverpod files in this checkout.
SDK emulator operations validate the intended Firestore writes; they do not
compile or execute the edited Dart repositories. In the developer's latest tree:

```powershell
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
```

1. Reconcile these local changes with the developer's latest Android source.
   Inspect the actual released APK's Firebase project and write payloads.
2. Run emulator suites from the website and test both apps against a staging
   Firebase project: guest, customer/lister, verified agent, banned user and admin.
   Check new/existing/verified/rejected/suspended listings and private media.
3. Finish the shared report/analytics/audit model or explicitly retain separate
   experiences for this release. Do not rename live collections without migration.
4. Review a fresh read-only live audit against this candidate and retain the
   previous rule source/release for rollback. Obtain release approval after the
   concrete candidate and latest-client tests have been reviewed.
5. Deploy additive indexes from one agreed checkout, without `--force` or deleting
   unrelated indexes; wait for READY. Then deploy the reviewed Firestore rules:

   ```powershell
   firebase deploy --only firestore:indexes --project mero-kotha-1f4f3
   firebase deploy --only firestore:rules --project mero-kotha-1f4f3
   ```

   Storage and Functions do not need deployment for this candidate. A Firestore
   rules deploy affects existing Android installations immediately. Older builds
   that do not reset verified-listing edits still need the updated Android app.
6. Release reviewed Android/web clients, rerun the live audit, and verify both
   directions with the same Firebase UID: listing/photo edit, favourite, inquiry,
   accept/decline, text/image chat and Android push. Monitor permission errors.
   Restore the saved prior Firestore rules if rollback is required; no automatic
   data rollback is needed for this rules-only candidate.

The full findings are in [the rules review](../FIREBASE_RULES_REVIEW.md). Live
snapshots remain local to the review workspace at
`../../.feature-tests/artifacts/rules-audit-2026-10-17T10-34-56-239Z/`;
raw review artifacts are not part of the Git commit.
