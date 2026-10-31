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
  campaign-banner:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
  rental-filters:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    padding: "24px"
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

This is a record of the implemented interface, preserving the established MeroKotha identity. Poppins, royal blue, crimson actions and white surfaces provide continuity across English and Nepali property discovery, account screens and administration. Property photography supplies the primary imagery; content and controls sit on light, bordered surfaces. The current homepage leads with a light search hero and contained desktop/tablet photography, followed by its own compact advertisement strip.

The interface combines rounded cards with compact form controls and visible selected states. Royal blue carries navigation, price emphasis and map selection; crimson identifies primary actions. The discovery extension uses smaller campaign and map corners alongside the larger existing card shapes. This coexistence is observed implementation, not a new universal radius rule. The current discovery filters wrap within the viewport. Browse navigation uses four equal guest columns or five signed-in columns; synchronized map previews show up to three complete cards on wider layouts and two on phones, without sideways scrolling.

**Key Characteristics:**

- Poppins for headings, text, labels and numbers.
- Royal blue structure and links, crimson primary actions, white surfaces and ink text.
- Property photographs, clearly disclosed partner panels and a synchronized map/photo preview grid.
- Rounded bordered surfaces, light shadows and touch-oriented controls.
- Responsive composition and motion that respects reduced-motion preferences.

This scan is grounded in `src/styles/globals.css`, the active `src/app` screens, `src/components/ui`, and `src/components/merokotha`. The durable identity comes from `PRODUCT.md`; page composition remains in `.impeccable/surfaces/rental-discovery.md`. The current homepage evidence is `.impeccable/review/hero-desktop.png`, `hero-tablet.png`, `hero-mobile.png` and `hero-narrow.png`; older full-page captures are not authoritative for this replacement. The subsequent filter revision is recorded in `.impeccable/review/filters-{desktop,tablet,mobile,narrow}.png`, `filters-preferences-*.png`, `filters-nepali-*.png`, `filters-full-*.png`, `filters-signed-in-narrow.png` and `filter-layout-checks.json`. Its fresh manual review returned SHIP for that bounded scope; the detector remained unavailable. The Impeccable launcher was unavailable in the sandbox/network environment; this document records source and current capture evidence and does not claim a launcher scan or an approved visual comp.

## Colors

The normative values are in the frontmatter, using the source stylesheet's hex notation.

### Primary

- **Royal Blue:** the royal family supplies blue links, navigation controls, prices, focus and map selection. The darkest royal tone supplies the homepage headline, selected hero categories and footer; pale royal tones supply hover and selected backgrounds.

### Secondary

- **Crimson:** primary buttons, save feedback, active navigation accents and warm section accents. Pale crimson backgrounds support selected navigation without using a filled primary button for every link.

### Tertiary

- **Emerald:** verified badges and approval states. This is a status role, not a second property-discovery identity.
- **Clay:** invalid fields, errors and destructive controls. Existing primitives also retain marigold highlight and ochre pending variants; preserve those existing status assignments when using them.

### Neutral

- **White:** page, form, card and carousel surfaces.
- **Ink:** darkest values anchor headings and important facts; medium values carry supporting text and form hints; pale values provide quiet backgrounds, borders and dividers.

Generic partner panels retain their scoped pale blue, green or cyan backgrounds and darker text/CTA colors in the stylesheet. The homepage banner overrides these with a neutral white surface, ink copy and a royal text CTA. Those scoped treatments do not replace the MeroKotha palette.

**The Established Identity Rule.** Keep Poppins, royal blue, crimson and white when extending the interface.

## Typography

**Display Font:** Poppins, with ui-sans-serif, system-ui and sans-serif fallbacks.

**Body Font:** the same Poppins stack; no separate display serif or monospace identity.

Poppins is self-hosted through `public/fonts/poppins.css`, linked by the active root layout. Local faces cover Devanagari, Latin and Latin Extended at weights 400, 500, 600 and 700, with `font-display: swap`. The current homepage hero and banner headings use the available 600 weight. Generic sponsor heading CSS still requests 650; no separate 650 face is shipped, so the browser matches it to the available faces.

### Hierarchy

