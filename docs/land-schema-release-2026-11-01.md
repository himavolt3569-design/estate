# Optional land validation release — November 1, 2026

Project: `mero-kotha-1f4f3`.

Published at `2026-11-01T11:55:52.387084Z`. The release was read back and its exact normalized source verified.

- Deployed ruleset: `projects/mero-kotha-1f4f3/rulesets/cf9e4744-06a2-43d6-abde-e6367f4c8b7d`
- Source SHA-256: `57a1ceade885ebead3acd6d44f6273b94ec987785e5ea49658d0fc2966755a56`
- Previous/rollback ruleset: `projects/mero-kotha-1f4f3/rulesets/1e55e652-5b60-4662-8356-d574f139aa88`
- Previous source SHA-256: `b7af7087317b51bab8c846613e29f74173a808fa67ac5a02119ece7035d3c20d`

Only the optional typed `land` map validation and its create/update checks were added. An inverse transformation proved that every other byte of the normalized live source was preserved. Pricing, ownership, verification, roles, ad administration and all other permissions remain as in the captured live baseline. Old land documents can omit the map or use null; unchanged legacy land fields are not revalidated during unrelated updates. No production listing, campaign, settings or account document was written, and no roles were granted.

The candidate passed remote compilation and 20 checks in the isolated demo emulator, including native `purpose` sale records, legacy land creation/editing, valid local units, invalid values, owner-only edits, and conversion back to a building. Eight local browser flows verified the corresponding website behavior. A separate browser regression verified saved-search creation, editing and reopening retain land use/access while clearing furnishing. The production build, TypeScript and all 77 unit tests passed. The finish reviewer marked both saved-search material fixes resolved and returned `ship` for those scored fixes.

The website mirror and canonical shared backend candidate remain versioned separately as `2026-11-01.1`; the complete candidate was not deployed. Native Dart code and Cloud Functions were not changed. Private source snapshots, test reports and the release verification are retained under `.impeccable/review/land-sponsored/` and are excluded from publication.
