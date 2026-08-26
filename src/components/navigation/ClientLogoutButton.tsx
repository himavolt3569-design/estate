'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { signOut } from '@/modules/identity/actions';

export function ClientLogoutButton({ label }: { label: string }) {
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
      className="rounded-sm border border-ink-200 px-3 py-1.5 text-xs text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
