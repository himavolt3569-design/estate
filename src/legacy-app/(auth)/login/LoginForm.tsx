'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/i18n';
import { Field, Input } from '@/components/ui/primitives';
import { signIn } from '@/modules/identity/actions';
import { AuthDivider, GoogleButton } from '@/modules/identity/components/GoogleButton';
import { loginSchema } from '@/modules/identity/schema';

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({
  next,
  initialError,
  t,
}: {
  next?: string;
  initialError?: string;
  t: Dictionary['auth'];
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', next },
  });

  useEffect(() => {
    if (initialError) toast.error(initialError);
  }, [initialError]);

  async function onSubmit(values: LoginValues) {
    const result = await signIn(values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof LoginValues, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-semibold text-3xl text-ink-900">{t.signInTitle}</h1>
        <p className="mt-2 text-sm text-ink-600">
          {t.signInSubtitle}{' '}
          <Link
            href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-royal-700 underline underline-offset-4 hover:text-royal-800"
          >
            {t.createAccount}
          </Link>
        </p>
      </header>

      <GoogleButton next={next} label={t.googleSignIn} />
      <AuthDivider label={t.orUseEmail} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label={t.email} htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          label={t.password}
          htmlFor="password"
          required
          error={errors.password?.message}
          hint=""
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-11"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-ink-400 hover:text-ink-700"
              aria-label={showPassword ? t.hidePassword : t.showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-ink-500 underline-offset-4 hover:text-royal-700 hover:underline"
          >
            {t.forgotPassword}
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t.signingIn : t.signInButton}
        </Button>
      </form>

      <p className="text-2xs leading-relaxed text-ink-400">
        {t.signInNote}
      </p>
    </div>
  );
}
