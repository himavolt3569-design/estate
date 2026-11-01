# Land and sponsored properties

The active Firebase website uses an optional `land` map on a listing whose `roomType` is `land`:

```json
{
  "roomType": "land",
  "purpose": "sale",
  "transactionType": "sale",
  "rentPerMonth": 0,
  "salePrice": 8000000,
  "land": {
    "area": 4.5,
    "areaUnit": "aana",
    "landUse": "residential",
    "roadAccess": "motorable",
    "roadWidth": 20,
    "frontage": 30,
    "lengthUnit": "ft",
    "facing": "east"
  }
}
```

This example is illustrative. Asking price is the total price; area is displayed in the entered unit without local-unit conversion.

- Area is positive. Units: `aana`, `ropani`, `paisa`, `daam`, `kattha`, `bigha`, `dhur`, `sqft`, `sqm`.
- Optional use: `residential`, `commercial`, `agricultural`, `mixed`, `other`.
- Optional access: `motorable`, `footpath`, `none`. No road width is stored for `none`.
- Optional road width and frontage are positive, in `ft` or `m` (feet by default).
- Optional facing is one of the eight compass directions, using hyphenated intercardinal names.
- Blank optional choices use an empty string. Missing optional dimensions are omitted. The map accepts no additional keys.

New website land posts require area and unit. Older records may omit `land` or use null; their owners can still edit them. Floor, total floors and furnishing are omitted for land and removed when an owner converts a building listing to land. Land facts appear in cards, details, suggested descriptions, posting previews and sponsored content. Land-use/access filtering uses the same matching logic for the homepage, URLs and saved searches. Filters remain collapsed initially.

The live/native pricing field is `purpose`; the website reads it first and falls back to older web `transactionType`. New web writes set both consistently. Rental `salePrice` is zero, matching live numeric validation. Missing purpose fields mean rent. Flats remain rental-only in the website.

## Sponsoring a property

In Advertising, a protected superadmin selects **Sponsored property**, searches active listings, and filters by type and rent/sale purpose. Selecting a listing generates its title, total asking price or monthly rent, location, land area and cover. The ad resolves those values from the live listing rather than relying on the saved campaign snapshot. Inactive or removed properties stop appearing publicly; their campaign remains editable in administration.

Placement, device, priority, scheduling and pause controls remain available. Website ads retain uploads and destinations. Homepage placements use one cover per campaign; additional website campaign images can rotate in property-page placements. Top and between-listing placements are independent. An eligible campaign may appear in both, while each middle placement starts on a different campaign. Every middle rail contains one copy of each eligible campaign, browsable by touch swipe, mouse drag, horizontal trackpad/wheel or keyboard arrows/Home/End. There is no autoplay, visible scrollbar or carousel control strip. A property shown as sponsored is omitted from the ordinary homepage cards to avoid duplication.

Only the existing protected `superAdmin` role can write campaigns/settings. The existing `himavolt3569@gmail.com` account holds that role; no browser email allowlist or role grants were introduced.

## Validation

The `land.ts` model, shared form and Firestore validation agree on these fields. The canonical shared backend candidate and website mirror are versioned `2026-11-01.1`; contract checks verify the mirrored hashes. Native Dart source was not changed.

The production rules release is intentionally narrower than the complete local backend candidate: it adds only optional typed land validation to existing listing creation and land/type updates. It preserves live pricing, ownership, verification, role and advertising rules. Production documents and account roles are not modified by the release.

Checks include 77 unit tests, TypeScript, the production build, 20 isolated checks of the exact live-rule candidate and eight local browser scenarios for new/legacy land posting and editing, public facts/filtering, superadmin sponsorship, dynamic price updates, inactivity withdrawal, deduplication, and flat sponsorship in the homepage rail. Captures cover 320, 390, 800 and 1440 px in the private review folder. Test images and properties are disposable fixtures.

A separate saved-search browser regression verifies creating, editing and reopening land searches retain use/access criteria and hide/clear furnishing. The scoped production validation was published and verified; see [the release record](land-schema-release-2026-11-01.md).
