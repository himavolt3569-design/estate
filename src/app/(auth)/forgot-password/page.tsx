'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { requestPasswordReset } from '@/modules/identity/actions';
import { forgotPasswordSchema } from '@/modules/identity/schema';

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: Values) {
    await requestPasswordReset(values);
    // The action always reports success, whether or not the address exists.
    // Showing anything else here would rebuild the account oracle the action
    // deliberately avoids.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="flex size-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
          <MailCheck className="size-5 text-emerald-700" aria-hidden />
        </div>
        <h1 className="font-semibold text-3xl text-ink-900">Check your email</h1>
        <p className="text-sm leading-relaxed text-ink-600">
          If an account exists for{' '}
          <span className="font-medium text-ink-900">{getValues('email')}</span>, a reset link is on
          its way. The link is valid for one hour and can be used once.
        </p>
        <Button asChild variant="secondary">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-semibold text-3xl text-ink-900">Reset your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Enter the email address on your account and we will send you a link to set a new
          password.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Email address" htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-sm text-ink-600">
        Remembered it?{' '}
        <Link href="/login" className="text-royal-700 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
