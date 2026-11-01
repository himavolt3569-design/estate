---
name: MeroKotha
description: The implemented Poppins, royal blue, crimson and white interface for property discovery in Nepal.
colors:
  royal-50: "#eff6ff"
  royal-100: "#dbeafe"
  royal-200: "#bfdbfe"
  royal-400: "#60a5fa"
  royal-500: "#3b82f6"
  royal-600: "#2563eb"
  royal-700: "#1d4ed8"
  royal-800: "#1e40af"
  royal-950: "#172554"
  crimson-50: "#fff1f3"
  crimson-500: "#ef3358"
  crimson-600: "#d81b45"
  crimson-700: "#b6113a"
  emerald-50: "#f0fdf6"
  emerald-200: "#bbf7d4"
  emerald-800: "#11593c"
  clay-500: "#e05a48"
  clay-700: "#a9372d"
  white: "#ffffff"
  ink-50: "#f8fafc"
  ink-100: "#f1f5f9"
  ink-200: "#e2e8f0"
  ink-300: "#cbd5e1"
  ink-500: "#64748b"
  ink-600: "#475569"
  ink-700: "#334155"
  ink-800: "#1e293b"
  ink-900: "#0f172a"
typography:
  display:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0em"
  title:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.7rem"
  body:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.625rem"
  body-small:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.4rem"
  label:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.4rem"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  pill: "9999px"
spacing:
  tight: "8px"
  compact: "12px"
  regular: "16px"
  card: "20px"
  section: "24px"
  wide: "32px"
  hero-gap: "64px"
components:
  button-primary:
    backgroundColor: "{colors.crimson-600}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.crimson-500}"
  button-royal:
    backgroundColor: "{colors.royal-700}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  button-ghost:
    textColor: "{colors.ink-600}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    typography: "{typography.body-small}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  badge-verified:
    backgroundColor: "{colors.emerald-50}"
    textColor: "{colors.emerald-800}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  surface:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.xl}"
  listing-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  campaign-carousel:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.lg}"
  campaign-panel:
    rounded: "{rounded.md}"
  landing-promo:
    backgroundColor: "#eaf4ff"
    textColor: "#173e79"
    rounded: "{rounded.lg}"
  discovery-searchbar:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "14px"
    padding: "12px"
  rental-filters:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "0"
    padding: "0"
  navigation-current:
    backgroundColor: "{colors.crimson-50}"
    textColor: "{colors.crimson-700}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
---

# Design System: MeroKotha

## Overview

**Creative North Star: "MeroKotha property discovery"**

This is a record of the implemented interface, preserving the established MeroKotha identity. Poppins, royal blue, crimson actions and white surfaces provide continuity across English and Nepali property discovery, account screens and administration. Property photography supplies the primary imagery; content and controls sit on light, bordered surfaces. The current homepage uses a compact introduction, a visibly headed partner advertising section with temporary generated blue/lavender/mint raster artwork, visible property categories and a minimal live search before listings. Property photography belongs to the listings; the introduction has no photo or large form.

The interface combines rounded cards with compact form controls and visible selected states. Royal blue carries navigation, price emphasis and map selection; crimson identifies primary actions. The discovery extension uses smaller campaign and map corners alongside the larger existing card shapes. This coexistence is observed implementation, not a new universal radius rule. The current discovery search keeps advanced filters collapsed inline and the map closed initially. All eight category choices fit a grid. Browse navigation uses four equal guest columns or five signed-in columns; synchronized map previews show up to three complete cards on wider layouts and two on phones, without sideways scrolling.

**Key Characteristics:**

- Poppins for headings, text, labels and numbers.
- Royal blue structure and links, crimson primary actions, white surfaces and ink text.
- Property photographs, clearly disclosed illustrated partner panels and a synchronized map/photo preview grid.
- Rounded bordered surfaces, light shadows and touch-oriented controls.
- Responsive composition and motion that respects reduced-motion preferences.

