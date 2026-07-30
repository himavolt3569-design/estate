import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Badge, EmptyState, SectionHeading, Surface } from '@/components/ui/primitives';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

import { DeletePaymentMethodButton, PaymentMethodForm } from './PaymentMethodForm';

export const metadata: Metadata = { title: 'Payment details', robots: { index: false } };
export const dynamic = 'force-dynamic';

const PROVIDER_LABEL: Record<string, string> = {
  esewa: 'eSewa',
  khalti: 'Khalti',
  imepay: 'IME Pay',
  connectips: 'connectIPS',
  bank: 'Bank transfer',
};

export default async function PaymentSettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!isVendor(user.role)) redirect('/dashboard/settings');

  const supabase = await createClient();

  // RLS restricts this to the caller's own rows. account_number is readable
  // here because the policy already narrowed to owner_id = auth.uid(); the
  // public path goes through get_payment_methods_public(), which additionally
  // requires the per-listing disclosure toggle.
  const { data: methods } = await supabase
    .from('payment_methods')
    .select('id, provider, account_name, account_number, bank_name, is_default, is_active')
    .is('deleted_at', null)
    .order('is_default', { ascending: false });

  return (
    <div className="max-w-2xl space-y-8 pb-10">
      <SectionHeading eyebrow="For buyers to pay you" title="Payment details" />

      <div className="rounded-sm border border-ink-200 bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-600">
        Kitta does not process payments and never holds your money. These details are shown to
        a buyer only on listings where you switch disclosure on, and only to signed-in users.
      </div>

      <section>
        <h2 className="mb-4 font-semibold text-xl text-ink-900">Your accounts</h2>

        {(methods ?? []).length === 0 ? (
          <EmptyState
            icon={<CreditCard className="size-6" />}
            title="No payment details yet"
            description="Add an eSewa, Khalti or bank account so buyers can send a booking deposit and upload the receipt for you to review."
          />
        ) : (
          <Surface className="divide-y divide-ink-100">
            {(methods ?? []).map((method) => (
              <div key={method.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink-900">
                      {PROVIDER_LABEL[method.provider] ?? method.provider}
                    </p>
                    {method.is_default && <Badge tone="royal">Default</Badge>}
                  </div>
                  <p className="mt-0.5 nums text-2xs text-ink-500">
                    {method.account_name} ·{' '}
                    {/* Masked in the list. The full number is one deliberate
                        action away, not sitting on screen behind you. */}
                    {method.account_number.replace(/.(?=.{4})/g, '•')}
                    {method.bank_name ? ` · ${method.bank_name}` : ''}
                  </p>
                </div>
                <DeletePaymentMethodButton id={method.id} />
              </div>
            ))}
          </Surface>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-semibold text-xl text-ink-900">Add an account</h2>
        <PaymentMethodForm />
      </section>
    </div>
  );
}