- **Display:** the homepage hero uses the frontmatter display role and a navy headline on a pale ink background. Through 767px it becomes `clamp(2rem, 9vw, 2.5rem)` with a 16-character maximum line measure. Desktop maximum measure is 15 characters.
- **Headline:** reusable section headings use the responsive headline role. The wider existing display scale also remains defined in the source stylesheet.
- **Title:** card and panel headings use semibold or bold Poppins, with individual listing titles stepping from base size to large size at the small breakpoint.
- **Body:** the base body role supports longer text; compact forms and listing facts use body-small. Hero supporting copy has a 52-character maximum measure, size (0.9375rem) and line height (1.7); through 767px it remains visible at 0.875rem.
- **Label:** medium Poppins identifies controls. Existing badges and technical eyebrow labels use the smaller 2xs scale; generic advertisement disclosure is a distinct compact label (10px, weight 500, line height 1.6). The homepage banner uses 11px disclosure, reducing to 10px through 767px.

Prices, counts and dates use tabular figures where the component declares them. Preserve English/Nepali switching and the local font subsets.

## Layout

The shared maximum container is 90rem, matching the hero's 1440px maximum. Typical page gutters are 16px on phones, 24px from the small breakpoint and 32px at large desktop sizes. The reusable spacing values in frontmatter come from repeated padding and gap values; they do not introduce a new CSS spacing scale.

Discovery results use four equal columns at widths of at least 1200px, three from 901–1199px, two from 540–900px and one through 539px. The grid gap is 20px. The light discovery hero has a copy/photo introduction above the search form. Its introduction uses a 1.15:1 grid with a 64px gap, reducing to 32px through 1199px. The contained photo has 16px corners and a 280–340px height range; it is hidden through 767px, where the introduction becomes one column. The hero has no photographic wallpaper or scrim. Inner padding is 40px 32px 32px by default, 32px 24px through 900px and 28px 16px 24px through 767px.

The location/type/budget search sits inside the hero, directly below the introduction. It uses four proportional columns on desktop and two through 900px. On phones, the first field and submit control span the row. Hero categories use a two-by-two grid through 1000px with 44px minimum-height controls; all four expose their selected state through `aria-pressed`. The homepage advertisement is a separate strip below the hero, aligned to its container with a 24px top margin, reducing to 16px on phones. Saved-search/match content starts collapsed and uses a full-width disclosure panel. These are current discovery patterns, not requirements for every future screen.

The results filter panel has four desktop field columns in a 1.8:1.4:1:1 ratio and two equal columns through 1000px. Through 767px, location and property type each span the full row, with minimum and maximum prices paired below. Property preferences use three desktop columns, two through 1000px and one through 767px. The panel padding reduces from 24px to 16px on phones. Applied criteria wrap as individually removable chips. The map/nearby/sort toolbar places actions and sort alongside each other on larger layouts, then stacks them on phones with two equal map/nearby action columns. The result-count status is hidden through 767px. Category controls wrap instead of requiring sideways scrolling.

The map is 390px tall on wider layouts and 310px through 767px. Its price markers synchronize with a three-column preview grid containing at most three complete cards. Through 767px, the grid has two columns and shows at most two cards. Cards put photo and summary side by side on desktop and stack them on phones; the selected map listing is placed first. The preview grid has no horizontal scrolling or scroll snapping.

Desktop navigation appears from 1024px. Below that, Browse navigation uses four equal columns for guests and five for signed-in users, including Post. Tools uses a compact icon-and-label trigger. These controls fit the viewport without a scrolling rail; labels reduce from 11px to 10px through 359px. Header search expands inline from 1280px; smaller layouts use a search button and popover. Language controls use their compact treatment below 768px. The 1000px, 767px and 359px filter/navigation rules are local component adaptations, not replacements for the global breakpoint system.

## Elevation & Depth

Depth combines fine ink borders, white surfaces, tonal backgrounds and restrained shadows. The source's named shadow vocabulary is retained in the sidecar: hairline for minimal lift, soft for reusable surfaces, raised for stronger separation and floating for overlays. Generic campaign carousels retain a separate diffuse shadow; feed campaign rows remove it and use a border. The homepage banner also has no shadow and uses a thin ink border on white. Map price labels have small local shadows to stay legible against map detail.

