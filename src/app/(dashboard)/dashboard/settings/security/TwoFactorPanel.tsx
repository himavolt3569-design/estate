'use client';

import { Copy, ShieldCheck } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Surface } from '@/components/ui/primitives';
import { confirmMfaEnrollment, disableMfa, startMfaEnrollment } from '@/modules/identity/actions';

type Enrolment = { factorId: string; qrCode: string; secret: string; uri: string };

/**
 * TOTP enrolment. We never implement the TOTP algorithm ourselves. Supabase
 * Auth issues the secret, generates the QR, and verifies the code. Hand-rolling
 * HMAC and time-window logic is how people ship 2FA bypasses.
 */
export function TwoFactorPanel({
  enrolled,
  canDisable,
}: {
  enrolled: { id: string; friendlyName: string } | null;
  canDisable: boolean;
}) {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function begin() {
    startTransition(async () => {
      const result = await startMfaEnrollment({});
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEnrolment(result.data);
    });
  }

  function confirm() {
    if (!enrolment) return;
    setError(null);

    startTransition(async () => {
      const result = await confirmMfaEnrollment({ factorId: enrolment.factorId, code });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEnrolment(null);
      setCode('');
      toast.success('Two-factor sign-in is on. Sign in again to activate it fully.');
    });
  }

  function turnOff() {
    if (!enrolled) return;
    startTransition(async () => {
      const result = await disableMfa({ factorId: enrolled.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Two-factor sign-in turned off.');
    });
  }

  if (enrolled) {
    return (
      <Surface className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-medium text-ink-900">{enrolled.friendlyName}</p>
            <p className="mt-0.5 text-sm text-ink-600">
              You will be asked for a code each time you sign in.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="destructive" size="sm" onClick={turnOff} disabled={pending || !canDisable}>
            {pending ? 'Working…' : 'Turn off'}
          </Button>
          {!canDisable && (
            // Turning off a factor is exactly when you want proof it is the
            // account holder, so the action itself requires aal2.
            <span className="text-2xs text-ink-400">Enter a code first to change this</span>
          )}
        </div>
      </Surface>
    );
  }

  if (!enrolment) {
    return (
      <Surface className="flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="max-w-md text-sm text-ink-600">
          You will need an authenticator app such as Google Authenticator, Aegis or 1Password.
        </p>
        <Button onClick={begin} disabled={pending}>
          {pending ? 'Preparing…' : 'Set up 2FA'}
        </Button>
      </Surface>
    );
  }

  return (
    <Surface className="space-y-5 p-6">
      <ol className="space-y-5">
        <li>
          <p className="text-sm font-medium text-ink-900">1. Scan this code</p>
          <div className="mt-3 flex flex-wrap items-start gap-5">
            {/* Supabase returns the QR as an SVG data URI; img-src allows data: */}
            <img
              src={enrolment.qrCode}
              alt="QR code for two-factor setup"
              width={168}
              height={168}
              className="rounded-sm border border-ink-200 bg-white p-2"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-500">Cannot scan? Enter this key by hand:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 nums text-xs text-ink-700">
                  {enrolment.secret}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Copy setup key"
                  onClick={() => {
                    void navigator.clipboard.writeText(enrolment.secret);
                    toast.success('Setup key copied.');
                  }}
                >
                  <Copy />
                </Button>
              </div>
            </div>
          </div>
        </li>

        <li>
          <p className="text-sm font-medium text-ink-900">2. Enter the code it shows</p>
          <div className="mt-3 max-w-xs">
            <Field label="6-digit code" htmlFor="mfa-code" error={error ?? undefined}>
              <Input
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                aria-invalid={Boolean(error)}
                className="nums text-center text-lg tracking-[0.4em]"
              />
            </Field>
          </div>
        </li>
      </ol>

      <div className="flex gap-2 border-t border-ink-200 pt-5">
        <Button onClick={confirm} disabled={pending || code.length !== 6}>
          {pending ? 'Checking…' : 'Confirm and turn on'}
        </Button>
        <Button variant="ghost" onClick={() => setEnrolment(null)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Surface>
  );
}
