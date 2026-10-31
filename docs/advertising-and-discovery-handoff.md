# Advertising and property discovery handoff

Updated October 31, 2026. This is a local implementation. No website, Firebase rules, functions, indexes, or production records were deployed or changed during this work. Flutter source content is unchanged.

## Website changes

- Home navigation, grouped EMI/land tools, Saved and Messages links, and header property search between navigation and language controls.
- See my matches followed by All Rentals, Rooms, Flats and Apartments. Saved searches/new matches are a disclosure that starts closed on every page load.
- Four desktop listing columns, responsive tablet/phone layouts, a zoomable map with price markers and boundary filtering, and fixed property-preview grids (three cards on desktop, two on phones).
- A consolidated filter panel groups location, property type, rent/buy purpose and minimum/maximum prices. Property preferences expand for furnishing, facilities and verification, independent of map visibility. Applied criteria have individually removable chips and invalid budgets have inline feedback. Navigation, categories and map previews fit without horizontal scrolling.
- A light homepage hero prioritizes property search, with contained photography on desktop. The labeled homepage sponsor carousel is a compact strip below the hero. Other carousels appear after every configured 3–5 listings and between the property description and facilities. This replaces the integrated hero advertisement rejected by the user on October 31, 2026; campaign settings and placement identifiers remain compatible.
- Taller property gallery, full-photo viewer with zoom, public posting date/views/save totals, existing contact/inquiry/report flows, and up to five content-based recommendations.
- Rent/Sell posting for rooms, apartments, houses, offices, shops and land. Flats stay rental-only. Browsing uses Rent/Buy; sale cards/details show the asking price without a monthly suffix.
- Poppins is self-hosted with its open font license and Latin/Devanagari subsets. GSAP animates the hero once; reduced-motion users get the static composition. Carousels support pause, next/previous, swipe, focus/hover pause and reduced motion.

## Campaign management

Open `/dashboard?tab=ads` with a `superAdmin` account. Ordinary users cannot read aggregate ad reporting or modify campaign records/settings.

Display settings include a master switch, default partner presets, placement switches, feed spacing and slide duration. A campaign supports a brand, headline, description, website or listing destination, device targeting, priority, start/end timestamps, up to eight images, optional mobile artwork, button copy, pause/activate, duplication and desktop/mobile previews. Times are entered in the administrator's local time and stored as Firestore timestamps.

The presets preserve the supplied destinations exactly:

| Campaign | Destination | Artwork |
| --- | --- | --- |
| HimaVolt | `https://himavolt.com/` | Existing HimaVolt banner, copied with provenance. |
| Pitambari | `https://pitambari-vercel.app/` | Neutral brand card until artwork is uploaded. The user explicitly confirmed this spelling. |
| Floor Cleaner | `https://floor-cleaner.vercel.app/` | Neutral brand card until artwork is uploaded. |

Additional websites can be entered as campaigns. No extra websites or commercial claims were invented. Saving a preset uses its stable ID so pausing it overrides the default. The two Vercel destinations could not be verified as reachable in the initial environment; their exact supplied links were retained. See `ad-asset-origins.md`.

## Firebase schema

| Path/fields | Contract |
| --- | --- |
| `ads/{id}` | Existing collection extended with `imageUrls`, `mobileImageUrl`, `device`, `startsAt`, `endsAt`, `ctaLabel`, and `sponsorName`. Legacy `placement: home` maps to feed placements. |
| `adSettings/public` | Public display configuration. Only super admins may write it; feed interval is bounded to 3–5 and rotation to 4–15 seconds. |
| `adEvents/{id}` | Append-only bounded impression/click events. No account identity or contact details. Public writes, admin reads. |
| `adStats/{adId_UTC-day}` | Server-owned daily impression/click aggregates, readable only by super admins. |
| `_adEventReceipts/{eventId}` | Server-only transaction receipts prevent duplicate trigger deliveries from double-counting. |
| `listings/{id}.saveCount` | Public aggregate count. Clients cannot set a nonzero initial count or change an existing count; a server function reconciles private favourites. |
| `listings/{id}.transactionType` | Optional `rent` or `sale`; absence means a legacy rental. |
| `listings/{id}.salePrice` | Positive asking price for a sale. Sale records have `rentPerMonth: 0`; rental records keep their positive monthly rent and no sale price. Flat sales are rejected in both UI and rules. |