This record is grounded in `src/styles/globals.css`, the active `src/app` screens, `src/components/ui`, and `src/components/merokotha`. The durable identity comes from `PRODUCT.md`; homepage composition remains in `.impeccable/surfaces/rental-discovery.md`. The current generated-art revision is recorded in `.impeccable/review/generated-ad-artwork/`: five viewport captures, all three mobile ad states, Nepali and client-upload evidence, plus `checks.json`. The 69 unit tests and production build pass; local browser checks cover five widths, loaded generated images, the blue HimaVolt palette and superadmin upload replacement. The completed artwork review returned SHIP for the three interim generated banners, blue HimaVolt palette, readable live copy and contained client-upload replacement: all required rows matched, all ten required captures were valid, and there were zero material fixes. Earlier ads-visibility evidence is recorded in `.impeccable/review/ads-visibility/` with five viewport captures, `mobile-ad-{1,2,3}.png`, `checks.json` and `public-read-check.json`. Final keyboard evidence is `mobile-focus.png`, `desktop-focus.png` and `focus-checks.json`: real Tab focus exposes an unclipped 2px royal outline inset by 3px, matching the sidecar preview. The final ad regression and production build pass. The read-only anonymous production check returned 403 for public settings and 200 for campaigns. Local demo-rule regressions verify all three ads with settings denied, with both reads denied, explicit off switches, paused overrides and no horizontal page overflow at five widths; 68 unit tests pass. The earlier visibility follow-up review returned SHIP for the scored keyboard-focus fix on phone and desktop: all nine refreshed captures were valid with no visible regressions. The preceding full ads review matched on every other row. Earlier `.impeccable/review/landing-refresh/` evidence retains the discovery behavior checks: `mobile`, `narrow`, `phone-wide`, `tablet` and `desktop` captures, with `-full`, `-filters` and `-nepali` variants and `checks.json`. The checks cover 320/390/500/800/1440px layouts, no horizontal page overflow, category/purpose/flat/budget/furnishing/sort/reset/empty/map/ad behavior and disposable demo listings. The earlier landing revision passed normal-motion autoplay/pause QA and its production build. The Impeccable launcher/detector was unavailable because the engine was missing and the cache could not be used in the sandbox; this record does not claim a tool scan. The visual revision made no backend change or deployment. The November 1 ad-administration follow-up verified himavolt3569@gmail.com as an existing enabled, verified superAdmin and added only the versioned adSettings/public permission block to the current live rules. Twelve access checks passed. The exact deployed source was verified; public reads now reach the absent settings document (404 instead of permission-denied), ready for its first superadmin save. No account roles or production documents were changed. The broader backend candidate, functions and homepage UI deployment remain pending.

## Colors

The normative values are in the frontmatter, using the source stylesheet's hex notation.

### Primary

- **Royal Blue:** the royal family supplies blue links, navigation controls, prices, focus and map selection. The darkest royal tone supplies the homepage headline, selected transaction purpose and footer; pale royal tones supply hover and selected backgrounds.

### Secondary

- **Crimson:** primary buttons, save feedback, active navigation accents and warm section accents. Pale crimson backgrounds support selected navigation without using a filled primary button for every link.

### Tertiary

- **Emerald:** verified badges and approval states. This is a status role, not a second property-discovery identity.
- **Clay:** invalid fields, errors and destructive controls. Existing primitives also retain marigold highlight and ochre pending variants; preserve those existing status assignments when using them.

### Neutral

- **White:** page, form, card and carousel surfaces.
- **Ink:** darkest values anchor headings and important facts; medium values carry supporting text and form hints; pale values provide quiet backgrounds, borders and dividers.

Generic partner panels retain their scoped pale blue, green or cyan backgrounds and darker text/CTA colors in the stylesheet. The homepage partner cards use scoped blue, lavender and mint artwork/surfaces with blue, purple and green copy. HimaVolt uses the icy-blue background and dark-blue copy recorded for `landing-promo`, with the existing royal CTA, per the user's rejection of brown. Its fallback motif also uses scoped pale-blue and blue tones recorded in the sidecar. Lavender and mint retain their existing scoped values. Generated atmospheric imagery supports the requested premium, decent feel without replacing the MeroKotha identity or asserting unverified partner branding.

**The Established Identity Rule.** Keep Poppins, royal blue, crimson and white when extending the interface.

## Typography

**Display Font:** Poppins, with ui-sans-serif, system-ui and sans-serif fallbacks.

**Body Font:** the same Poppins stack; no separate display serif or monospace identity.

