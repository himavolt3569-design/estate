'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { recordPresence, recordPropertyView } from '../actions';

const STORAGE_KEY = 'kitta.session';
/** Comfortably inside the two-minute window the server treats as online. */
const HEARTBEAT_MS = 45_000;

/**
 * A random per-tab token, not a fingerprint.
 *
 * sessionStorage rather than localStorage on purpose: presence should end when
 * the tab does, and a token that survives across sessions starts to look like
 * cross-visit tracking, which is not what this is for. The server salts and
 * hashes it before storing, so what is in the database is not what is here.
 */
function sessionToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const token = crypto.randomUUID().replace(/-/g, '');
    window.sessionStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    // Private mode with storage blocked. No token means no presence, which is
    // the correct outcome: it is not worth breaking a page over a statistic.
    return null;
  }
}

/**
 * Mounted once in the root layout. Reports which route this tab is on, and
 * registers a view when that route is a listing.
 */
export function PresenceTracker({ propertyId }: { propertyId?: string | null }) {
  const pathname = usePathname();
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    const token = sessionToken();
    if (!token) return;

    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      // The tab is in the background: it is open, not being read. Skipping the
      // beat lets it fall out of "online" naturally rather than inflating the
      // count with idle tabs.
      if (document.visibilityState !== 'visible') return;
      void recordPresence({ token, path: pathname, propertyId });
    };

    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [pathname, propertyId]);

  useEffect(() => {
    if (!propertyId) return;

    const token = sessionToken();
    if (!token) return;

    /*
     * Once per property per mount. The database dedupes properly — one row per
     * (property, viewer, day) — but there is no reason to spend a round trip
     * discovering that on every re-render, and React 18 mounts effects twice in
     * development.
     */
    if (viewedRef.current === propertyId) return;
    viewedRef.current = propertyId;

    void recordPropertyView({
      token,
      propertyId,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    });
  }, [propertyId]);

  return null;
}