`merokotha/firestore.rules`, `storage.rules` and `firestore.indexes.json` remain canonical for the shared contract; website copies are synchronized under version `2026-10-31.2`. Only backend files in that folder changed. No Flutter/Dart SDK is needed for this website work or for the Firebase SDK/emulator tests.

## Recommendations and reporting

Recommendations use corpus-weighted text similarity (TF-IDF-style cosine), property type, price and geographic proximity. Rental and sale recommendations are kept separate. This is a content-based recommender using existing public property data; it does not call a generative AI service, require an API key, infer protected personal traits, or fabricate properties to fill a quota.

Browser impressions require at least one second at 50% visibility. Campaign interactions are deduplicated per browser session, campaign, placement and 30-minute window. Counts are best-effort product telemetry, not fraud-proof billing figures. Server receipts handle repeated Firebase trigger delivery. Favourite reconciliation reads the current matching set to stay correct when events arrive out of order; cost grows with the number of saves on a popular listing.

## Verification

- TypeScript validation and the optimized Next.js production build passed.
- 68 unit tests passed, including ad schedules/URLs, feed spacing, sale pricing/search/template behavior, and recommendations.
- 41 Firebase emulator checks passed across campaign/aggregate, existing integration, property-feature and mirrored saved-search suites. They cover approved production compatibility, private records, flat-sale denial, legacy rentals, real aggregate transactions, repeated event delivery, chat/inquiries/moderation and Storage ownership.
- 38 browser checks passed using only disposable `demo-merokotha-feature-tests` fixtures and temporary profiles, including filter preferences, removable criteria, invalid budgets, sorting, flat rental-only browsing, the hero search and existing ad controls. The report is `.impeccable/review/browser-checks.json`. Filter captures and `.impeccable/review/filter-layout-checks.json` cover 320, 390, 800 and 1440px, open/closed preferences, Nepali layouts and signed-in narrow navigation with no horizontal scroll containers. These are sample records, not production listings. See `.impeccable/review/final-review.md` for the scoped design review.

Commands:

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm check:firebase-contract
pnpm test:rules:campaigns
pnpm test:rules:integration
pnpm test:rules:features
pnpm test:rules:saved-searches
pnpm test:browser:campaigns
```

The permission/browser suites need the local demo emulators. Run suites sequentially because they reset shared demo fixtures. The browser suite expects the development server on `localhost:3016` with the emulator environment described in the README and existing scripts. Use the matching localhost origin for Next.js development resources. Production builds ignore the emulator switch.

## Read-only production review and release status

The Web App configuration points to `mero-kotha-1f4f3` and its current Storage bucket. The October 30 read-only audit found Firestore's live rules were updated October 25; Storage matches the local files and all 31 live composite indexes were READY. No private application records were inventoried.

The user explicitly approved preserving existing production saved-search admin access and older listing/profile payloads. The candidate implements that compatibility and adds regression coverage. See `firebase-compatibility-review.md` for the decision and the initial automatic approval rejection, which was resolved by that approval.

Before a production release:

1. Review the final rule diff against a fresh live snapshot. Use the synchronized contract; do not deploy a stale whole-file rule candidate from either checkout.
2. Confirm the currently released Android client understands sale fields before enabling active sale records in the shared production collection. The unchanged checked-in Android source assumes rental prices. This website implementation does not claim native sale compatibility.
3. Deploy the additive favourites collection-group index and wait until READY, then the reviewed rules and the new `onAdEventCreated`/`onFavouriteWritten` functions. Preserve existing chat notification functions.
4. Run `scripts/backfill-save-counts.mjs --project=<project>` in dry-run mode with trusted local Admin credentials, review the counts, then use `--apply` to reconcile historical saves. No Admin key belongs in the website's public environment. Historical counts display unavailable until populated; new website listings begin at zero.
5. Verify with real test accounts and the chosen production website domain, including Auth domain authorization, campaigns, uploaded media, inquiries, saved lists and cross-device behavior. Set production settings through the super-admin interface.

The backfill, function deployment, production rule/index deployment, live sale records and website publication remain unperformed. The local implementation and its review artifacts are ready for that release review.
