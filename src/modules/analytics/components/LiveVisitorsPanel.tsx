'use client';

import { Activity, Eye, Loader2, Users, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatRelative } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export type LiveAnalytics = {
  onlineNow: number;
  signedInNow: number;
  viewingPropertyNow: number;
  viewsToday: number;
  uniqueVisitorsToday: number;
  viewsThisWeek: number;
  liveProperties: Array<{ id: string; title: string; slug: string; viewers: number }>;
  livePaths: Array<{ path: string; viewers: number }>;
  mostViewed: Array<{ id: string; title: string; slug: string; views: number }>;
  recentActivity: Array<{
    at: string;
    propertyId: string;
    title: string;
    viewer: string | null;
  }>;
};

type Status = 'connecting' | 'live' | 'offline';

/**
 * Who is on the site, right now.
 *
 * Every number here is counted from a row somebody's browser actually wrote.
 * Nothing is simulated, smoothed or seeded, so an empty platform reads as zero
 * rather than as a plausible-looking figure — which is the only way the number
 * is worth anything to the person reading it.
 *
 * Realtime carries the signal; the refetch carries the data, through
 * admin_live_analytics(), which re-checks is_admin() server-side. A row arriving
 * on the socket therefore cannot show an aggregate to somebody who is no longer
 * an admin.
 *
 * The slow poll underneath the socket is not redundancy for lost events: it is
 * what expires people. Going offline is the absence of a heartbeat, and an
 * absence never produces a database change to react to, so without the timer the
 * "online now" figure would only ever go up.
 */
export function LiveVisitorsPanel({ initial }: { initial: LiveAnalytics | null }) {
  const [data, setData] = useState<LiveAnalytics | null>(initial);
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { data: fresh, error: rpcError } = await supabase.rpc('admin_live_analytics');
      if (rpcError) {
        setError(true);
        return;
      }
      setError(false);
      setData(fresh as unknown as LiveAnalytics);
    } finally {
      inFlight.current = false;
    }
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_sessions' }, () => {
        void refetch();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'property_views' }, () => {
        void refetch();
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('offline');
        }
      });

    const timer = window.setInterval(() => void refetch(), 30_000);

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [refetch, supabase]);

  if (!data) {
    return (
      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading live figures…
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink-900">Right now</h2>
        <StatusPill status={status} error={error} />
      </div>

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Visitors online"
          value={data.onlineNow}
          note={`${data.signedInNow} signed in`}
          icon={Users}
          live
        />
        <Figure
          label="Viewing a property"
          value={data.viewingPropertyNow}
          note={`${data.liveProperties.length} listings open`}
          icon={Eye}
          live
        />
        <Figure label="Views today" value={data.viewsToday} note={`${data.viewsThisWeek} this week`} />
        <Figure
          label="Unique visitors today"
          value={data.uniqueVisitorsToday}
          note="Counted per browser session"
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Being viewed now">
          {data.liveProperties.length === 0 ? (
            <Empty>Nobody is on a listing at the moment.</Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.liveProperties.map((property) => (
                <li key={property.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
                    {property.title}
                  </span>
                  <span className="nums shrink-0 text-xs text-ink-500">
                    {property.viewers} {property.viewers === 1 ? 'person' : 'people'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Pages being visited">
          {data.livePaths.length === 0 ? (
            <Empty>No active sessions.</Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.livePaths.map((entry) => (
                <li key={entry.path} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="nums min-w-0 flex-1 truncate text-sm text-ink-700">
                    {entry.path}
                  </span>
                  <span className="nums shrink-0 text-xs text-ink-500">{entry.viewers}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Most viewed this week">
          {data.mostViewed.length === 0 ? (
            <Empty>No views recorded yet.</Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.mostViewed.map((property) => (
                <li key={property.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
                    {property.title}
                  </span>
                  <span className="nums shrink-0 text-xs font-medium text-ink-700">
                    {property.views}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity">
          {data.recentActivity.length === 0 ? (
            <Empty>Nothing yet today.</Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.recentActivity.map((entry, index) => (
                <li key={`${entry.propertyId}-${entry.at}-${index}`} className="px-4 py-2.5">
                  <p className="truncate text-sm text-ink-800">{entry.title}</p>
                  <p className="mt-0.5 text-2xs text-ink-400">
                    {/* An anonymous view stays anonymous: there is no
                        fingerprint stored that could name it. */}
                    {entry.viewer ?? 'Signed-out visitor'} · {formatRelative(entry.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-2xs text-ink-400">
        Visitors are counted from live sessions and drop off after two minutes without activity.
        Views are counted once per visitor per listing per day. No IP addresses are stored.
      </p>
    </section>
  );
}

function StatusPill({ status, error }: { status: Status; error: boolean }) {
  if (error) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-clay-700">
        <WifiOff aria-hidden className="size-3.5" />
        Figures could not be refreshed
      </span>
    );
  }

  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-700">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-emerald-600" />
        Updating live
      </span>
    );
  }

  if (status === 'connecting') {
    return <span className="text-xs text-ink-400">Connecting…</span>;
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-500">
      <WifiOff aria-hidden className="size-3.5" />
      Reconnecting. Figures refresh every 30 seconds.
    </span>
  );
}

function Figure({
  label,
  value,
  note,
  icon: Icon,
  live = false,
}: {
  label: string;
  value: number;
  note?: string;
  icon?: React.ElementType;
  live?: boolean;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="label flex items-center gap-1.5">
        {Icon && <Icon aria-hidden className="size-3.5 text-ink-400" />}
        {label}
      </dt>
      <dd
        className={cn(
          'nums mt-1 text-3xl font-semibold tracking-[-0.03em]',
          live && value > 0 ? 'text-emerald-700' : 'text-ink-900',
        )}
      >
        {value.toLocaleString('en-IN')}
      </dd>
      {note && <dd className="mt-0.5 text-2xs text-ink-400">{note}</dd>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
        <Activity aria-hidden className="size-3.5 text-ink-400" />
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-ink-500">{children}</p>;
}