Buttons lift slightly on hover and scale down when pressed. Listing cards lift on hover and their image zooms gently. Focus is visible: the final global rule is a royal outline (2px) offset by 3px, while fields add a royal border and translucent ring. Component CSS may supply a more specific treatment.

## Shapes

The stylesheet defines six corner sizes from xs through 2xl, recorded in the frontmatter. Existing property cards use 2xl corners; the shared Surface uses xl corners. Buttons use lg corners, fields use md, and badges are pills. Newer campaign panels, map shells, disclosures and photo dialogs use md; generic campaign carousel shells and main property photography use lg. The homepage banner shell uses md with square inner panel corners and xs corners around its contained artwork.

The discovery extension also contains local corner values for tabs (9px), map preview cards (10px) and popup photo strips (7px). Keep these as observed component details rather than replacing the existing radius scale. Image containers clip their corners; the main listing image uses `object-fit: contain` to show the complete property photo, while feed and map preview thumbnails crop with `object-fit: cover`.

## Components

### Buttons

The default primary button is crimson, medium-weight Poppins and 44px tall. Small is 36px, large is 48px and icon is 44px square. Primary and royal variants have filled backgrounds; secondary is a white bordered surface; ghost is transparent with an ink hover surface. Existing approval, marigold, destructive, link, inverse, light-outline and pill variants remain available for their established contexts.

Shared buttons transition for 200ms with the source exponential easing, lift on hover and scale to 95% on press. Disabled controls reduce opacity and stop pointer interaction. Preserve a visible focus treatment.

### Chips

Badges use compact uppercase semibold labels, a thin border and pill silhouette. Verified badges use emerald; neutral, pending, rejected, royal, solid, crimson and marigold variants are already defined. Discovery type controls are larger rounded tabs with separate pale-blue active states; hero tabs use bordered white surfaces at rest, a royal-950 fill with white text when selected, and a pale-royal hover on inactive options. All four hero categories have `aria-pressed` states; the responsive two-by-two layout keeps labels and 44px touch targets intact through 1000px. Applied filter chips use pale royal surfaces, a royal border, 8px corners and a 44px minimum height. Their text wraps within the viewport, and each chip exposes an individual removal action.

### Cards / Containers

Property cards use the larger existing corners, white surfaces, light borders and small shadows. Their content padding grows from 16px to 20px at 640px. Card media is 160px high below 640px and 16:9 from 640px. The whole title links to the listing while save remains its own button.

Reusable Surface panels use white, a fine ink border and soft shadow. Their padding is assigned by each caller. Do not infer one universal padding from the component.

### Inputs / Fields

Text fields and selects are white, bordered, 48px tall and padded horizontally by 16px. Placeholder text and Field hints use ink-500. Hover shifts the border toward royal; keyboard focus adds a royal border and a translucent ring. Invalid fields use clay; disabled fields use a pale ink background and reduced opacity. Textareas share the same treatment with a 96px minimum height.

### Rental filters and results toolbar

The results panel groups labeled live location, property-type, minimum and maximum budget fields with View all/Rent/Buy controls. Selecting a flat forces Rent and removes Buy; changing transaction purpose clears the budget. Filters update results as values change. Clear filters resets all criteria and is disabled when there is nothing to reset. If minimum exceeds maximum, the maximum field exposes `aria-invalid`, points to the clay-colored error and the message uses `role="alert"`.

Property preferences is a native details disclosure, available independently of map visibility. It contains furnishing, a facility text match and verified-only controls, with an optional selected-preference count. Location, type, budget and preferences appear as wrapping removable chips when applied. The white panel has a fine ink border and 12px corners; the purpose control has a pale ink container with 10px corners and 7px inner button corners. Its selected state is navy with white text.

The separate results toolbar groups Map filter, Nearby/Clear nearby and the labeled sort menu. Map uses an expanded state and Nearby uses a pressed state; active actions use the existing royal button variant. Sort offers recommended, newest and ascending/descending price. The result count is a polite status on larger layouts and is hidden on phones.

