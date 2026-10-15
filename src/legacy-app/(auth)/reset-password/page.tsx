'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { completePasswordReset } from '@/modules/identity/actions';
import { resetPasswordSchema } from '@/modules/identity/schema';

type Values = z.infer<typeof resetPasswordSchema>;

/**
 * Reached only through the emailed recovery link, which /auth/callback exchanges
 * for a session before redirecting here. Without that session the action refuses,
 * so a bookmarked URL cannot be used to change someone's password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: Values) {
    const result = await completePasswordReset(values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof Values, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    toast.success('Password updated. Signing you in.');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-semibold text-3xl text-ink-900">Choose a new password</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Pick something at least 10 characters long. A short phrase you can remember beats a short
          string of symbols.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="New password" htmlFor="password" required error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              className="pr-11"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-ink-400 hover:text-ink-700"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
