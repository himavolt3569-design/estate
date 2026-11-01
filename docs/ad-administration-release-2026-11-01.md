# Ad administration release - November 1, 2026

The existing verified, enabled Firebase account `himavolt3569@gmail.com` has the protected `superAdmin` role. The website Advertising dashboard is `/dashboard?tab=ads`. Authorization uses the protected role rather than a client-side email check.

The live Firestore rules permitted superadmin campaign management but lacked an `adSettings` match. Only the following block, already present in the shared versioned candidate, was added to a freshly captured live ruleset. Removing this block reproduces the prior normalized live source exactly. Account roles, passwords, campaign records, display choices, Storage rules, indexes and functions were unchanged.

```text
// Shared web/Android campaign display settings. No secrets are stored here.
    match /adSettings/{settingsId} {
      allow read: if settingsId == 'public';
      allow write: if isAdmin() && settingsId == 'public'
        && request.resource.data.enabled is bool
        && request.resource.data.partnerAdsEnabled is bool
        && request.resource.data.heroEnabled is bool
        && request.resource.data.feedEnabled is bool
        && request.resource.data.detailsEnabled is bool
        && request.resource.data.feedInterval is int
        && request.resource.data.feedInterval >= 3 && request.resource.data.feedInterval <= 5
        && request.resource.data.rotationSeconds is int
        && request.resource.data.rotationSeconds >= 4 && request.resource.data.rotationSeconds <= 15;
    }
```

The settings document did not exist at release time. An anonymous read changed from `403 PERMISSION_DENIED` to `404 NOT_FOUND`, confirming the path is permitted and ready for its first superadmin save. No production settings document was created by the release.

## Release record

- Project: `mero-kotha-1f4f3`
- Release: `projects/mero-kotha-1f4f3/releases/cloud.firestore`
- Previous/rollback ruleset: `projects/mero-kotha-1f4f3/rulesets/f047e0ba-54a0-490a-b60b-2eb5f2e7d59f`
- Applied ruleset: `projects/mero-kotha-1f4f3/rulesets/1e55e652-5b60-4662-8356-d574f139aa88`
- Applied source SHA-256 after newline normalization: `b7af7087317b51bab8c846613e29f74173a808fa67ac5a02119ece7035d3c20d`
- Applied at UTC: `2026-11-01T06:50:35.678866Z`
- Verification: remote compiler accepted the source; the active release and downloaded source matched the tested candidate exactly.

## Validation

Twelve local emulator checks reproduced the missing permission, verified superadmin settings and existing campaign controls, and denied guest/customer/owner/agent writes, same-email-without-role writes, self-promotion, invalid values, other settings IDs and unrelated private-profile reads.

With the test-only tools and demo emulators described in README running, use `node scripts/test-ad-admin-rules.mjs`. It derives before/after fixtures from the versioned rules and writes only to `demo-merokotha-feature-tests`. To replay against a separately captured pre-release live rules snapshot, pass `--baseline=<path>`. No live-rule mutation or credentials are part of this regression.

The broader local Firebase candidate and homepage UI have separate release requirements. Do not replace current live rules with an older full-file snapshot to apply this addition.
