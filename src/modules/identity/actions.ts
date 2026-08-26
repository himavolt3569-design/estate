'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { authedAction, type ActionResult } from '@/lib/auth/action';
import { consumeRateLimit, getClientIp, recordAuthEvent } from '@/lib/auth/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/utils';

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  paymentMethodSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  revokeSessionSchema,
  setInitialPasswordSchema,
} from './schema';


function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function signIn(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  }

  const { email, password, next } = parsed.data;
  const ip = await getClientIp();

  const allowed = await consumeRateLimit('login', `${ip}:${email}`, 5, '15 minutes');
  if (!allowed) {
    await recordAuthEvent('login_failed', { email, detail: { reason: 'rate_limited' } });
    return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordAuthEvent('login_failed', { email });
    return { ok: false, error: 'That email and password do not match.' };
  }

  await recordAuthEvent('login_success', { userId: data.user?.id, email });

  return { ok: true, data: { redirectTo: next && next.startsWith('/') ? next : '/dashboard' } };
}

export async function signUp(raw: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  }

  const { email, password, fullName, intent, phone } = parsed.data;
  const ip = await getClientIp();

  const allowed = await consumeRateLimit('signup', ip, 5, '1 hour');
  if (!allowed) {
    return { ok: false, error: 'Too many sign-ups from this connection. Try again later.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: absoluteUrl('/auth/callback?next=/dashboard'),
      data: { full_name: fullName, role: intent, phone: phone || null },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { ok: true, data: { email } };
    }
    if (error.message.toLowerCase().includes('password')) {
      return {
        ok: false,
        error: 'That password has appeared in a known breach. Choose a different one.',
        fieldErrors: { password: ['Choose a password that has not been breached'] },
      };
    }
    return { ok: false, error: 'Could not create the account. Try again.' };
  }

  return { ok: true, data: { email } };
}

export async function signInWithGoogle(next?: string): Promise<never | ActionResult<never>> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent(next ?? '/dashboard')}`),
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error || !data.url) {
    return { ok: false, error: 'Could not reach Google. Try again or use your email address.' };
  }

  redirect(data.url);
}

export async function requestPasswordReset(raw: unknown): Promise<ActionResult<null>> {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email address.', fieldErrors: fieldErrors(parsed.error) };
  }

  const { email } = parsed.data;

  const allowed = await consumeRateLimit('password_reset', email, 3, '1 hour');
  if (allowed) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: absoluteUrl('/auth/callback?next=/reset-password'),
    });
    await recordAuthEvent('password_reset_requested', { email });
  }

  return { ok: true, data: null };
}

export async function completePasswordReset(raw: unknown): Promise<ActionResult<null>> {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'That reset link has expired. Request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: 'Could not update the password. The link may have expired.' };
  }

  await recordAuthEvent('password_reset_completed', { userId: user.id });
  return { ok: true, data: null };
}

export async function setInitialPassword(raw: unknown): Promise<ActionResult<null>> {
  const parsed = setInitialPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Check the highlighted fields.',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Sign in again to set a password.' };
  }

  if (user.identities?.some((identity) => identity.provider === 'email')) {
    return {
      ok: false,
      error: 'This account already has a password. Change it from Settings → Security.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: 'Could not set the password. Try again.' };
  }

  await recordAuthEvent('password_reset_completed', { userId: user.id });
  revalidatePath('/dashboard', 'layout');
  return { ok: true, data: null };
}

export const chooseAccountType = authedAction({
  allowInactive: true,
  schema: z.object({ role: z.enum(['customer', 'property_owner']) }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('choose_account_type', { p_role: input.role });
    if (error) throw error;

    revalidatePath('/dashboard', 'layout');
    return null;
  },
});



export async function signOut(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await recordAuthEvent('logout', { userId: user?.id });
  await supabase.auth.signOut();
  redirect('/');
}

export const revokeSession = authedAction({
  schema: revokeSessionSchema,
  handler: async ({ input, supabase, user }) => {
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq('id', input.sessionId);

    if (error) throw error;

    await recordAuthEvent('session_revoked', { userId: user.id });
    revalidatePath('/dashboard/settings/security');
    return { revoked: true };
  },
});



export const updateProfile = authedAction({
  schema: profileSchema,
  handler: async ({ input, supabase, user }) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: input.fullName,
        phone: input.phone || null,
        bio: input.bio || null,
        preferred_locale: input.preferredLocale,
        preferred_area_unit: input.preferredAreaUnit,
        avatar_url: input.avatarUrl || null,
      })
      .eq('id', user.id);

    if (error) throw error;

    revalidatePath('/dashboard', 'layout');
    return { saved: true };
  },
});

export const changePassword = authedAction({
  schema: changePasswordSchema,
  handler: async ({ input, supabase, user }) => {
    if (!user.email) throw new Error('This account has no email address');

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
    });
    if (reauthError) {
      throw Object.assign(new Error('Your current password is not right.'), { code: '23514' });
    }

    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw error;

    return { changed: true };
  },
});



export const savePaymentMethod = authedAction({
  schema: paymentMethodSchema,
  permission: 'payment.manage',
  handler: async ({ input, supabase, user }) => {
    if (input.isDefault) {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('owner_id', user.id)
        .is('deleted_at', null);
    }

    const { error } = await supabase.from('payment_methods').insert({
      owner_id: user.id,
      provider: input.provider,
      account_name: input.accountName,
      account_number: input.accountNumber,
      bank_name: input.bankName || null,
      branch: input.branch || null,
      qr_image_path: input.qrImagePath || null,
      instructions: input.instructions || null,
      is_default: input.isDefault,
    });

    if (error) throw error;

    revalidatePath('/dashboard/settings/payments');
    return { saved: true };
  },
});

export const deletePaymentMethod = authedAction({
  schema: z.object({ id: z.string().uuid() }),
  permission: 'payment.manage',
  handler: async ({ input, supabase, user }) => {
    const { error } = await supabase
      .from('payment_methods')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', input.id)
      .eq('owner_id', user.id);

    if (error) throw error;

    revalidatePath('/dashboard/settings/payments');
    return { deleted: true };
  },
});
