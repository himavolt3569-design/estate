# Android and website Firebase integration review

Reviewed October 17, 2026. Status: local fixes and tests complete; production
unchanged; latest Android build/source and cross-device release verification pending.

Paths in this report use the original workspace layout: sibling `merokotha/`
(Android), `estate-merokotha-website/` (Firebase website), and `estate/` (original
Supabase website). Each release repository includes a copy of this review; raw
audit artifacts stay in the local review workspace.

## Answer

Yes, the Android developer's concern is supported by the code and the live
Firebase configuration. There were three different Firestore contracts: the local
Android rules, the local website rules, and the deployed Firebase rules. Some
changes on the website side had not been included in the deployed contract, while
the deployed rules also included newer Android changes absent from this checkout.

Firebase applies one active ruleset to both clients using the same database.
Deploying from either stale folder can replace permissions the other client
needs. This is configuration and data-model drift; creating the project with
Android tools does not itself cause it.

## Live evidence

Used the existing Firebase CLI login to read rules and composite-index metadata
for project `mero-kotha-1f4f3`. No private application documents were queried.

| Item | Observed live state |
| --- | --- |
| Firestore ruleset | `2630778c-05dc-4c00-b2f2-90021e4ca63a` |
| Last Firestore update | October 15, 2026, 21:41:08 Nepal time |
| Local comparisons before fixes | Neither local Firestore file matched production; the two local files also differed |
| Storage | Production matched both local copies |
| Composite indexes | 26 deployed, all READY; five web definitions absent live and five newer Android definitions absent from the website file |

Rule sources, release metadata and index definitions are saved in:
`.feature-tests/artifacts/rules-audit-2026-10-17T10-34-56-239Z/`.
The reproducible comparison against the saved live rules is in
`baseline-integration-tests.txt` there: 5 compatibility scenarios passed and 8
failed. These are test scenarios, not a count of reported production incidents.

## Confirmed problems

| Problem | Evidence and effect |
| --- | --- |
| Listing creation mismatch | Live rules require `verificationStatus: pending`. Local Android `ListingModel.toMap()` and both creation repositories omitted it. Replaying that payload against the live rules in the emulator fails with `permission-denied`. The installed APK was not inspected. |
| Review edit mismatch | Live uses `reviewedAt/reviewedBy/reviewReason`; web uses `verifiedAt/verifiedBy/verificationReason`. Local Android edits do not reset verification. The previous web candidate would deny verified-listing Android content edits; web resets also conflicted with the deployed immutable `reviewed*` fields. |
| Missing web profile permissions | The live profile allowlist lacks `contactEmail` and `agentBio`, which the web writes. Profile creation/saving also needs to handle an optional or absent contact phone consistently. |
| First chat cannot open | Both client implementations read a deterministic chat ID before creation. The old rules deny reading a nonexistent chat. The emulator reproduces the denied read, preventing the normal first-chat flow. |
| Missing web collections | Production lacks the web `listingVisits`, `listingReports` and `adminDecisions` permissions. These features cannot be enabled by only changing frontend code. |
| Different feature schemas | Live permits `reports`, `listingEvents` and `moderationHistory`, while web uses different names and field/status models. Granting both paths does not make their records appear in a common queue or dashboard. |
| Index drift | The website needs five additional composite indexes. Production also has five newer Android indexes absent from the old local files. A rule permission fix does not fix a missing-index query error. |
| Authorization gaps | Emulator checks showed the live signup rule accepts self-assigned verified agent status, and a pending listing can carry forged `verifiedBy` metadata. The candidate denies these operations. No claim is made that anyone used these gaps. |
| Saved-search policy drift | Live allows admin access to other users' searches and banned-user changes; the intended local web policy is account-private and blocks banned-user writes. The candidate restores that tested policy. |

## Local changes completed

1. Merged the newer live Android permissions with web requirements. Preserved
   existing Android collection paths and public-profile fields. Both local
   Firestore rule files now match under contract `2026-10-17.1`.
2. Made Android's rule/index files canonical, with website mirrors, a versioned
   hash manifest, a synchronization command and Firebase predeploy checks. A
   disposable-checkout test confirmed unreviewed rule changes abort the check.
