'use client';

import { Check, Home, Search } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { chooseAccountType } from '@/modules/identity/actions';

/**
 * Asked once, after a first Google sign-in.
 *
 * Google sends no signup metadata, so an OAuth account is created as a customer
 * by default. Someone who signed in with Google intending to sell their house
 * would otherwise find no way to list one, with nothing on screen explaining
 * why. This asks the question the email signup form asks.
 *
 * Not dismissable, because the answer decides what the rest of the dashboard
 * shows and "ask me later" leaves the account in the wrong shape indefinitely.
 * Both options are equally weighted: this is a question, not an upsell.
 */
const OPTIONS = [
  {
    value: 'customer' as const,
    icon: Search,
    title: "I'm looking for a property",
    body: 'Search, save and contact sellers.',
    bullets: ['Save searches', 'Ask about listings', 'Request a viewing'],
  },
  {
    value: 'property_owner' as const,
    icon: Home,
    title: 'I want to sell or rent out',
    body: 'Put a house, flat or plot on the market.',
    bullets: ['Post your property', 'Get enquiries', 'Add eSewa / Khalti details'],
  },
];

export function AccountTypePrompt() {
  const [choice, setChoice] = React.useState<'customer' | 'property_owner'>('customer');
  const [pending, startTransition] = React.useTransition();

  function submit() {
    startTransition(async () => {
      const result = await chooseAccountType({ role: choice });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        choice === 'property_owner'
          ? 'You can now post properties.'
          : 'All set. Start searching.',
      );
    });
  }

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-ink-900/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-type-title"
        className="ticked w-full max-w-lg border border-ink-900 bg-white"
      >
        <div className="border-b border-ink-200 px-6 py-5">
          <p className="label">One quick question</p>
          <h2
            id="account-type-title"
            className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink-900"
          >
            What brings you here?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            You signed in with Google, so we did not get a chance to ask. You can change this
            later in Settings.
          </p>
        </div>

        <div className="space-y-3 px-6 py-6">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Account type</legend>
            {OPTIONS.map((option) => {
              const selected = choice === option.value;
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
                    name="account-type"
                    value={option.value}
                    checked={selected}
                    onChange={() => setChoice(option.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-sm border',
                      selected
                        ? 'border-royal-200 bg-white text-royal-700'
                        : 'border-ink-200 bg-ink-50 text-ink-500',
                    )}
                  >
                    <option.icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="mt-3 block text-sm font-medium text-ink-900">
                    {option.title}
                  </span>
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
          </fieldset>

          <Button type="button" className="w-full" disabled={pending} onClick={submit}>
            {pending ? 'Saving…' : 'Continue'}
          </Button>

          <p className="text-2xs leading-relaxed text-ink-400">
            Working as an agent or an agency? Pick either for now and ask us from Settings, since
            those accounts are set up by our team.
          </p>
        </div>
      </div>
    </div>
  );
}
