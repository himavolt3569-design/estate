'use client';

import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/i18n';

/*
 * The search bar, with location as a first-class control rather than a filter
 * buried three screens in.
 *
 * Most people arriving here want one of two things: property near where they
 * are standing, or property in a place they can name. Both are on the same row.
 *
 * Geolocation is requested only on an explicit tap. Asking on page load trains
 * people to hit Block, and a blocked permission is very hard to recover.
 */
const RADIUS_DEFAULT_M = 5000;

export function LocationSearch({
  t,
  compact = false,
}: {
  t: Dictionary['hero'];
  compact?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<'idle' | 'locating' | 'denied' | 'unavailable'>(
    'idle',
  );

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }

    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          radius: String(RADIUS_DEFAULT_M),
          sort: 'distance',
        });
        router.push(`/search?${params}`);
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }

  return (
    <div className={compact ? '' : 'w-full'}>
      <form action="/search" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400"
          />
          <label htmlFor="loc-q" className="sr-only">
            {t.searchLabel}
          </label>
          <input
            id="loc-q"
            name="q"
            type="search"
            autoComplete="off"
            placeholder={t.searchPlaceholder}
            className="h-12 w-full rounded-sm border border-transparent bg-white pr-3 pl-10 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:border-emerald-400 focus-visible:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outlineLight"
            size="lg"
            onClick={useMyLocation}
            disabled={status === 'locating'}
            className="flex-1 sm:flex-none"
          >
            {status === 'locating' ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <MapPin aria-hidden />
            )}
            {status === 'locating' ? t.locating : t.nearMe}
          </Button>

          <Button type="submit" variant="inverse" size="lg" className="flex-1 px-7 sm:flex-none">
            {t.search}
          </Button>
        </div>
      </form>

      {/* The failure states say what to do next rather than only what broke. */}
      {status === 'denied' && (
        <p role="status" className="mt-2.5 text-xs text-royal-200">
          {t.locationBlocked}
        </p>
      )}
      {status === 'unavailable' && (
        <p role="status" className="mt-2.5 text-xs text-royal-200">
          {t.locationFailed}
        </p>
      )}
    </div>
  );
}