3. Updated local Android creation to explicitly write pending verification.
   Kept legacy creation without that field compatible with the candidate.
4. Updated Android and web content/tour edits to clear both review-metadata
   formats. Availability-only toggles preserve verification. Agent edits save
   their private contact and listing reset atomically; rules inspect the
   post-batch listing state.
5. Fixed authenticated first-chat existence checks. Reading existing chat
   contents still requires participation/admin access, and creating a chat still
   requires the corresponding accepted inquiry.
6. Kept production Storage rules unchanged and combined all 26 live composite
   index definitions with the five web additions, giving 31 local definitions.
7. Added a read-only live-audit script and an SDK emulator compatibility suite.

Key files:

- Android canonical contract: `merokotha/firestore.rules`,
  `merokotha/firestore.indexes.json`, `merokotha/firebase-contract.json`.
- Deployment check/sync: `merokotha/scripts/firebase-contract.mjs`, mirrored in
  the website; predeploy hooks in both `firebase.json` files.
- Android writes: `lib/features/owner/data/owner_repository.dart`,
  `lib/features/agent/data/agent_repository.dart`, and
  `lib/features/agent/providers/agent_providers.dart` under `merokotha/`.
- Web review resets: `src/app/listing/[id]/edit/page.tsx` and
  `src/lib/firebase/property-features.ts` under `estate-merokotha-website/`.
- Tests/audit: website `scripts/test-integration-rules.mjs` and
  `scripts/audit-live-firebase-rules.mjs`.

## Verification

| Check | Result |
| --- | --- |
| Compatibility against the saved deployed rules | 5 passed, 8 failed; failures demonstrate the reported classes of mismatch |
| Compatibility against merged website rules | 13/13 passed |
| Compatibility against merged Android rules | 13/13 passed |
| Existing web feature/Storage rule tests | 7/7 passed |
| Saved-search rules suite, both sources | Passed (10 test-runner results, including two parent suites) |
| TypeScript | Passed |
| Web unit tests | 57/57 passed |
| Website production build | Passed |
| Local contract integrity and drift rejection | Passed |
| Flutter generation, analyzer, tests, APK/device checks | Not run: this checkout has no Flutter/Dart SDK or generated Riverpod files |
| Production deployment and live cross-device tests | Not performed |

Emulator checks execute real Firebase SDK reads/writes against isolated demo
projects; they do not execute the Dart code or prove Play Store behavior.

## What still needs to happen

The developer's latest Android source is needed for the newer features visible
in production rules. Firebase CLI can reveal active backend rules and indexes;
it cannot retrieve the developer's local source or prove the released app's
payloads and UI. The local patch is ready for reconciliation and review.

The detailed handoff in `merokotha/docs/firebase-integration.md` covers each
remaining schema difference and the rollout commands. In particular, decide a
common reports, analytics and audit model before claiming those features are
shared. Retaining both collections is a compatibility measure, not a migration.
Verify Android directory approval/revocation and public-contact behavior too.

Then regenerate/analyze/test Android, run both clients against staging, obtain
release approval for this exact candidate, deploy additive indexes and wait for
READY, deploy reviewed Firestore rules from the agreed release checkout, and
release/test the clients. Storage and Functions need no deployment for this patch.
Use one backend release owner; a local manifest cannot prevent an older revision
or direct Console/API changes from replacing live rules.

Production rules, indexes, accounts, data, Functions and hosted website have not
been changed during this review. The original `estate/` Supabase site is outside
this change. A final production fix requires the reviewed deployment and actual
Android/web verification; matching local files alone is not that verification.

## Firebase references

- [Manage and deploy Firebase Security Rules](https://firebase.google.com/docs/rules/manage-deploy):
  CLI deployment replaces the target project's existing rules.
- [Securely query Firestore data](https://firebase.google.com/docs/firestore/security/rules-query):
  query constraints must satisfy the permissions; rules do not filter results.
- [Rules conditions and atomic operations](https://firebase.google.com/docs/firestore/security/rules-conditions):
  `getAfter` checks document state after a batch, before commit.
