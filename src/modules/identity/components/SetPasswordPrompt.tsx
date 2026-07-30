'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { setInitialPassword } from '@/modules/identity/actions';
import { setInitialPasswordSchema } from '@/modules/identity/schema';

type Values = z.infer<typeof setInitialPasswordSchema>;

const DISMISS_KEY = 'kitta:password-prompt-dismissed';

/**
 * Offered once, after a first Google sign-in, to an account that has no
 * password.
 *
 * A Google-only account has exactly one way back in. If that Google account is
 * lost or the user simply prefers an email and password, they have no route.
 * Setting a password here is additive: Google keeps working afterwards, so this
 * adds an option rather than replacing one.
 *
 * It is skippable, and a skip is remembered locally so it does not nag on every
 * visit. The server, not this component, decides whether the account is
 * eligible, and refuses if a password already exists.
 */
export function SetPasswordPrompt() {
  const [open, setOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(setInitialPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  React.useEffect(() => {
    // Shown a beat after load so it does not race the dashboard painting.
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Move focus into the dialog when it opens, and close on Escape. Without
  // this, keyboard users land behind the overlay.
  React.useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  }

  async function onSubmit(values: Values) {
    const result = await setInitialPassword(values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof Values, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    localStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
    toast.success('Password set. You can now sign in with Google or your email.');
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-ink-900/45 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-password-title"
        className="ticked w-full max-w-md border border-ink-900 bg-white"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-royal-200 bg-royal-50 text-royal-700">
              <KeyRound aria-hidden className="size-4.5" />
            </span>
            <div>
              <p className="label">One more thing</p>
              <h2
                id="set-password-title"
                className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink-900"
              >
                Add a password
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="-mt-1 -mr-1 rounded-sm p-1.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-ink-600">
            You signed in with Google, so this account has no password yet. Adding one means you
            can sign in either way, and you are not locked out if you lose access to Google.
          </p>

          <Field
            label="New password"
            htmlFor="new-password"
            required
            hint="At least 10 characters"
            error={errors.password?.message}
          >
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-11"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm p-2 text-ink-400 hover:text-ink-900"
              >
                {showPassword ? (
                  <EyeOff aria-hidden className="size-4" />
                ) : (
                  <Eye aria-hidden className="size-4" />
                )}
              </button>
            </div>
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirm-password"
            required
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Set password'}
            </Button>
            <Button type="button" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
