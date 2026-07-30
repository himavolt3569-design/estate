import { Monitor, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, SectionHeading, Surface } from '@/components/ui/primitives';
import { getSessionUser } from '@/lib/auth/session';
import { formatRelative } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { ChangePasswordForm } from './ChangePasswordForm';
import { RevokeSessionButton } from './RevokeSessionButton';
import { TwoFactorPanel } from './TwoFactorPanel';

export const metadata: Metadata = { title: 'Security', robots: { index: false } };
export const dynamic = 'force-dynamic';

const EVENT_LABEL: Record<string, string> = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout: 'Signed out',
  password_reset_requested: 'Password reset requested',
  password_reset_completed: 'Password changed',
  mfa_enrolled: 'Two-factor turned on',
  mfa_verified: 'Two-factor code accepted',
  mfa_failed: 'Two-factor code rejected',
  mfa_recovery_used: 'Recovery code used',
  email_verified: 'Email confirmed',
  session_revoked: 'Session revoked',
};

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reason = Array.isArray(params['reason']) ? params['reason'][0] : params['reason'];

  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();

  // All three reads are RLS-scoped to the caller. There is no user_id filter in
  // this file, and there does not need to be.
  const [{ data: factors }, { data: sessions }, { data: events }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase
      .from('user_sessions')
      .select('id, device_label, user_agent, ip, city, country_code, created_at, last_seen_at, revoked_at')
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(10),
    supabase
      .from('auth_events')
      .select('id, event, ip, city, country_code, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const totp = factors?.totp?.find((f) => f.status === 'verified');

  return (
    <div className="max-w-3xl space-y-10 pb-10">
      <SectionHeading eyebrow="Your account" title="Security" />

      {reason === 'admin-requires-2fa' && (
        <div className="rounded-sm border border-ochre-100 bg-ochre-50 px-4 py-3 text-sm text-ochre-700">
          Admin tools need two-factor sign-in. Set it up below, then sign in again to continue.
        </div>
      )}

      {/* ---------------- Two-factor ---------------- */}
      <section>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-xl text-ink-900">Two-factor sign-in</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Asks for a 6-digit code from your phone as well as your password. Needed for the admin
              account.
            </p>
          </div>
          {totp ? <Badge tone="verified">On</Badge> : <Badge tone="pending">Off</Badge>}
        </div>

        <TwoFactorPanel
          enrolled={totp ? { id: totp.id, friendlyName: totp.friendly_name ?? 'Authenticator' } : null}
          canDisable={user.aal === 'aal2'}
        />
      </section>

      {/* ---------------- Password ---------------- */}
      <section>
        <h2 className="font-semibold text-xl text-ink-900">Password</h2>
        <p className="mt-1 mb-4 text-sm text-ink-600">
          We will ask for your current password first.
        </p>
        <ChangePasswordForm />
      </section>

      {/* ---------------- Sessions ---------------- */}
      <section>
        <h2 className="font-semibold text-xl text-ink-900">Active sessions</h2>
        <p className="mt-1 mb-4 text-sm text-ink-600">
          Phones and computers signed in to this account right now. Removing one signs it out straight away.
        </p>

        <Surface className="divide-y divide-ink-100">
          {(sessions ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">
              Only this device. Sessions from other devices will be listed here.
            </p>
          ) : (
            (sessions ?? []).map((session) => (
              <div key={session.id} className="flex items-center gap-4 px-5 py-4">
                <Monitor aria-hidden className="size-4 shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-900">
                    {session.device_label ?? session.user_agent?.slice(0, 60) ?? 'Unknown device'}
                  </p>
                  <p className="mt-0.5 nums text-2xs text-ink-400">
                    {[session.city, session.country_code, session.ip ? String(session.ip) : null]
                      .filter(Boolean)
                      .join(' · ')}
                    {session.last_seen_at ? ` · ${formatRelative(session.last_seen_at)}` : ''}
                  </p>
                </div>
                <RevokeSessionButton sessionId={session.id} />
              </div>
            ))
          )}
        </Surface>
      </section>

      {/* ---------------- Login history ---------------- */}
      <section>
        <h2 className="font-semibold text-xl text-ink-900">Recent activity</h2>
        <p className="mt-1 mb-4 text-sm text-ink-600">
          Every time somebody tried to sign in to this account, whether it worked or not. Nobody can
          change or delete this list, not even us.
        </p>

        <Surface>
          {(events ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Nothing recorded yet.</p>
          ) : (
            <ol className="divide-y divide-ink-100">
              {(events ?? []).map((event) => (
                <li key={event.id} className="flex items-baseline gap-4 px-5 py-3">
                  <time
                    dateTime={event.created_at}
                    className="nums w-28 shrink-0 text-2xs text-ink-400"
                  >
                    {formatRelative(event.created_at)}
                  </time>
                  <span
                    className={`text-sm ${
                      event.event.includes('failed') ? 'text-clay-700' : 'text-ink-700'
                    }`}
                  >
                    {EVENT_LABEL[event.event] ?? event.event}
                  </span>
                  <span className="ml-auto nums text-2xs text-ink-400">
                    {/* `inet` comes back as unknown from the generated types,
                        so it is coerced rather than rendered directly. */}
                    {[event.city, event.country_code].filter(Boolean).join(', ') ||
                      (event.ip ? String(event.ip) : '')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Surface>
      </section>

      <p className="flex items-start gap-2 text-2xs leading-relaxed text-ink-400">
        <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" />
        See something you do not recognise? Change your password and remove the devices you do not
        know. Both happen straight away.
      </p>
    </div>
  );
}
