'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { signOut, verifyMfa } from '@/modules/identity/actions';
import { mfaVerifySchema } from '@/modules/identity/schema';

type Values = z.infer<typeof mfaVerifySchema>;

export function VerifyForm({ factorId, next }: { factorId: string; next: string }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(mfaVerifySchema),
    defaultValues: { code: '', factorId, next },
  });

  async function onSubmit(values: Values) {
    const result = await verifyMfa(values);

    if (!result.ok) {
      setError('code', { message: result.error });
      toast.error(result.error);
      return;
    }

    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <input type="hidden" {...register('factorId')} />
        <input type="hidden" {...register('next')} />

        <Field label="6-digit code" htmlFor="code" required error={errors.code?.message}>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            aria-invalid={Boolean(errors.code)}
            className="nums text-center text-xl tracking-[0.4em]"
            {...register('code')}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Checking…' : 'Verify and continue'}
        </Button>
      </form>

      <p className="text-2xs leading-relaxed text-ink-400">
        Codes rotate every 30 seconds. After five wrong attempts this factor is locked for ten
        minutes.
      </p>

      <form action={signOut}>
        <button
          type="submit"
          className="text-xs text-ink-500 underline-offset-4 hover:text-royal-700 hover:underline"
        >
          Sign in as someone else
        </button>
      </form>
    </div>
  );
}