Poppins is self-hosted through `public/fonts/poppins.css`, linked by the active root layout. Local faces cover Devanagari, Latin and Latin Extended at weights 400, 500, 600 and 700, with `font-display: swap`. The compact homepage introduction and partner headings use the available 600 weight. Generic sponsor heading CSS still requests 650; no separate 650 face is shipped, so the browser matches it to the available faces.

### Hierarchy

- **Display:** the frontmatter display role remains an incumbent stylesheet value. The homepage uses a scoped compact navy headline instead: `clamp(1.75rem, 2.5vw, 2.25rem)`, weight 600, line height 1.25 and tracking -0.035em. Through 767px it becomes `clamp(1.375rem, 6vw, 1.75rem)` with -0.03em tracking. This local composition does not replace the shared type scale.
- **Headline:** reusable section headings use the responsive headline role. The wider existing display scale also remains defined in the source stylesheet.
- **Title:** card and panel headings use semibold or bold Poppins, with individual listing titles stepping from base size to large size at the small breakpoint.
- **Body:** the base body role supports longer text; compact forms and listing facts use body-small. Homepage supporting copy uses 0.875rem with line height 1.6, reducing to 0.75rem through 767px and 0.6875rem through 359px.
- **Label:** medium Poppins identifies controls. Existing badges use the smaller 2xs scale; generic advertisement disclosure is a distinct compact label (10px, weight 500, line height 1.6). The homepage section uses a semibold From our partners heading (1.0625rem, line height 1.5), reducing to 0.9375rem on phones, with a separate 10px Advertisement label. Partner brand names use 1rem semibold; ad titles are h3 elements using `clamp(1.125rem, 1.6vw, 1.375rem)` with line height 1.35, becoming 1.125rem with line height 1.3 on generated-art phone cards. Non-illustrated phone cards retain 1.25rem, reducing to 1.125rem through 359px. Uploaded-art captions use smaller brand/domain text (0.8125rem/0.625rem). Existing technical eyebrow treatments are not a reusable heading rule.

Prices, counts and dates use tabular figures where the component declares them. Preserve English/Nepali switching and the local font subsets.

## Layout

The shared maximum container is 90rem (1440px). Current homepage sections use 32px horizontal gutters, 24px through 900px, 16px through 767px and 14px through 359px. The reusable spacing values in frontmatter come from repeated padding and gap values; they do not introduce a new CSS spacing scale.

Discovery results use four equal columns at widths of at least 1200px, three from 901-1199px, two from 540-900px and one through 539px. The grid gap is 20px. A compact title and supporting line precede partner cards, all property categories, minimal filters, the results toolbar and listings. Saved searches/matches follow the listing grid in a collapsed disclosure. The wider-layout See my matches link opens it; that link is hidden on phones. These are current homepage composition choices, not requirements for every future screen.

The partner rail shows three equal cards above 900px, two through 900px and one card with a peek of the next through 767px. It uses native horizontal scroll snapping, contained inline overscroll and a hidden scrollbar; the page itself does not overflow horizontally. Built-in card minimum height is 224px; generated-art phone cards use 216px with 16px padding, while non-illustrated phone cards retain 196px. The visible section heading, destination and filled CTA give ads prominence. Custom SponsorCard campaigns retain their own content sizing. Categories use eight columns on desktop/tablet and a four-by-two grid through 767px, with all properties, houses, apartments, flats, rooms, offices, shops and land visible.

The minimal search combines All/Rent/Buy, location and the Filters toggle in a single bordered row on wider layouts. On phones, purpose sits above a location/toggle row with separate outlines. Advanced options start collapsed and expand inline into four field columns, two through 900px; phones retain paired minimum/maximum amounts and full-row furnishing/facility fields. Verified-only, nearby, reset and Show results follow. Applied advanced criteria wrap in removable chips. The toolbar keeps its result count, optional map toggle and sort on one responsive row; the count remains visible on phones. The map starts closed on every width and only interrupts the grid when opened.

The map is 390px tall on wider layouts and 310px through 767px. Its price markers synchronize with a three-column preview grid containing at most three complete cards. Through 767px, the grid has two columns and shows at most two cards. Cards put photo and summary side by side on desktop and stack them on phones; the selected map listing is placed first. The preview grid has no horizontal scrolling or scroll snapping.

