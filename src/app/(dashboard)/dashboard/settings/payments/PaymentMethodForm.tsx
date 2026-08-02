'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, Input, Surface, Textarea } from '@/components/ui/primitives';
import { deletePaymentMethod, savePaymentMethod } from '@/modules/identity/actions';
import { QrUploader } from '@/modules/identity/components/QrUploader';
import { paymentMethodSchema } from '@/modules/identity/schema';

type Values = z.infer<typeof paymentMethodSchema>;

export function PaymentMethodForm({ userId }: { userId: string }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      provider: 'esewa',
      accountName: '',
      accountNumber: '',
      bankName: '',
      branch: '',
      qrImagePath: '',
      instructions: '',
      isDefault: false,
    },
  });

  const provider = watch('provider');
  const isBank = provider === 'bank';
  const qrImagePath = watch('qrImagePath') ?? '';

  async function onSubmit(values: Values) {
    const result = await savePaymentMethod(values);

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof Values, { message: messages[0] });
        }
      }
      toast.error(result.error);
      return;
    }

    reset();
    toast.success('Payment details added.');
    router.refresh();
  }

  return (
    <Surface className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Provider" htmlFor="provider" required error={errors.provider?.message}>
          <select
            id="provider"
            className="h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm focus-visible:border-royal-500 focus-visible:outline-none"
            {...register('provider')}
          >
            <option value="esewa">eSewa</option>
            <option value="khalti">Khalti</option>
            <option value="imepay">IME Pay</option>
            <option value="connectips">connectIPS</option>
            <option value="bank">Bank transfer</option>
          </select>
        </Field>

        <Field
          label="Account holder name"
          htmlFor="accountName"
          required
          hint="As it appears on the account"
          error={errors.accountName?.message}
        >
          <Input id="accountName" {...register('accountName')} />
        </Field>

        <Field
          label={isBank ? 'Account number' : 'Registered mobile or ID'}
          htmlFor="accountNumber"
          required
          error={errors.accountNumber?.message}
        >
          <Input
            id="accountNumber"
            inputMode={isBank ? 'numeric' : 'tel'}
            autoComplete="off"
            {...register('accountNumber')}
          />
        </Field>

        {isBank && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name" htmlFor="bankName" required error={errors.bankName?.message}>
              <Input id="bankName" {...register('bankName')} />
            </Field>
            <Field label="Branch" htmlFor="branch" error={errors.branch?.message}>
              <Input id="branch" {...register('branch')} />
            </Field>
          </div>
        )}

        {/* Every provider, not only the wallets: a QR on a printed bank
            invoice is standard, and scanning beats typing an account number
            wherever it is offered. */}
        <input type="hidden" {...register('qrImagePath')} />
        <QrUploader
          userId={userId}
          value={qrImagePath}
          onChange={(path) => setValue('qrImagePath', path, { shouldDirty: true })}
        />

        <Field
          label="Notes for the buyer"
          htmlFor="instructions"
          hint="Optional"
          error={errors.instructions?.message}
        >
          <Textarea
            id="instructions"
            rows={3}
            placeholder="Please put the property reference code in the remarks."
            {...register('instructions')}
          />
        </Field>

        <label className="flex items-center gap-2.5 text-sm text-ink-600">
          <input
            type="checkbox"
            className="size-4 rounded-xs border-ink-300 text-royal-700"
            {...register('isDefault')}
          />
          Use this as my default account
        </label>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Add account'}
        </Button>
      </form>
    </Surface>
  );
}

export function DeletePaymentMethodButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deletePaymentMethod({ id });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success('Removed.');
          router.refresh();
        })
      }
    >
      {pending ? 'Removing…' : 'Remove'}
    </Button>
  );
}
