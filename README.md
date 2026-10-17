# MeroKotha website copy

This is a copy of `estate/` using its Poppins typography, colors, buttons, inputs, surfaces, hero image, floating search panel, listing cards, and dashboard navigation. The visible pages are adapted for MeroKotha rentals while the active Next.js routes use the **same Firebase Auth, Firestore, and Storage project as the Android app**. The earlier Supabase routes are preserved in `src/legacy-app/` for reference.

## Set up locally

1. Sign in to [Firebase Console for `mero-kotha-1f4f3`](https://console.firebase.google.com/project/mero-kotha-1f4f3/settings/general) and verify it is the Android app's live project. In Project settings > Your apps, register a Web App (or use an existing Web App for this site). Name it `estate-merokotha-website`, then copy the generated public config into `.env.local` using `.env.example` as the field list. You can do this yourself if your account can manage the project. The existing `.env.example` does not need to come from the Android developer. Do not use a service account key here.
2. Enable Google and Email/Password sign-in in Firebase Authentication, and add the web domain to authorized domains. Review existing phone-only accounts before disabling the Phone provider in Firebase; this website no longer offers phone sign-in.
3. If App Check is enforced, register a web reCAPTCHA v3 provider and set `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`. If using browser push, set the Web Push VAPID public key and use HTTPS in production.
4. Run `pnpm install`, `pnpm typecheck`, `pnpm build`, then `pnpm dev`. The `pnpm-workspace.yaml` file records explicit build-script decisions so pnpm 12 does not stop at its approval prompt. If this checkout was installed before those decisions were added, rerun `pnpm install` so the allowed package setup scripts can run.

The lockfile includes the Firebase Web SDK. Typecheck, production build, existing unit tests, and local HTTP smoke checks passed on 2026-10-13. Browser sign-in and live Firestore/Storage flows still need testing against Firebase. The Android source in this workspace currently signs in through Google only; its onboarding phone field is profile data. To preserve an existing Android account's UID and data, sign in with the same Google account on web, then add an email/password method from the web profile if desired. Poppins is loaded by the browser from Google Fonts, keeping the copied design while allowing offline production builds; system fonts are the fallback if that font request fails.

The design adaptation was checked at desktop width and at an actual 390px browser viewport. The listing cards and signed-in dashboard still need a visual review with real Firebase data. Temporary local screenshots and Chrome preview profiles are excluded by `.gitignore`.

## Routes

- `/`: public rentals, advanced filters, saved searches, map, and ads.
- `/dashboard`: profile, onboarding, rental posting/management, favorites, saved-search match counts, inquiries, chats, agent application, and admin tools.
- `/dashboard?tab=searches`: create and manage searches. Each search links to its own results with `&search=<id>#saved-search-results`.
- `/sign-in`: explicit Google OAuth, email/password sign-in, account creation, and password reset; signed-in users can add the other provider to their existing account.

Email/password registration asks for a name, location, optional phone and optional profile photo. Firebase's default minimum password length is six characters, and the project may enforce stricter rules. Password reset is for accounts with an email/password method; Google-only users should use Google. If a reset request succeeds but no email arrives, check Inbox/Spam and the Firebase Authentication email template and provider settings. Live delivery cannot be confirmed from a local build.
- `/listing/[id]`: rental details, save, inquiry, location.
- `/listing/[id]/edit`: owner edits, public contact choices, photo ordering/removal; revised verified listings return to pending.
- `/agents` and `/agents/[id]`: verified agent directory and public agent profiles.
- `/chat/[id]`: shared Firebase conversations with text/image messages and read state.

## Rules and production

The `firebase/` folder is a **local review candidate**, mirrored from Android's canonical rules and indexes under contract `2026-10-17.1`. On 2026-10-17 a read-only CLI audit found that the deployed Firestore rules differ from both previous local files, while Storage matches. The candidate merges the newer production Android paths with the web permissions, preserves all 26 live composite indexes and adds the five missing web indexes. It has **not been deployed**. See [the rules review](./FIREBASE_RULES_REVIEW.md) and [the integration handoff](./FIREBASE_INTEGRATION.md) for exact findings, remaining schema differences, rollout order, and validation limits.

Run `node scripts/firebase-contract.mjs` before deployment; Firebase predeploy hooks run it automatically. Reviewed changes belong in Android's canonical files, followed by `node scripts/firebase-contract.mjs --sync --version=<new-version>` with both folders present. The versioned hash manifest also validates a standalone checkout. Use one release owner for the shared backend: deploying from separate stale copies replaces the same project's active rules. `node scripts/audit-live-firebase-rules.mjs --project=mero-kotha-1f4f3` reads the live rules/index metadata using the Firebase CLI login and saves comparison artifacts without changing production.

With the demo emulators below running, use `node scripts/test-integration-rules.mjs`, `node scripts/test-feature-rules.mjs`, and `node scripts/test-saved-search-rules.mjs` sequentially. Integration tests can also load the Android source using `MEROKOTHA_RULES_SOURCE=../merokotha/firestore.rules`. These are SDK permission tests, not a compiled Android device test. Saved-search counts remain in-app only; background alerts require a separate notification service.

### Saved searches: missing or insufficient permissions

Saved searches load from `users/{uid}/savedSearches`. Firestore permissions on the parent `users/{uid}` document do not apply to this subcollection, including for an account with the `superAdmin` role. Both local rule sources now explicitly allow users to read their own saved searches and non-banned users to save, view, and delete them. The Android deployment source previously omitted this match and reproduced the reported error even for an admin.

To fix the live project, open [Firestore Rules for mero-kotha-1f4f3](https://console.firebase.google.com/project/mero-kotha-1f4f3/firestore/rules), compare the deployed rules, and add the following inside the existing `match /users/{userId}` block if it is missing, alongside `favourites`. This snippet uses the existing `isMe` and `notBanned` helpers. Publish the rule update and reload the website. An application ADMIN role does not grant Firebase Console or CLI deployment permissions.

```text
match /savedSearches/{searchId} {
  allow get, list: if isMe(userId);
  allow create: if isMe(userId) && notBanned()
    && request.resource.data.keys().hasAll(['name', 'filters', 'createdAt', 'lastViewedAt'])
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.name.size() <= 80;
  allow update, delete: if isMe(userId) && notBanned();
}
```

The saved-search-only patch was published to `mero-kotha-1f4f3` on 2026-10-14 after confirming the live rule was missing. Firebase compiled the rules successfully, and a read-back verified the active rules exactly match the tested Android rules. Previous and current release details and rule content are saved in `../.feature-tests/artifacts/firebase-saved-search-fix-20261014/before.json` and `after.json`. Reload the website to restart any listener that already failed. Deploying the entire website rule candidate also introduces unrelated feature and verification policies and requires their separate review.

With the test tools installed as described below, start the isolated Firestore emulator and run `pnpm test:rules:saved-searches` in a second terminal:

```powershell
../.feature-tests/node_modules/.bin/firebase.cmd emulators:start --only firestore --project demo-merokotha-saved-search-tests --config firebase.json
```

The regression checks exercise both local deployment sources: admin and customer access to empty and populated collections, saving, marking viewed, deletion, cross-account privacy, guest denial, and banned-user write denial. They never access production.

### Saved-search matching and results

Search criteria are separate from the optional display name. Location/keyword, type, rent range, furnishing, facility, verification, and an existing nearby location are combined using the same matching function as the public feed. Every keyword must appear in the rental's title, address, landmarks, or description; case, word order, and repeated whitespace are ignored. Only active rentals count. Counts remain unavailable while loading or when a listing read fails.

Older saves with entirely empty filters interpret their saved name as the intended keyword at read time. This recovers entries such as “janakpur,” “bhaktapur,” and “kapan” without changing stored records. Existing searches with actual filters retain them. New saves and edits set `criteriaVersion: 1`, so an explicitly created all-active-rentals search may use any display name.

Clicking a search opens Dashboard → Saved searches, selects it, and scrolls/focuses its results section. Results support editing criteria, newest/price ordering, nine-at-a-time pagination, and an unseen-only view. New means a matching rental was posted after that search's `lastViewedAt` (or its creation time); opening successfully loaded results records a visit while keeping that visit's original unseen badges visible. Reloading shows only subsequent arrivals as new. Counts update through the live listing subscription while the website is open; background notifications are not provided.

After starting the demo emulators and development server described below, run `pnpm test:browser:saved-searches`. It checks distinct counts across 13 active fixtures, legacy recovery, exact results, persisted visit state, live updates, sorting, zero results, editing, saving with a budget and separate label, mobile layout, reload/back navigation, deletion, and listing-read failures. Run it sequentially with the other integration scripts because it resets the demo Firestore fixtures.

## Posting autofill and location search

The active web posting form generates an editable title and description from the Property and Location sections, rent, deposit, floor, furnishing, availability date, and selected facilities. It includes **84 property-specific description templates** (12 each for room, flat, apartment, house, office, shop, and land), English/Nepali generation, and a **Try another template** button. Descriptions use only entered facts; land descriptions omit building/furnishing details. Editing either generated field preserves that field's text through subsequent selection and language changes. **Use suggested title/details** explicitly restores automatic updates from the latest inputs.

Facilities are grouped checkboxes, saved as the existing string array. All ten established Android facility values remain selectable, alongside nine additional options. They are included in the suggested description and the existing public facilities list.

**Search location** (or Enter in its input) queries `/api/places` only on request. Choose a result to fill its address, use its name as the nearby landmark, and position the map pin. Both text fields and the pin remain editable. For example, `CIWC Hospital` returns CIWEC Hospital branches with different Kathmandu/Pokhara addresses; the user must select the intended branch. Empty results, unavailable search, and cancelled/stale requests preserve the existing location. Search Enter never publishes the form.

The server uses [Photon's OpenStreetMap geocoder](https://github.com/komoot/photon#demo-server), filters results to Nepal, caches matching requests for a day, and limits upstream requests to eight seconds. No API key is required for the default public demo. Its operator permits reasonable traffic but does not guarantee availability; set server-only `GEOCODING_BASE_URL` to your own Photon-compatible service for higher traffic. Place coverage depends on OpenStreetMap; manual address entry remains available.

After starting the demo emulators and development server from **Local feature verification**, run `node scripts/test-listing-autofill-browser.mjs` (or `pnpm test:browser:listing-autofill`). It verifies generated details, keyboard search and selection, editable results, facility additions/removals, template cycling, preservation/restoration of manual edits, empty/error/stale searches, English/Nepali, 320–1440px layouts, saved Firestore fields including the hospital's coordinates, and leaving the form during map setup. The map cancels delayed resize callbacks on removal so rapid navigation/posting cannot access a destroyed Leaflet map. The script resets only its own demo posting account and listings; run sequentially with other integration scripts. Screenshots go to `../.feature-tests/artifacts/listing-autofill/`.

Validated locally on 2026-10-15 with 57 unit tests, TypeScript, a production build, the posting-autofill browser check (including IME text entry), and the existing duplicate-submission/photo-retry browser regression. The actual `/api/places?q=CIWC%20Hospital` endpoint returned both Nepal hospital branches. Production rollout is tracked by the GitHub pull request and Vercel deployment checks; no production Firebase documents or rules were changed by these features.

## Duplicate rentals repaired on 2026-10-15

The live shared Firebase database contained six Maitidevi flat documents and two Kirtipur room documents, created seconds apart on September 28–29. The property details matched exactly; every extra photo matched a photo on the retained record by SHA-256. This is consistent with repeated submissions. The records predate the website integration, and the stored data does not identify the originating client.

The repair retained `SbOnQPTCv1C5gpngNRDh` (Maitidevi, all four photos and its existing inquiry) and `Q9joVlKH9xtJ2UbGiFJ9` (Kirtipur, verified and already favorited). Six extra documents are now `paused` with `duplicateOf`, a reason, and an archive timestamp. No documents, media, inquiries, favorites, or chats were deleted or reassigned. Active rentals fell from 13 to 7, and the live website was checked at desktop and mobile sizes. Backups, the reviewed plan, photo evidence, and browser captures are in `../.feature-tests/artifacts/listing-duplicates-20261015/`; the committed repair and before/after documents are in `../.feature-tests/artifacts/duplicate-repair-2026-10-15T04-47-56-345Z/`.

`node scripts/repair-duplicate-listings.mjs --project=<id> --plan=<file>` previews an explicitly reviewed `{ project, groups: [{ canonicalId, duplicateIds }] }` plan. `--apply` pauses its extra records in one transaction, checks matching property details, saves a raw backup before writing, and verifies the result. A repeated run makes no changes. Backups contain original Firestore field values; to undo the repair, restore only the five changed fields (`status`, `updatedAt`, `duplicateOf`, `duplicateArchivedReason`, `duplicateArchivedAt`) from `before.json`, deleting fields that were originally absent. Review any subsequent changes before restoring.

The local web posting form now keeps one document ID across retries, locks submission synchronously, and creates through a transaction that preserves an existing record. A failed contact/photo step can be retried without inserting another rental. This code change still needs website deployment; the live database correction is already applied. Android's current source already guards the entire owner and agent submission through photo upload; the installed app version was not inspected. With the demo emulators and development server from Local feature verification running, `pnpm test:browser:listing-duplicates` checks six rapid submits, a denied photo upload, retrying the same record without resetting its data, and posting a separate rental from a fresh form. It resets only the demo fixtures and must run sequentially with other integration scripts.

## Virtual tours, analytics, and reports

- **360° tours:** open a rental's Edit page, upload up to eight 2:1 equirectangular JPG/PNG/WebP panoramas (under 5 MB each), name the rooms, and click a panorama to add navigation hotspots. Each room supports up to twelve hotspots. Save the tour separately from the rental details. Tours appear on the public rental page; saving or removing a tour resets listing verification to pending. Removing a room also removes links to it. Existing `photoUrls` remain ordinary listing photos, so older Android clients remain compatible.
- **Detailed analytics:** Dashboard → Analytics provides 7/30/90-day visit and inquiry charts, approximate anonymous browser counts, sources, device sizes, inquiry outcomes, recent activity, and per-rental performance. Administrators see all rentals in Administration. Date boundaries use Nepal time. New web visit events live in `listingVisits`; older Android lifetime counts remain in `listings.viewCount`. Detailed history starts when this feature is enabled and does not reconstruct past visits. Repeated visits are limited by the browser to one per rental per 30 minutes. Referrers store only hostnames; visitor account IDs, emails, phone numbers, query strings and IP addresses are not collected. Event counts are informational, not billing-grade. Queries are bounded to 2,000 events and show a notice when limited. Inquiries can originate in either client, so the inquiry/visit ratio is not a web-only conversion attribution.
- **Report moderation:** signed-in, non-suspended users can report another user's rental once. Dashboard → My reports shows their own submission and moderator response, including after a rental is paused. Reports are stored in `listingReports` and are readable only by their reporter and superAdmins. The admin queue filters open, reviewing, resolved, and dismissed reports; open/reviewing queues show oldest first. Each decision requires a note. Starting review or closing a report records an append-only `adminDecisions` event. “Pause rental & resolve” atomically pauses the rental, closes the report, and records the decision. Closed reports cannot be edited or reopened by clients.

Review and deploy the proposed Firestore rules and indexes before using the new server-backed features. No production rules, indexes, functions or records were changed by this implementation. The Storage paths and rules for rental images are reused. Tour metadata is optional, while Android needs its own UI to display tours, detailed analytics and report workflows. Web and Android should continue to use the same Firebase project.

## Local feature verification

The usual checks are `pnpm typecheck`, `pnpm test`, and `pnpm build`. The isolated integration scripts use a **demo project only**, not `.env.local` production data. They require Java 21+, Node, and Chrome at the executable path in `scripts/test-feature-browser.mjs` (adjust it for another machine).

Install test-only tools outside the website dependency tree:

```powershell
npm.cmd install --prefix ../.feature-tests --no-audit --no-fund @firebase/rules-unit-testing firebase-tools playwright firebase-admin
../.feature-tests/node_modules/.bin/firebase.cmd emulators:start --only "auth,firestore,storage" --project demo-merokotha-feature-tests --config firebase.json
```

In another terminal, run `node scripts/test-feature-rules.mjs`. It checks visit access, report privacy and impersonation, duplicate prevention, moderation, verification resets, and Storage ownership.

For browser verification, start a development server in another terminal:

```powershell
$env:NEXT_PUBLIC_FIREBASE_USE_EMULATORS='true'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID='demo-merokotha-feature-tests'
$env:NEXT_PUBLIC_FIREBASE_API_KEY='demo-key'
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN='localhost'
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET='demo-merokotha-feature-tests.appspot.com'
$env:NEXT_PUBLIC_FIREBASE_APP_ID='1:000:web:demo'
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID='000'
$env:NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=''
$env:NEXT_PUBLIC_FIREBASE_VAPID_KEY=''
$env:MEROKOTHA_TEST_DIST_DIR='.next-saved-search-tests'
pnpm exec next dev -p 3014
```

Run `node scripts/test-feature-browser.mjs` after the emulators and dev server are ready. It seeds and clears only the local `demo-merokotha-feature-tests` project, checks owner/guest/renter/admin flows, and writes screenshots to `../.feature-tests/artifacts`. Run the rule and browser scripts sequentially because they reset their shared emulator fixtures. Production builds ignore the emulator switch; the rules' localhost tour URL exception requires an authenticated token for that exact demo project.

The original website's Supabase users/properties are not in Firebase. See `../log.md` for the full integration plan, missing inputs, and acceptance checks.
