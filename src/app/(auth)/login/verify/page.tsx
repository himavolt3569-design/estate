import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { VerifyForm } from './VerifyForm';

export const metadata: Metadata = {
  title: 'Two-factor verification',
  robots: { index: false, follow: false },
};

/**
 * Step three of the sign-in flow: email → password → code → dashboard.
 *
 * Reaching this page means the session exists but is only aal1. Skipping it does
 * not get anyone anywhere: is_admin() requires aal2 in the database, and the
 * moderation triggers raise without it, so an aal1 token reads nothing
 * privileged even if the caller talks to the REST API directly.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params['next']) ? params['next'][0] : params['next'];
  const next = raw?.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.find((f) => f.status === 'verified');

  // Nothing to verify, so send them on rather than stranding them here.
  if (!totp) redirect(next);

  return (
    <div className="space-y-6">
      <div className="flex size-11 items-center justify-center rounded-full border border-royal-200 bg-royal-50">
        <ShieldCheck className="size-5 text-royal-700" aria-hidden />
      </div>

      <header>
        <h1 className="font-semibold text-3xl text-ink-900">Enter your code</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Open your authenticator app and enter the current 6-digit code for Kitta.
        </p>
      </header>

      <VerifyForm factorId={totp.id} next={next} />
    </div>
  );
}