### Navigation

The active shell has a sticky, translucent white header with backdrop blur and a subtle bottom border. Brand geometry and blue controls preserve the royal identity; the Home link uses pale crimson. Tools groups EMI and land-size actions in a dropdown. Property search sits after Messages and before language controls on the desktop header. The smaller Browse navigation uses an equal-column grid with icon circles and compact labels: four columns for guests, five when Post is present for signed-in users. The compact Tools trigger follows the same icon/label composition and omits its desktop chevron. Labels may wrap and reduce to 10px through 359px; the navigation requires no horizontal scrolling.

### Campaign carousel and administration

Advertisements retain an explicit Advertisement disclosure and a clear destination action. Current placements are a separate homepage banner below the search hero, full-width rows between listings and the property-description area. The placement selector calls the first option Homepage banner; its stored `landing` placement and `heroEnabled` setting remain compatible with existing campaign data. The admin's Every placement value maps a campaign to all three; device targeting is all, mobile or desktop. Full-row feed ads span every result column. Admin controls also cover schedule, ordering, rotation, images and enable/disable settings.

The homepage alone uses the banner variant: a neutral white, 1px-bordered, 12px-cornered shell without shadow. Desktop artwork is 232px wide, contained at its natural 2.52 aspect ratio, followed by copy, a royal text CTA and side controls. Through 1000px, artwork becomes 180px, the subtitle hides and the CTA moves below the headline. Through 767px, artwork becomes 112px and remains beside the visible headline/CTA, while carousel controls move to a row below the panel. The banner supports a text-only branch when there is no artwork. Its arrow controls are at least 44px square.

Other placements and the admin preview retain their generic compact treatment. Banner art is contained rather than cropped as a property thumbnail. Compact desktop panels put art beside copy. On phones, art stacks above a short disclosure/CTA row and redundant heading/body text is hidden when artwork is present. The admin Mobile preview explicitly applies that generic phone composition inside its 280px preview container, regardless of the desktop viewport; it does not switch to the homepage-only banner variant. Text-only panels retain their copy.

Carousels expose previous/next controls, touch swipes and pause/play when auto-rotation applies. Hover and keyboard focus pause rotation; hidden tabs do not advance. Reduced motion disables automatic rotation and the slide-entry animation while leaving manual navigation available.

### Map, photo previews and listing gallery

White price markers become royal with white text when selected; the matching preview card gains a royal outline. The non-scrolling preview grid shows up to three complete cards on desktop and two on phones while preserving marker/card synchronization. Popup photography shows up to three thumbnails. The gallery displays a contained main photo and offers an explicit zoom action; its dark dialog preserves the full image and uses touch-sized toolbar controls.

### Motion

The homepage loads GSAP for one introduction-group entrance: the copy/photo group rises from 10px, opacity 0.85 and blur 1px to its normal state over 0.65s with `expo.out`. It clears inline properties and reverts on unmount. The search and separate campaign strip have no additional GSAP entrance, rotation or tilt. The reduced-motion preference skips this entrance. Global reduced-motion CSS also suppresses animation and transitions and turns off smooth scrolling. The sidecar records exact reusable easing and observed motion values.

## Do's and Don'ts

### Do:

- **Do** preserve Poppins, royal blue, crimson and white when extending MeroKotha.
- **Do** keep advertisements labeled, use the separate homepage strip and retain their full-row feed placement.
- **Do** preserve the larger existing card corners alongside the smaller campaign and map surfaces.
- **Do** retain visible focus, phone compositions, manual carousel controls and reduced-motion behavior.
- **Do** keep discovery filters, Browse navigation and map previews within the viewport using wrapping controls and complete-card grids.
- **Do** use verified local or supplied artwork and record raster origins in `docs/ad-asset-origins.md`.

### Don't:

- **Don't** replace the established identity with a new font or palette.
- **Don't** disguise an advertisement as an ordinary property card.
- **Don't** crop campaign banner artwork with property-thumbnail rules.
- **Don't** invent listings, engagement counts, testimonials, partner claims or unverified partner branding.
- **Don't** use stale source comments as visual authority when the implemented styles differ.