Desktop navigation appears from 1024px. Below that, Browse navigation uses four equal columns for guests and five for signed-in users, including Post. Tools uses a compact icon-and-label trigger. On the homepage through 767px these links place their small icon beside the label with a 44px minimum height; other pages retain the stacked icon-circle composition. These controls fit the viewport without a scrolling rail; labels reduce from 11px to 10px through 359px. Header search expands inline from 1280px; smaller layouts use a search button and popover. Language controls use their compact treatment below 768px. The 900px, 767px and 359px discovery/navigation rules are local component adaptations, not replacements for the global breakpoint system.

## Elevation & Depth

Depth combines fine ink borders, white surfaces, tonal backgrounds and restrained shadows. The source's named shadow vocabulary is retained in the sidecar: hairline for minimal lift, soft for reusable surfaces, raised for stronger separation and floating for overlays. Generic campaign carousels retain a separate diffuse shadow; feed campaign rows remove it and use a border. The homepage illustrated partner cards have no outer shadow; its listing cards also remove the shared shadow and use a fine border. Map price labels have small local shadows to stay legible against map detail.

Buttons lift slightly on hover and scale down when pressed. Listing cards lift on hover and their image zooms gently. Focus is visible: the final global rule is a royal outline (2px) offset by 3px, while fields add a royal border and translucent ring. Component CSS may supply a more specific treatment.

## Shapes

The stylesheet defines six corner sizes from xs through 2xl, recorded in the frontmatter. Existing property cards use 2xl corners; the shared Surface uses xl corners. Buttons use lg corners, fields use md, and badges are pills. Newer campaign panels, map shells, disclosures and photo dialogs use md; generic campaign carousel shells and main property photography use lg. Homepage partner cards use lg corners, reducing locally to 14px on phones. The wider-layout minimal search uses 14px corners; its phone location and Filters controls use 10px. Homepage listing cards use lg corners while other listing surfaces retain their existing larger corners.

The discovery extension also contains local corner values for tabs (9px), map preview cards (10px) and popup photo strips (7px). Keep these as observed component details rather than replacing the existing radius scale. Image containers clip their corners; the main listing image uses `object-fit: contain` to show the complete property photo, while feed and map preview thumbnails crop with `object-fit: cover`.

## Components

### Buttons

The default primary button is crimson, medium-weight Poppins and 44px tall. Small is 36px, large is 48px and icon is 44px square. Primary and royal variants have filled backgrounds; secondary is a white bordered surface; ghost is transparent with an ink hover surface. Existing approval, marigold, destructive, link, inverse, light-outline and pill variants remain available for their established contexts.

Shared buttons transition for 200ms with the source exponential easing, lift on hover and scale to 95% on press. Disabled controls reduce opacity and stop pointer interaction. Preserve a visible focus treatment.

### Chips

Badges use compact uppercase semibold labels, a thin border and pill silhouette. Verified badges use emerald; neutral, pending, rejected, royal, solid, crimson and marigold variants are already defined. Homepage property categories are icon-and-label buttons with `aria-pressed`, a pale-royal selected surface and a short royal underline. Category controls have 12px corners and an 82px minimum height, reducing to 68px on phones. Applied advanced-filter chips use pale royal surfaces, a royal border, 8px corners and a 36px minimum height. Their text wraps within the viewport, and each exposes an individual removal action.

### Cards / Containers

Shared property cards use the larger existing corners, white surfaces, light borders and small shadows. The homepage scopes these cards to 16px corners with no shadow and a 3px hover lift; other surfaces retain their current card treatment. Their content padding grows from 16px to 20px at 640px. Card media is 160px high below 640px and 16:9 from 640px. The whole title links to the listing while save remains its own button.

Reusable Surface panels use white, a fine ink border and soft shadow. Their padding is assigned by each caller. Do not infer one universal padding from the component.

### Inputs / Fields

Text fields and selects are white, bordered, 48px tall and padded horizontally by 16px. Placeholder text and Field hints use ink-500. Hover shifts the border toward royal; keyboard focus adds a royal border and a translucent ring. Invalid fields use clay; disabled fields use a pale ink background and reduced opacity. Textareas share the same treatment with a 96px minimum height.

