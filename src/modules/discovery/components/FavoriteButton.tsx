'use client';

import { Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { toggleFavorite } from '../favorites';

/**
 * Save a property.
 *
 * Two things this has to get right.
 *
 * A signed-out visitor must not be told "sign in to continue" after their tap
 * has apparently worked. The button resolves the session itself and sends them
 * to /login with a `next` back to the page they were reading, so saving is the
 * first thing that happens when they return.
 *
 * The optimistic flip is reverted on failure. A heart that stays filled after
 * the write was refused is worse than one that never filled: the buyer believes
 * the property is on their list and finds it missing later.
 */
export function FavoriteButton({
  propertyId,
  initialSaved = false,
  /** `overlay` sits on a card image; `inline` sits in a row of buttons. */
  variant = 'overlay',
  className,
}: {
  propertyId: string;
  initialSaved?: boolean;
  variant?: 'overlay' | 'inline';
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  /*
   * Resolved on the client because the listing page is ISR-cached for search
   * engines. When the server already knew (a card in the dashboard), it passes
   * initialSaved and this only decides which of the two failure paths a tap
   * takes.
   */
  useEffect(() => {
    let active = true;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setSignedIn(Boolean(data.user));
      });
    return () => {
      active = false;
    };
  }, []);

  function onClick(event: React.MouseEvent) {
    // The button is often inside a link to the listing.
    event.preventDefault();
    event.stopPropagation();

    if (signedIn === false) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    const next = !saved;
    setSaved(next);

    startTransition(async () => {
      const result = await toggleFavorite({ propertyId });

      if (!result.ok) {
        setSaved(!next);
        toast.error(result.error);
        return;
      }

      setSaved(result.data.saved);
      // The saved page and the card counters are server-rendered.
      router.refresh();
    });
  }

  const label = saved ? 'Remove from saved' : 'Save this property';

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={saved}
        className={cn(
          'inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60',
          saved
            ? 'border-crimson-200 bg-crimson-50 text-crimson-700'
            : 'border-ink-200 text-ink-700 hover:border-ink-300 hover:bg-ink-50',
          className,
        )}
      >
        <Heart aria-hidden className={cn('size-4', saved && 'fill-current')} />
        {saved ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        'absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-ink-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-crimson-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 disabled:opacity-60',
        saved && 'text-crimson-600',
        className,
      )}
    >
      <Heart aria-hidden className={cn('size-4.5', saved && 'fill-current')} />
    </button>
  );
}
