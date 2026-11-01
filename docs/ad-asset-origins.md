# Partner ad asset origins

## Current generated artwork - November 1, 2026

The user requested three high-quality, decent temporary images based on the existing ad copy until the client uploads artwork, and explicitly rejected brown for HimaVolt. The built-in `image_gen.imagegen` tool generated the three raster illustrations below. They are atmospheric advertising art, not verified partner logos, actual products or photographs of specific commercial premises. No text, logos, packaging, price/offer claims or factual product claims were added to the images. The existing copy remains editable HTML.

| Public asset | Preset ID in `src/lib/ads.ts` | Dimensions | Bytes | Art direction |
| --- | --- | --- | --- | --- |
| `/images/partners/himavolt-generated-v1.webp` | `partner-himavolt` | 1672 x 941 px | 133544 | Blue local discovery: smartphone/map pin, cafe and momo. Calm icy-blue copy area; no brown HimaVolt treatment. |
| `/images/partners/pitambari-generated-v1.webp` | `partner-pitambari` | 1672 x 941 px | 102672 | Lavender botanical still life: glass forms, porcelain and leaves; no actual product or packaging implied. |
| `/images/partners/floor-cleaner-generated-v1.webp` | `partner-floor-cleaner` | 1672 x 941 px | 117088 | Mint sunlit interior with a clean tiled floor, sofa edge and greenery; no cleaning-performance claim. |

The three shipped WebPs total **353304 bytes**. They were compressed from the original generated 1672 x 941px PNGs; the originals remain review evidence under `.impeccable/review/generated-ad-artwork/{himavolt,pitambari,floor-cleaner}.png` and are not shipped. The exact, unabridged prompts, generator, date, dimensions and file sizes are recorded in [`public/images/partners/generated-artwork.json`](../public/images/partners/generated-artwork.json). Each WebP embeds its exact manifest prompt in XMP; those embedded prompts and the dimensions/byte sizes were verified directly from the shipped RIFF chunks. No new image edit was made during this documentation handoff.

SHA-256 of shipped files:

- `himavolt-generated-v1.webp`: `793035dbdafc7da4f8af2bae8712aebf599c4ed247927ca13ba81c5b5036924d`.
- `pitambari-generated-v1.webp`: `85268beab3e9545403aa9a0a93fa128d556bee353cc24d5c6e812b57940c4200`.
- `floor-cleaner-generated-v1.webp`: `0fc49822861a85e173506c7d8c01549a5ee60fbbf3cb2103786e5f7baf29d9b5`.

## Rendering and replacement

`partnerArtwork` maps each preset ID to its generated WebP. `adArtwork` preserves the order of client `imageUrls`, respects an explicit `imageUrl`, and supplies the generated fallback when preset art is missing or HimaVolt still references `/images/partners/himavolt.png`. Mobile uploads take priority on phones.

On the homepage, generated art fills the card behind editable brand/headline/domain/CTA copy with a calm left side, cover cropping and a 60% horizontal image position. Client-supplied artwork instead displays whole with `object-fit: contain` and a brand/domain/CTA caption. Feed/detail SponsorCard and admin previews use the same artwork resolver. Editing a preset excludes generated/legacy defaults from upload slots, so the first upload replaces temporary art rather than adding a default slide; Copy preserves current art. Protected superadmin controls, destinations, placement and pause switches remain authoritative.

## Current destination URLs

- HimaVolt: `https://himavolt.com/`. Earlier browser lookup verified the HimaVolt site; preserve the user-supplied destination.
- Pitambari: `https://pitambari.vercel.app/`.
- Floor Cleaner: `https://floor-clearner.vercel.app/`.

The latest user-supplied URLs supersede the October 30 values `https://pitambari-vercel.app/` and `https://floor-cleaner.vercel.app/`. Reachability of the two current Vercel URLs was not established in this environment. Generated visuals do not establish partner product identity or destination availability.

## Retained Android asset history

The October 30 review copied `/images/partners/himavolt.png` unchanged from `../merokotha/assets/himavolt.png` (846 x 336px). It contains HimaVolt's existing "Find Nearby. One Search One Tap." restaurant/hotel/delivery banner. The retained file is byte-identical to that source: SHA-256 `322215578A4912A335601891687A4A4DC07897A395EBC6369121665C5A2636D7`. It is now a legacy reference, not the current generated preset artwork.

Android's `../merokotha/assets/kitta.png` (837 x 337px) shows a house and "Find Your Dream Home" without identifying Pitambari, so it was not repurposed as Pitambari art. Android's old promo destination list also associated the HimaVolt banner with Floor Cleaner; that mismatched association was not copied. No verified Pitambari or Floor Cleaner logo/banner was available locally. The new generated images supply temporary atmospheres without inventing their branding or product claims. Flutter source remains unchanged.

## Existing property imagery

`/images/hero-bg.png` is the pre-existing project hero, retained unchanged from `../estate/public/images/hero-bg.png`. Both files are byte-identical (SHA-256 `3613149700b2356db79f38eebbfd34cf0390b54f7e5f9440730c0e42a42439f0`). It is used as test fixture imagery only in disposable emulator screenshots, not as evidence of actual listed properties. No new origin, licensing or photography claim is made for this inherited asset.

## Verification boundary

Current visual evidence is `.impeccable/review/generated-ad-artwork/`: five widths, three mobile slide states, Nepali and client-upload captures, plus `checks.json`. The 69 unit tests and production build pass; local browser checks cover loaded images, blue HimaVolt styling and superadmin replacement behavior. Final scoped artwork review returned SHIP with no material fixes. This artwork revision made no production rules or data changes. The separate November 1 ad-administration permission release remains documented in [its release record](ad-administration-release-2026-11-01.md).