**The Dropdown Stability Rule.** Reserve scrollbar space with `html { scrollbar-gutter: stable; }`. While Radix adds `body[data-scroll-locked]`, lock the document viewport with `html:has(body[data-scroll-locked]) { overflow-y: hidden; }`, retain `overflow: clip !important` on the body and set its `margin-right: 0 !important` because the gutter already reserves that space. The body remains clipped without becoming a scroll container. Select menus and navigation dropdowns keep navbar position, page width and scroll position stable while open; Radix keyboard focus, selection and dismissal remain unchanged.

### Rental filters and results toolbar

The homepage exposes only All/Rent/Buy, a live location search and Filters initially. All is the default purpose. Selecting a flat forces Rent, clears the budget and removes Buy; purpose changes clear the budget. The Filters button exposes `aria-expanded`, the controlled inline panel and a count of applied advanced options.

The inline panel contains minimum/maximum amounts, furnishing, facility text, verified-only and nearby controls. It starts closed and is independent of map visibility. Values update listings live. Show results closes the panel and is disabled for an invalid range; Clear filters resets all criteria and is disabled when there is nothing to reset. If minimum exceeds maximum, the maximum field exposes `aria-invalid`, references the clay-colored error and the message uses `role="alert"`. Removable chips represent budget, furnishing, facility, verification and nearby criteria; purpose/category/location remain visible in their controls.

The compact results toolbar keeps a polite live result count, Map/Hide map with `aria-expanded` and an accessible sort menu. Sort offers recommended, newest and ascending/descending price. Nearby is inside advanced options; successful geolocation opens the map. The map is closed initially on every width.

### Navigation

The active shell has a sticky, translucent white header with backdrop blur and a subtle bottom border. Brand geometry and blue controls preserve the royal identity; the Home link uses pale crimson. Tools groups EMI and land-size actions in a dropdown. Property search sits after Messages and before language controls on the desktop header. The smaller Browse navigation uses an equal-column grid with compact labels: four columns for guests, five when Post is present for signed-in users. The compact Tools trigger follows the same icon/label composition and omits its desktop chevron. On the homepage through 767px, icons and labels share a compact horizontal row; through 359px labels reduce to 9px. Other pages retain their icon circles and stacked labels, reducing to 10px through 359px. The navigation requires no horizontal scrolling.

### Campaign carousel and administration

Advertisements retain explicit disclosure and a clear destination action. Current placements are the homepage partner rail below the compact introduction, full-width rows between listings and the property-description area. The administration placement selector still calls the first option Homepage banner; its stored `landing` placement and `heroEnabled` setting remain compatible with existing campaign data. The admin's Every placement maps to all three; device targeting is all, mobile or desktop. Full-row feed ads span every result column. Admin controls also cover schedule, ordering, rotation, images and enable/disable settings.

The homepage advertises a visible From our partners section with an Advertisement label above the cards. Built-in partner cards use three temporary generated WebPs: blue HimaVolt local discovery with a cafe/map/momo scene, lavender Pitambari botanical glass/leaves and a mint Floor Cleaner sunlit interior. No product packaging, logos or factual commercial claims are invented. All text remains editable HTML above the calm left side of the raster: 16px partner names, h3 headlines, actual destination hostnames and filled 40px Visit website actions. Generated art fills the card with cover cropping and a 60% horizontal image position; copy occupies 58% of the card. Exact source assets and prompts are recorded in `docs/ad-asset-origins.md` and `public/images/partners/generated-artwork.json`.

Client-uploaded art takes a different composition: show the whole image with `object-fit: contain` in a full-width 2.25-aspect image area, then a compact brand/domain/CTA caption without the generated-art headline overlay. Mobile uploaded artwork has priority on phones. Shared `adArtwork` resolution preserves explicit images and imageUrls order, supplies generated art when a known preset has no image, and replaces the legacy HimaVolt default. Feed/detail SponsorCard and administration previews use the same resolver; a generic custom campaign without art retains its text treatment. Current configured destinations are `https://himavolt.com/`, `https://pitambari.vercel.app/` and `https://floor-clearner.vercel.app/`; source configuration does not establish live reachability.

