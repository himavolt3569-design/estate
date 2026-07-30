'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from './config';

/**
 * Switches the language.
 *
 * The cookie is the source of truth for rendering, because it works for signed
 * out visitors too. For signed-in users the choice is also written to their
 * profile, so it follows them to another device. That write goes through RLS
 * like everything else: the policy scopes it to auth.uid(), so no user id is
 * passed from here.
 */
export async function setLocale(next: unknown): Promise<void> {
  if (!isLocale(next)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    // Readable by the server only. Nothing in the browser needs it, and a
    // preference cookie should not widen the script-accessible surface.
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from('profiles').update({ preferred_locale: next }).eq('id', user.id);
  }

  revalidatePath('/', 'layout');
}
