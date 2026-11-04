# Property details, advertising and public agents

Recorded 2026-11-04. This is an ordinary extension of the incumbent MeroKotha website. `DESIGN.md` and `.impeccable/design.json` continue to own the global visual system; this brief records the requested surface behavior. Preserve Poppins, royal blue, crimson actions, white bordered surfaces and English/Nepali support.

## Composition and responsive behavior

The category sequence is **Rooms, Flats, House, Apartments, Office, Shop, Lands, Others (All Properties)**. These remain working filters; Others clears the selected property type. Below 768px, the header is 80px high, Browse icons are 22px in 40px containers, and labels are 12px (11px below 360px). The wider header remains 68px. These are local responsive refinements.

Property details place the title advertisement directly below the listing/property-name breadcrumb and before the gallery. The gallery retains contained photography, selected thumbnails and the current-photo count; its full-image action is removed. The main price is followed by its own ad. The final main-column ad precedes **More places that fit**. The public agent card is followed by the closeable compact advertisement. Public agent information and property contact/inquiry actions remain readable as separate surfaces.

## Advertising contract

| Slot | Position | Superadmin setting |
| --- | --- | --- |
| `title` | Below listing-name breadcrumb, before photography | `detailTitleEnabled` |
| `price` | After the main property price | `detailPriceEnabled` |
| `recommendations` | Immediately before similar properties | `detailRecommendationsEnabled` |
| `agent` | After the public agent summary; also on its profile | `detailAgentEnabled` |

Every slot is independently enabled. Campaign `detailSlots` may target any subset; absent legacy fields retain previous eligibility. The existing master, `detailsEnabled`, partner inclusion, schedules, device targeting, priority and pause controls remain authoritative. Hide unavailable/ineligible ads without placeholders and exclude the viewed property's own sponsored campaign. Keep analytics in the existing `details` bucket.

Use existing campaign artwork with contained images, explicit Advertisement disclosure and readable HTML headlines. Detail carousels have a fine ink border and no outer shadow. Wider title/recommendation panels put a 240px artwork column beside copy; phone panels use a 30% artwork column and compact copy. The agent mini ad keeps an 84px artwork column. Detail CTA and mini-close targets remain at least 44px, with visible royal keyboard focus.

The latest user directive removes visible ad navigation controls everywhere: previous/next arrows, play/pause, counters, control strips/footers and numbered administration image-preview selectors. This supersedes the earlier visible-carousel/44px-arrow requirement. Shared galleries retain swipe and focusable ArrowLeft/ArrowRight/Home/End browsing; autoplay respects reduced motion, pauses on hover and stops after manual pointer/wheel/keyboard/focus interaction. Homepage/feed rails already have no visible controls. Preserve the mini close, destination actions and all superadmin campaign/image editing, scheduling, targeting, device preview and save/activate/pause actions. The admin preview displays the first image with the existing device treatment.

The mini close action dismisses only that advertisement for the current agent in `sessionStorage`; the corresponding public profile shares its dismissal. It does not disable the other slots. A new browser session may show it again. No new artwork or partner claims are introduced.

## Public agent information

The Listed by avatar/name and complete-profile action open `/profile/{exact-lister-id}`, preferring `agentId`, otherwise `ownerId`. The links remain available when the directory record is missing. `/profile/[id]` and existing `/agents/[id]` share the same person-profile component. Anonymous properties have no identity links, and a distinct owner's name must never stand in for their agent.

Resolve active `agentsPublic/{id}` first; signed-in visitors may fall back to the same-ID `usersPublic` display projection under existing rules. Whitelist shared name, photo, bio, location and explicit public phone/WhatsApp; document IDs override embedded ID fields. Never read private profiles or infer verification from a listing/user field: an active public agent entry alone supplies the badge. Inactive directory entries cannot reappear through fallback. Guard asynchronous state by both lister and viewer ID.

The profile shows only that exact person's active non-anonymous properties/counts. Guests without a directory entry see identity already public in their matching listings and a sign-in action for additional shared details; unavailable data is not invented. Verified agents still edit their public introduction/contact numbers in Account. Existing public-directory errors and mini-ad/session behavior remain.

## Property-photo processing

The shared website `uploadImages` path marks new `listings/` uploads before Storage writes, including create/edit/tour flows. The centered MeroKotha lettering is large and quiet: about 54% of image width, white at 19% alpha with a fine dark 12% stroke. It is part of the stored raster, so existing card/gallery/sponsored-property rendering also carries it. The canvas lettering uses a portable Arial fallback; this asset-processing choice does not replace UI Poppins.

Preserve aspect ratio; process files serially to limit mobile memory. Ordinary photos cap their long edge at 4096px and panoramas at 8192px. Prefer WebP output below 5MB; unreadable/unsupported input fails recoverably and cannot bypass marking. Existing stored photos, advertisement creatives, private chat attachments, account avatars and native Dart are outside scope.

## Evidence and limits

Evidence lives in `../review/property-detail-ads/`: the request/direction packet, full home/detail/profile/admin/editor captures, separate agent-card crops, Nepali detail capture and stored watermark sample. `validation.json` records passing TypeScript, 78 unit tests and the production build after the 44px correction; `checks.json` records 63 passing full browser assertions; `controls-fix-checks.json` adds six passing correction checks; `rule-checks.json` records 14 local permission/compatibility checks. There were zero uncaught browser errors.

The independent full review found only 40px detail-carousel targets. The scoped correction sets them to 44px; `finish-verdict.md` returns SHIP for that scored correction and its refreshed captures. The renewed build result is recorded separately in `validation.json`. The Impeccable detector was unavailable; the review applied the craft floor manually. This is bounded local evidence, not whole-site approval or an exhaustive assistive-technology audit. Watermark contrast was checked on a flat-color fixture; real photographs vary. No production writes, rule deployment or website deployment occurred.

The subsequent exact-person click correction is recorded in `../review/person-profile-click/`. Its packet, six captures, `checks.json` and `validation.json` record 82 passing unit tests, TypeScript/build and 45 passing browser checks at 1440/390px plus Nepali/guest states, including actual avatar/name clicks, three isolated people, legacy routes, privacy and inactive-entry handling. Browser errors are empty. The fresh independent `finish-review.md` returns SHIP with no material fixes for this bounded follow-up, without whole-site or production-release approval. It introduces no artwork, global design changes, permission changes, production writes or deployment.

The current control removal is recorded in `../review/ads-without-controls/`: six home/detail/admin captures, `review-packet.md`, `verify.mjs` and `checks.json`. TypeScript/build and 22 one-off browser checks pass at 1440/390px, including real phone swipe, keyboard browsing, no empty footers/overflow, retained mini-close/management actions and zero browser errors. No unit tests were added or rerun for this reversible removal. The fresh independent finish-review.md returns SHIP with no material fixes for this bounded removal; no whole-site or production-release approval is implied. Earlier 44px-carousel records remain historical evidence. No production writes, deployment or new artwork occurred.
