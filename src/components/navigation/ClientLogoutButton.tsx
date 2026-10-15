'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { cn } from '@/lib/utils';
import { signOut } from '@/modules/identity/actions';

/** `full` gives it a proper 44px full-width target, for the phone's nav sheet. */
export function ClientLogoutButton({ label, full = false }: { label: string; full?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        // Optimistic instant redirect
        router.push('/');

        // Run the actual sign out action in the background
        startTransition(() => {
          signOut();
        });
      }}
      disabled={isPending}
      className={cn(
        'rounded-lg border border-ink-200 text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50',
        full ? 'flex h-11 w-full items-center justify-center text-sm font-medium' : 'px-3 py-1.5 text-xs',
      )}
    >
      {label}
    </button>
  );
}
