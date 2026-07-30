'use client';

import { Activity, Building2, CreditCard, Flag, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/*
 * The live activity strip.
 *
 * Realtime here carries a SIGNAL, never a payload. An event says "a row in this
 * table changed"; the component records a one-line label from the event type
 * and calls router.refresh(), which re-runs the server queries through RLS.
 *
 * That is the whole reason this is safe: even if a broadcast reached a browser
 * it should not have, nothing sensitive travelled with it, and the refetch that
 * follows is still authorised in Postgres.
 *
 * The subscription is torn down on unmount. A websocket per admin tab that
 * nobody closes is how realtime becomes the platform's biggest bill.
 */

type Event = {
  id: string;
  kind: 'property' | 'report' | 'payment' | 'user';
  label: string;
  at: Date;
};

const META: Record<
  Event['kind'],
  { icon: React.ElementType; tone: string }
> = {
  property: { icon: Building2, tone: 'text-royal-700' },
  report: { icon: Flag, tone: 'text-clay-700' },
  payment: { icon: CreditCard, tone: 'text-ochre-600' },
  user: { icon: UserPlus, tone: 'text-emerald-700' },
};

const MAX_EVENTS = 8;

export function ActivityFeed() {
  const router = useRouter();
  const [events, setEvents] = React.useState<Event[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();

    // Coalesce bursts: a bulk import would otherwise fire one refresh per row.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        router.refresh();
      }, 1500);
    };

    const push = (kind: Event['kind'], label: string) => {
      setEvents((prev) =>
        [{ id: crypto.randomUUID(), kind, label, at: new Date() }, ...prev].slice(0, MAX_EVENTS),
      );
      scheduleRefresh();
    };

    const channel = supabase
      .channel('admin:activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'properties' },
        () => push('property', 'New listing submitted'),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'properties' },
        () => push('property', 'Listing updated'),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        () => push('report', 'New report filed'),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        () => push('payment', 'Payment proof uploaded'),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        () => push('user', 'New account registered'),
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      if (pending) clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <section className="border border-ink-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Activity aria-hidden className="size-3.5 text-ink-400" />
          <h2 className="label">Live activity</h2>
        </div>
        <span className="flex items-center gap-1.5 text-2xs text-ink-400">
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-ink-300',
            )}
          />
          {connected ? 'Connected' : 'Connecting…'}
        </span>
      </header>

      {events.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          Nothing yet. New listings, reports, payments and sign-ups appear here as they happen.
        </p>
      ) : (
        <ol aria-live="polite" className="divide-y divide-ink-100">
          {events.map((event) => {
            const { icon: Icon, tone } = META[event.kind];
            return (
              <li key={event.id} className="flex items-center gap-3 px-5 py-3">
                <Icon aria-hidden className={cn('size-3.5 shrink-0', tone)} />
                <span className="flex-1 text-sm text-ink-700">{event.label}</span>
                <time
                  dateTime={event.at.toISOString()}
                  className="nums shrink-0 text-2xs font-extralight text-ink-400"
                >
                  {event.at.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
