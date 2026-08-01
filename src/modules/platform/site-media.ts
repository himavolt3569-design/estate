import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The images the master admin controls.
 *
 * There is no site_settings table, and adding one would mean the hero could not
 * be changed until a migration had been applied to the production database.
 * Storage already has everything needed: property-media is a public bucket, so
 * the newest object under `site/hero/` is the current hero and the URL is
 * public without a signed request.
 *
 * The filename carries the timestamp, so "newest" is a sort rather than a
 * lookup, and replacing the hero never has to delete the old one — the previous
 * images stay as a history the admin can roll back to.
 */

export const HERO_PREFIX = 'site/hero';
const BUCKET = 'property-media';

/** The current hero image, or null when the admin has not set one. */
export async function getHeroImageUrl(): Promise<string | null> {
  try {
    // Listing a bucket folder is not a user action and carries no user data, so
    // it uses the service role rather than threading a session through.
    const client = createAdminClient('reading the site hero image');

    const { data, error } = await client.storage.from(BUCKET).list(HERO_PREFIX, {
      limit: 1,
      sortBy: { column: 'name', order: 'desc' },
    });

    if (error || !data?.length) return null;

    const newest = data.find((file) => file.name !== '.emptyFolderPlaceholder');
    if (!newest) return null;

    const {
      data: { publicUrl },
    } = client.storage.from(BUCKET).getPublicUrl(`${HERO_PREFIX}/${newest.name}`);

    return publicUrl;
  } catch {
    // A missing service key or an unreachable bucket must not take the home
    // page down; the hero falls back to the image shipped with the build.
    return null;
  }
}

export type HeroImage = { name: string; url: string; createdAt: string | null };

/** Every hero image ever set, newest first, so one can be restored. */
export async function listHeroImages(): Promise<HeroImage[]> {
  try {
    const client = createAdminClient('listing the site hero images');

    const { data, error } = await client.storage.from(BUCKET).list(HERO_PREFIX, {
      limit: 40,
      sortBy: { column: 'name', order: 'desc' },
    });

    if (error || !data) return [];

    return data
      .filter((file) => file.name !== '.emptyFolderPlaceholder')
      .map((file) => ({
        name: file.name,
        url: client.storage.from(BUCKET).getPublicUrl(`${HERO_PREFIX}/${file.name}`).data.publicUrl,
        createdAt: file.created_at ?? null,
      }));
  } catch {
    return [];
  }
}