When editing a preset, generated and legacy defaults are omitted from upload slots, while the actual preset ID keeps fallback art visible in the preview. The first client upload therefore replaces temporary art rather than appending it as another slide. Copying a campaign preserves its existing art. Upload controls describe this replacement behavior, and only the protected superadmin role may save campaigns.

The native snap rail shows controls only when it can scroll. It exposes named partner buttons for up to four slides, dots for five to eight and a counter beyond eight, alongside previous/next and pause/play outside reduced motion. Selected choices use royal text and an underline. Previous/next and autoplay wrap at the actual scroll boundary, including tablet layouts with two cards visible. Auto-rotation follows the configured interval with a four-second minimum, pauses on hover/focus or a hidden document, and stops after pointer or manual navigation until Play is chosen. Reduced motion disables autoplay and uses instant manual scrolling. Slide labels expose position, the section identifies itself as a carousel, and links retain sponsored/noopener/noreferrer attributes.

Public advertising visibility is independent of a failed settings read once loading settles. Defaults apply until settings load; the last successful settings remain in force after later errors. Master, partner-preset and homepage off switches and paused partner overrides remain authoritative, while errors stay available to administration. This fallback remains useful for network or configuration failures. The November 1 ad-administration follow-up verified himavolt3569@gmail.com as an existing enabled, verified superAdmin and added only the versioned adSettings/public permission block to the current live rules. Twelve access checks passed. The exact deployed source was verified; public reads now reach the absent settings document (404 instead of permission-denied), ready for its first superadmin save. No account roles or production documents were changed. The broader backend candidate, functions and homepage UI deployment remain pending.

Other placements and the admin preview retain their generic compact treatment. Banner art is contained rather than cropped as a property thumbnail. Compact desktop panels put art beside copy. On phones, art stacks above a short disclosure/CTA row and redundant heading/body text is hidden when artwork is present. The admin Mobile preview explicitly applies that generic phone composition inside its 280px preview container, regardless of the desktop viewport. Text-only panels retain their copy. Generic carousels preserve their existing swipe, previous/next, pause/play, hidden-tab and reduced-motion behavior.

### Map, photo previews and listing gallery

White price markers become royal with white text when selected; the matching preview card gains a royal outline. The non-scrolling preview grid shows up to three complete cards on desktop and two on phones while preserving marker/card synchronization. Popup photography shows up to three thumbnails. The gallery displays a contained main photo and offers an explicit zoom action; its dark dialog preserves the full image and uses touch-sized toolbar controls.

### Motion

The homepage loads GSAP for one introduction-group entrance: the compact title/supporting-copy group rises from 10px, opacity 0.85 and blur 1px to its normal state over 0.65s with `expo.out`. It clears inline properties and reverts on unmount. The search and partner rail have no additional GSAP entrance. Fallback partner medallions, when present instead of artwork, rotate from -12 degrees to level on hover with a 400ms exponential transition; dots and category selection have short state transitions. These transitions are removed for reduced motion. The reduced-motion preference skips this entrance. Global reduced-motion CSS also suppresses animation and transitions and turns off smooth scrolling. The sidecar records exact reusable easing and observed motion values.

## Do's and Don'ts

### Do:

- **Do** preserve Poppins, royal blue, crimson and white when extending MeroKotha.
- **Do** keep advertisements labeled and preserve full-row feed placements; use the documented surface brief for the homepage sequence.
- **Do** preserve the larger existing card corners alongside the smaller campaign and map surfaces.
- **Do** retain visible focus, phone compositions, manual carousel controls and reduced-motion behavior.
- **Do** keep categories, discovery filters, Browse navigation and map previews within the viewport; keep homepage horizontal snapping inside the partner rail.
- **Do** use recorded project artwork, supplied assets or user-authorized generated artwork, and record raster origins and exact generation prompts in `docs/ad-asset-origins.md` and the asset manifest.

### Don't:

- **Don't** replace the established identity with a new font or palette.
- **Don't** disguise an advertisement as an ordinary property card.
- **Don't** crop client-uploaded banner artwork with property-thumbnail rules; generated atmospheric backgrounds use their documented cover composition.
- **Don't** invent listings, engagement counts, testimonials, partner claims or unverified partner branding.
- **Don't** use stale source comments as visual authority when the implemented styles differ.
