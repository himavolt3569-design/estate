# Firebase compatibility decision

This is a review document, not a deployed policy. No production rules or records have been changed.

The read-only audit on October 30, 2026 compared project `mero-kotha-1f4f3` with its current Firestore release, updated October 25. The live rules are saved in `../../.feature-tests/artifacts/rules-audit-2026-10-30T14-29-58-353Z/1-firestore.rules`. Storage matches the local candidate. All 31 live composite indexes were READY.

## Proposed compatibility patch

Preserve these existing production permissions while adding the requested ad and sale rules:

| Existing production behavior | Current local candidate | Proposed result |
| --- | --- | --- |
| An account and super admins can read/write that account's saved searches, including older payloads. | Super admin access is removed; creation requires additional fields. | Retain the live owner/admin policy. This means super admins retain access to users' saved-search criteria. No new role receives access. |
| Listing edits may return a reviewed property to pending while retaining its existing review metadata. | The candidate requires the old review metadata to be cleared. | Permit unchanged or cleared review metadata on a reset to pending; prohibit adding a new review decision. |
| Verified agents can update their own public directory entry with a full payload, including UID, timestamps and an unchanged status. | The local field-difference check rejects some full upserts. | Retain the live full-payload behavior and its status constraint. These are public profile fields. |
| Super admins can suspend or review a legacy listing even when it has incomplete/invalid pricing. | Every admin update now requires valid pricing. | Validate new pricing when price, purpose or type changes; keep moderation-only updates working. |

The local save-count protection and new flat-sale prohibition remain in place. Public save totals do not expose who saved a property. Ad aggregates remain server-owned; guests may submit only the bounded event schema. The compatibility patch does not deploy anything.

## Approval status

Automatic approval review initially rejected applying this patch because it restores administrator access to saved searches and relaxes listing/profile constraints in the local candidate. On October 31, 2026, the user explicitly approved “preserving current production permissions.” The reviewed compatibility patch was then applied locally and synchronized as contract `2026-10-31.1`. Production remains unchanged. The new regression suite covers the retained access and payloads.

## Separate release considerations

The website adds `transactionType: rent|sale` and a separate `salePrice`; a missing type is a legacy rental. Flat sales are rejected. The unchanged checked-in Android source assumes monthly rental prices, so active sale records must be checked against the currently released Android data contract before enabling sale posting in the shared production project. No Flutter source changes are part of this deliverable.

Functions and the collection-group favourite index must be deployed before aggregate save counts/reporting are considered complete. Existing saves need the supplied dry-run-first backfill. These are distinct release steps, not implied by approving the local compatibility patch.
