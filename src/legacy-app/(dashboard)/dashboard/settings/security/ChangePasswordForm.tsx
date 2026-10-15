'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input, Surface } from '@/components/ui/primitives';
import { changePassword } from '@/modules/identity/actions';
import { changePasswordSchema } from '@/modules/identity/schema';

type Values = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: Values) {
    const result = await changePassword(values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof Values, { message: messages[0] });
        }
      }
      // The re-authentication failure surfaces here rather than as a toast, so
      // it lands next to the field it is about.
      if (result.error.toLowerCase().includes('current password')) {
        setError('currentPassword', { message: result.error });
      } else {
        toast.error(result.error);
      }
      return;
    }

    reset();
    toast.success('Password changed.');
  }

  return (
    <Surface className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-5">
        <Field
          label="Current password"
          htmlFor="currentPassword"
          required
          error={errors.currentPassword?.message}
        >
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="newPassword"
          required
          hint="At least 10 characters"
          error={errors.password?.message}
        >
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmNewPassword"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Change password'}
        </Button>
      </form>
    </Surface>
  );
}
