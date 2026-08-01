'use server';

import { revalidatePath } from 'next/cache';

import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/auth/action';

import { HERO_PREFIX } from './site-media';

const BUCKET = 'property-media';
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
/** storage.buckets caps property-media at 5 MB. */
const MAX_BYTES = 5 * 1024 * 1024;

async function requireMasterAdmin() {
  const user = await getSessionUser();
  if (!user) throw new Error('Sign in to continue.');
  if (user.role !== 'platform_admin') throw new Error('Only the master admin can do this.');
  if (user.status !== 'active') throw new Error('This account is not active.');
  return user;
}

/**
 * Replaces the picture behind the words on the home page.
 *
 * The file arrives as multipart form data rather than a base64 string in a JSON
 * body, which keeps a 4 MB photo at 4 MB instead of inflating it by a third.
 * The name is generated here, never taken from the upload, so a crafted
 * filename cannot escape the folder the hero lives in.
 */
export async function setHeroImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  let actorId: string;
  try {
    actorId = (await requireMasterAdmin()).id;
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image first.' };
  }
  if (!ACCEPTED.includes(file.type)) {
    return { ok: false, error: 'Use a JPG, PNG or WEBP image.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'That image is over 5 MB. Use a smaller one.' };
  }

  const client = createAdminClient('master admin setting the site hero image');
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';

  // Sorted by name descending to find the current hero, so the timestamp has to
  // be fixed width and lexically ordered. Milliseconds since the epoch, padded.
  const name = `${String(Date.now()).padStart(16, '0')}.${extension}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(`${HERO_PREFIX}/${name}`, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: `Could not upload that image. ${error.message}` };

  await client.from('audit_logs').insert({
    actor_id: actorId,
    action: 'update',
    entity_type: 'site.hero_image',
    summary: 'master admin changed the home page background',
    new_value: { file: name },
  } as never);

  revalidatePath('/', 'page');
  revalidatePath('/dashboard/admin/site');

  const {
    data: { publicUrl },
  } = client.storage.from(BUCKET).getPublicUrl(`${HERO_PREFIX}/${name}`);

  return { ok: true, data: { url: publicUrl } };
}

/** Puts an earlier hero back by re-uploading it under a fresh timestamp. */
export async function restoreHeroImage(name: string): Promise<ActionResult<null>> {
  try {
    await requireMasterAdmin();
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  if (!/^\d{16}\.(jpg|png|webp)$/.test(name)) {
    return { ok: false, error: 'That is not a hero image.' };
  }

  const client = createAdminClient('master admin restoring a previous hero image');
  const extension = name.split('.').pop();
  const target = `${HERO_PREFIX}/${String(Date.now()).padStart(16, '0')}.${extension}`;

  const { error } = await client.storage.from(BUCKET).copy(`${HERO_PREFIX}/${name}`, target);
  if (error) return { ok: false, error: 'Could not restore that image.' };

  revalidatePath('/', 'page');
  revalidatePath('/dashboard/admin/site');
  return { ok: true, data: null };
}
