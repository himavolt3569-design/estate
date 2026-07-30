'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input, Surface, Textarea } from '@/components/ui/primitives';
import { updateProfile } from '@/modules/identity/actions';
import { profileSchema } from '@/modules/identity/schema';

type Values = z.infer<typeof profileSchema>;

export function ProfileForm({
  email,
  defaults,
}: {
  email: string;
  defaults: Values;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

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
        <Field label="Avatar URL" htmlFor="avatarUrl" error={errors.avatarUrl?.message}>
          <Input id="avatarUrl" type="url" placeholder="https://example.com/avatar.png" {...register('avatarUrl')} />
        </Field>

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
          <select
            id="preferredLocale"
            className="h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm focus-visible:border-royal-500 focus-visible:outline-none"
            {...register('preferredLocale')}
          >
            <option value="en">English</option>
            <option value="ne">नेपाली</option>
          </select>
        </Field>

        <Field
          label="Land area unit"
          htmlFor="preferredAreaUnit"
          hint="How areas are shown to you"
        >
          {/* Nepal runs two systems side by side and both are in daily use:
              ropani in the hills and the valley, bigha in the terai. Neither is
              a sensible universal default, so it is a preference. */}
          <select
            id="preferredAreaUnit"
            className="h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm focus-visible:border-royal-500 focus-visible:outline-none"
            {...register('preferredAreaUnit')}
          >
            <option value="ropani">Ropani / aana / paisa / daam (hills, valley)</option>
            <option value="bigha">Bigha / kattha / dhur (terai)</option>
            <option value="sqft">Square feet</option>
            <option value="sqm">Square metres</option>
          </select>
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
