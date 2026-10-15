'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input, Surface, Textarea } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { AvatarPicker } from '@/modules/identity/components/AvatarPicker';
import { updateProfile } from '@/modules/identity/actions';
import { profileSchema } from '@/modules/identity/schema';

type Values = z.infer<typeof profileSchema>;

export function ProfileForm({
  userId,
  email,
  defaults,
}: {
  userId: string;
  email: string;
  defaults: Values;
}) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  const avatarUrl = watch('avatarUrl');

  async function onSubmit(values: Values) {
    const result = await updateProfile(values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof Values, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    toast.success('Profile saved.');
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Surface className="space-y-5 p-6">
        {/* Registered so the value still travels with the form; the input
            itself is hidden because the picker owns it now. */}
        <input type="hidden" {...register('avatarUrl')} />
        <AvatarPicker
          userId={userId}
          value={avatarUrl || null}
          onChange={(url) => setValue('avatarUrl', url ?? '', { shouldDirty: true })}
        />
        {errors.avatarUrl?.message && (
          <p role="alert" className="text-xs text-clay-700">
            {errors.avatarUrl.message}
          </p>
        )}

        <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" {...register('fullName')} />
        </Field>

        <Field
          label="Email address"
          htmlFor="email"
          hint="Contact support to change this"
        >
          {/* Changing an email address moves account recovery to a new inbox, so
              it runs through a confirm-both-addresses flow rather than a text
              field on a settings page. */}
          <Input id="email" value={email} readOnly disabled />
        </Field>

        <Field
          label="Phone"
          htmlFor="phone"
          hint="Shown only when you enable it on a listing"
          error={errors.phone?.message}
        >
          <Input id="phone" type="tel" placeholder="+9779841234567" {...register('phone')} />
        </Field>

        <Field
          label="About you"
          htmlFor="bio"
          hint="Optional, shown on your listings"
          error={errors.bio?.message}
        >
          <Textarea id="bio" rows={4} {...register('bio')} />
        </Field>
      </Surface>

      <Surface className="space-y-5 p-6">
        <p className="label">Display preferences</p>

        <Field label="Language" htmlFor="preferredLocale">
          <SelectMenu
            id="preferredLocale"
            value={watch('preferredLocale')}
            onValueChange={(value) =>
              setValue('preferredLocale', value as Values['preferredLocale'], { shouldDirty: true })
            }
            options={[
              { value: 'en', label: 'English' },
              { value: 'ne', label: 'नेपाली' },
            ]}
          />
        </Field>

        <Field
          label="Land area unit"
          htmlFor="preferredAreaUnit"
          hint="How areas are shown to you"
        >
          {/* Nepal runs two systems side by side and both are in daily use:
              ropani in the hills and the valley, bigha in the terai. Neither is
              a sensible universal default, so it is a preference. */}
          <SelectMenu
            id="preferredAreaUnit"
            value={watch('preferredAreaUnit')}
            onValueChange={(value) =>
              setValue('preferredAreaUnit', value as Values['preferredAreaUnit'], {
                shouldDirty: true,
              })
            }
            options={[
              { value: 'ropani', label: 'Ropani, aana, paisa, daam', hint: 'Hills and the valley' },
              { value: 'bigha', label: 'Bigha, kattha, dhur', hint: 'Terai' },
              { value: 'sqft', label: 'Square feet' },
              { value: 'sqm', label: 'Square metres' },
            ]}
          />
        </Field>
      </Surface>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
        {!isDirty && <span className="text-xs text-ink-400">No unsaved changes</span>}
      </div>
    </form>
  );
}
