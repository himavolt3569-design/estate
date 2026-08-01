'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, Home, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/i18n';
import { Field, Input } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { signUp } from '@/modules/identity/actions';
import { AuthDivider, GoogleButton } from '@/modules/identity/components/GoogleButton';
import { registerSchema, type AccountIntent } from '@/modules/identity/schema';

type RegisterValues = z.infer<typeof registerSchema>;

/*
 * The account-type choice is the first real decision a new user makes, so it is
 * the first thing on the form rather than a dropdown buried at the bottom. It
 * decides which dashboard they land on and which permissions their role carries.
 *
 * Only these two are offered. Agent and agency-manager accounts need an agency
 * and are assigned by an admin. Note that restricting the UI is NOT the control:
 * tg_handle_new_user() in the database accepts only this same non-privileged
 * subset and silently downgrades anything else, because signup metadata travels
 * through the client and can be forged.
 */
const INTENTS: Array<{
  value: AccountIntent;
  title: string;
  body: string;
  icon: React.ReactNode;
  bullets: string[];
}> = [
  {
    value: 'customer',
    title: 'Buyer',
    body: 'I want to buy or rent a property.',
    icon: <Search className="size-5" aria-hidden />,
    bullets: ['Save the ones you like', 'Ask the seller directly', 'Ask to visit'],
  },
  {
    value: 'property_owner',
    title: 'Seller',
    body: 'I have a house, flat or land to sell or rent out.',
    icon: <Home className="size-5" aria-hidden />,
    bullets: ['Put your property up', 'Get calls from buyers', 'Add eSewa or Khalti'],
  },
];

export function RegisterForm({ next, t }: { next?: string; t: Dictionary['auth'] }) {
  const [showPassword, setShowPassword] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      intent: 'customer',
      phone: '',
      acceptTerms: false as never,
    },
  });

  const intent = watch('intent');
  const password = watch('password') ?? '';

  async function onSubmit(values: RegisterValues) {
    const result = await signUp(values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof RegisterValues, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    setSentTo(result.data.email);
  }

  if (sentTo) {
    return (
      <div className="space-y-5">
        <div className="flex size-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
          <Check className="size-5 text-emerald-700" aria-hidden />
        </div>
        <h1 className="font-semibold text-3xl text-ink-900">{t.checkEmailTitle}</h1>
        <p className="text-sm leading-relaxed text-ink-600">
          We sent a confirmation link to <span className="font-medium text-ink-900">{sentTo}</span>.
          Open it to activate your account. Until then you can browse, but not list or enquire.
        </p>
        <p className="text-xs text-ink-500">
          Nothing arrived? Check your spam folder, or{' '}
          <Link href="/login" className="text-royal-700 underline underline-offset-4">
            try signing in
          </Link>{' '}
          to resend it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-semibold text-3xl text-ink-900">{t.registerTitle}</h1>
        <p className="mt-2 text-sm text-ink-600">
          {t.registerSubtitle}{' '}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-royal-700 underline underline-offset-4 hover:text-royal-800"
          >
            {t.signInTitle}
          </Link>
        </p>
      </header>

      {/* Above the form, matching the sign-in page. It is the fastest route
          through this screen, so burying it under a nine-field form only means
          people fill the form out before discovering they did not have to. */}
      <GoogleButton next={next} label={t.googleSignUp} />
      <AuthDivider label={t.orUseEmail} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <fieldset>
          <legend className="label mb-2">What brings you here?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTENTS.map((option) => {
              const selected = intent === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'cursor-pointer rounded-sm border p-4 transition-colors',
                    selected
                      ? 'border-royal-700 bg-royal-50/50'
                      : 'border-ink-200 bg-white hover:border-ink-300',
                  )}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={selected}
                    onChange={() => setValue('intent', option.value, { shouldValidate: true })}
                    className="sr-only"
                    name="intent"
                  />
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-sm border',
                      selected
                        ? 'border-royal-200 bg-white text-royal-700'
                        : 'border-ink-200 bg-ink-50 text-ink-500',
                    )}
                  >
                    {option.icon}
                  </span>
                  <span className="mt-3 block text-sm font-medium text-ink-900">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-500">{option.body}</span>
                  <ul className="mt-3 space-y-1 border-t border-ink-200 pt-3">
                    {option.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-1.5 text-2xs text-ink-500">
                        <Check aria-hidden className="mt-px size-3 shrink-0 text-emerald-700" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-2xs text-ink-400">
            You can switch later, and agencies can request an agency account from Settings.
          </p>
        </fieldset>

        <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
        </Field>

        <Field label={t.email} htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          label="Phone"
          htmlFor="phone"
          hint={intent === 'property_owner' ? 'Buyers call you on this' : 'Optional'}
          error={errors.phone?.message}
        >
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+9779841234567"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          hint="At least 10 characters"
          error={errors.password?.message}
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-11"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-ink-400 hover:text-ink-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <PasswordMeter value={password} />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <div>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-600">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded-xs border-ink-300 text-royal-700 focus-visible:outline-royal-500"
              {...register('acceptTerms')}
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="text-royal-700 underline underline-offset-4">
                terms of use
              </Link>{' '}
              and the{' '}
              <Link href="/privacy" className="text-royal-700 underline underline-offset-4">
                privacy policy
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms && (
            <p role="alert" className="mt-1 text-xs text-clay-700">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t.creatingAccount : t.createAccountButton}
        </Button>
      </form>
    </div>
  );
}

/**
 * Length-based, not composition-based. Composition meters reward "Password1!"
 * and punish a long passphrase, which is backwards.
 */
function PasswordMeter({ value }: { value: string }) {
  if (!value) return null;

  const score = Math.min(4, Math.floor(value.length / 5) + (/[^a-zA-Z0-9]/.test(value) ? 1 : 0));
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-0.5 flex-1 rounded-full transition-colors',
              i < score ? (score >= 3 ? 'bg-emerald-700' : 'bg-ochre-600') : 'bg-ink-200',
            )}
          />
        ))}
      </div>
      <span className="text-2xs text-ink-400">{labels[score]}</span>
    </div>
  );
}
