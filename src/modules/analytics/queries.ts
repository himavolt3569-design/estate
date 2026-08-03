import 'server-only';

import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { MIN_IMAGES } from '@/modules/listings/schema';

import type { LiveAnalytics } from './components/LiveVisitorsPanel';

/**
 * The numbers behind the dashboard.
 *
 * This file used to say there was no `owner_id = me` anywhere on purpose,
 * because RLS answers "whose rows are these". That holds for `property_views`,
 * whose only read policy is `owns_property(property_id) or is_admin()`. It does
 * NOT hold for `properties`, which additionally carries "public reads
 * published" so that search works — and RLS policies are permissive, so they
 * are OR'd. An unfiltered read of `properties` therefore returned every
 * published listing on the platform to every seller, and their portfolio counts
 * were the whole platform's.
 *
 * The rule is: scope explicitly on any table that is also publicly readable.
 *
 * Every window is fetched at twice its length and split in half, so "up 34 on
 * the fortnight before" costs the same one round trip as the bare figure.
 */

export type DayPoint = { date: string; value: number };

export type PortfolioAnalytics = {
  days: number;
  /** Daily views across the window, zero-filled. */
  views: DayPoint[];
  enquiries: DayPoint[];
  viewsThisPeriod: number;
  viewsLastPeriod: number;
  enquiriesThisPeriod: number;
  enquiriesLastPeriod: number;
  /** Lifetime, not windowed — these come off the properties table's counters. */
  totalViews: number;
  totalEnquiries: number;
  totalSaves: number;
  newEnquiries: number;
  counts: {
    total: number;
    published: number;
    pendingReview: number;
    draft: number;
    closed: number;
    rejected: number;
  };
  top: Array<{
    id: string;
    title: string;
    referenceCode: string;
    views: number;
    enquiries: number;
    status: string;
  }>;
  /** Drafts that cannot be sent for checking yet, with the reason. */
  needsAttention: Array<{ id: string; title: string; reason: string }>;
};

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `property_views.view_date` is a Postgres date defaulted from `current_date`,
 * which on Supabase is UTC. The buckets are therefore built in UTC too — an
 * offset of a few hours against Kathmandu time is worth far less than the
 * confusion of a chart whose totals do not match the table it came from.
 */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** The window's day keys, oldest first, today last. */
export function dayRange(days: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) keys.push(dayKey(shiftDays(from, -offset)));
  return keys;
}

/** Counts per day, zero-filled, so a quiet Tuesday draws a gap and not a jump. */
function bucket(keys: string[], dates: string[]): DayPoint[] {
  const counts = new Map<string, number>(keys.map((key) => [key, 0]));
  for (const date of dates) {
    const key = date.slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return keys.map((date) => ({ date, value: counts.get(date) ?? 0 }));
}

/* -------------------------------------------------------------------------- */
/* Portfolio                                                                   */
/* -------------------------------------------------------------------------- */

export async function getPortfolioAnalytics(days: number): Promise<PortfolioAnalytics> {
  const user = await getSessionUser();
  const supabase = await createClient();

  const now = new Date();
  const windowKeys = dayRange(days, now);
  const previousStart = dayKey(shiftDays(now, -(days * 2 - 1)));
  const previousStartIso = `${previousStart}T00:00:00.000Z`;

  const [properties, views, enquiries, images] = await Promise.all([
    // Explicitly the caller's own portfolio. The admin dashboard uses
    // getPlatformTotals()/getPlatformGrowth() for the platform-wide view.
    (() => {
      const query = supabase
        .from('properties')
        .select('id, title, reference_code, status, view_count, enquiry_count, favorite_count, created_at')
        .is('deleted_at', null);

      return (
        user && user.role !== 'platform_admin' ? query.eq('owner_id', user.id) : query
      ).order('created_at', { ascending: false });
    })(),
    supabase
      .from('property_views')
      .select('view_date')
      .gte('view_date', previousStart)
      .order('view_date'),
    supabase
      .from('enquiries')
      .select('created_at, status')
      .gte('created_at', previousStartIso),
    supabase.from('property_images').select('property_id'),
  ]);

  const rows = (properties.data ?? []) as Array<{
    id: string;
    title: string;
    reference_code: string;
    status: string;
    view_count: number | null;
    enquiry_count: number | null;
    favorite_count: number | null;
    created_at: string;
  }>;

  const viewDates = ((views.data ?? []) as Array<{ view_date: string }>).map((row) => row.view_date);
  const enquiryRows = (enquiries.data ?? []) as Array<{ created_at: string; status: string }>;

  const viewSeries = bucket(windowKeys, viewDates);
  const enquirySeries = bucket(
    windowKeys,
    enquiryRows.map((row) => row.created_at),
  );

  const inWindow = new Set(windowKeys);
  const viewsThisPeriod = viewSeries.reduce((sum, point) => sum + point.value, 0);
  const viewsLastPeriod = viewDates.filter((date) => !inWindow.has(date.slice(0, 10))).length;
  const enquiriesThisPeriod = enquirySeries.reduce((sum, point) => sum + point.value, 0);
  const enquiriesLastPeriod = enquiryRows.filter(
    (row) => !inWindow.has(row.created_at.slice(0, 10)),
  ).length;

  const photoCounts = new Map<string, number>();
  for (const image of (images.data ?? []) as Array<{ property_id: string }>) {
    photoCounts.set(image.property_id, (photoCounts.get(image.property_id) ?? 0) + 1);
  }

  const counted = (status: string) => rows.filter((row) => row.status === status).length;

  return {
    days,
    views: viewSeries,
    enquiries: enquirySeries,
    viewsThisPeriod,
    viewsLastPeriod,
    enquiriesThisPeriod,
    enquiriesLastPeriod,
    totalViews: rows.reduce((sum, row) => sum + (row.view_count ?? 0), 0),
    totalEnquiries: rows.reduce((sum, row) => sum + (row.enquiry_count ?? 0), 0),
    totalSaves: rows.reduce((sum, row) => sum + (row.favorite_count ?? 0), 0),
    newEnquiries: enquiryRows.filter((row) => row.status === 'new').length,
    counts: {
      total: rows.length,
      published: counted('published'),
      pendingReview: counted('pending_review'),
      draft: counted('draft'),
      closed: rows.filter((row) => row.status === 'sold' || row.status === 'rented').length,
      rejected: counted('rejected'),
    },
    top: rows
      .filter((row) => (row.view_count ?? 0) > 0 || (row.enquiry_count ?? 0) > 0)
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        title: row.title,
        referenceCode: row.reference_code,
        views: row.view_count ?? 0,
        enquiries: row.enquiry_count ?? 0,
        status: row.status,
      })),
    needsAttention: rows
      .filter((row) => row.status === 'draft' || row.status === 'rejected')
      .slice(0, 4)
      .map((row) => {
        const photos = photoCounts.get(row.id) ?? 0;
        const short = MIN_IMAGES - photos;
        return {
          id: row.id,
          title: row.title,
          reason:
            row.status === 'rejected'
              ? 'Sent back to you — open it to see what to change'
              : short > 0
                ? `Needs ${short} more ${short === 1 ? 'photo' : 'photos'} before it can be checked`
                : 'Ready to send for checking',
        };
      }),
  };
}

/* -------------------------------------------------------------------------- */
/* Platform (master admin)                                                     */
/* -------------------------------------------------------------------------- */

export type PlatformGrowth = {
  people: DayPoint[];
  listings: DayPoint[];
  peopleThisPeriod: number;
  peopleLastPeriod: number;
  listingsThisPeriod: number;
  listingsLastPeriod: number;
  totalPeople: number;
  sellers: number;
};

export async function getPlatformGrowth(days: number): Promise<PlatformGrowth> {
  const supabase = await createClient();

  const now = new Date();
  const windowKeys = dayRange(days, now);
  const previousStartIso = `${dayKey(shiftDays(now, -(days * 2 - 1)))}T00:00:00.000Z`;

  const [profiles, listings] = await Promise.all([
    supabase.from('profiles').select('created_at, role').is('deleted_at', null),
    supabase
      .from('properties')
      .select('created_at')
      .is('deleted_at', null)
      .gte('created_at', previousStartIso),
  ]);

  const people = (profiles.data ?? []) as Array<{ created_at: string; role: string }>;
  const listingRows = (listings.data ?? []) as Array<{ created_at: string }>;

  const inWindow = new Set(windowKeys);
  // Compared as instants, not as strings: Postgres renders timestamptz with a
  // "+00:00" offset and the cutoff is built with a "Z", so a lexical compare
  // would be right by luck rather than by rule.
  const cutoff = new Date(previousStartIso).getTime();
  const recentPeople = people.filter((row) => new Date(row.created_at).getTime() >= cutoff);

  return {
    people: bucket(
      windowKeys,
      recentPeople.map((row) => row.created_at),
    ),
    listings: bucket(
      windowKeys,
      listingRows.map((row) => row.created_at),
    ),
    peopleThisPeriod: recentPeople.filter((row) => inWindow.has(row.created_at.slice(0, 10))).length,
    peopleLastPeriod: recentPeople.filter((row) => !inWindow.has(row.created_at.slice(0, 10))).length,
    listingsThisPeriod: listingRows.filter((row) => inWindow.has(row.created_at.slice(0, 10))).length,
    listingsLastPeriod: listingRows.filter((row) => !inWindow.has(row.created_at.slice(0, 10))).length,
    totalPeople: people.length,
    sellers: people.filter((row) =>
      ['property_owner', 'agent', 'agency_manager'].includes(row.role),
    ).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Buyer                                                                       */
/* -------------------------------------------------------------------------- */

export type BuyerActivity = {
  savedCount: number;
  savedSearchCount: number;
  enquiriesSent: number;
  /** What the buyer has saved, grouped — "you are mostly looking at land". */
  byCategory: Array<{ label: string; value: number }>;
  recent: Array<{
    id: string;
    title: string;
    price: number;
    pricePeriod: string | null;
    slug: string;
    locationSlug: string | null;
    provinceSlug: string | null;
    savedAt: string;
  }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  residential: 'Places to live',
  land: 'Land',
  commercial: 'Business space',
};

export async function getBuyerActivity(): Promise<BuyerActivity> {
  const supabase = await createClient();

  const [favorites, searches, enquiries] = await Promise.all([
    supabase
      .from('favorites')
      /*
       * The province comes out of the district's ltree `path`, not out of a
       * second embed of `locations` on itself — PostgREST cannot resolve a
       * self-referencing relationship here ("Could not find a relationship
       * between 'locations' and 'locations'"), and the whole select fails with
       * it. This is the same shape /dashboard/saved uses.
       */
      .select(
        `
        created_at,
        property:properties!favorites_property_id_fkey (
          id, title, slug, price, price_period, category,
          location:locations!properties_location_id_fkey ( slug, path )
        )
      `,
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('saved_searches').select('id', { count: 'exact', head: true }),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }),
  ]);

  type FavoriteRow = {
    created_at: string;
    property: {
      id: string;
      title: string;
      slug: string;
      price: number;
      price_period: string | null;
      category: string;
      location: { slug: string; path: string } | null;
    } | null;
  };

  const rows = ((favorites.data ?? []) as unknown as FavoriteRow[]).filter((row) => row.property);

  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = CATEGORY_LABELS[row.property!.category] ?? row.property!.category;
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }

  return {
    savedCount: rows.length,
    savedSearchCount: searches.count ?? 0,
    enquiriesSent: enquiries.count ?? 0,
    byCategory: [...grouped.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    recent: rows.slice(0, 4).map((row) => ({
      id: row.property!.id,
      title: row.property!.title,
      price: row.property!.price,
      pricePeriod: row.property!.price_period,
      slug: row.property!.slug,
      locationSlug: row.property!.location?.slug ?? null,
      // nepal.bagmati.kathmandu — the second label is the province.
      provinceSlug: row.property!.location?.path?.split('.')[1] ?? null,
      savedAt: row.created_at,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Live presence (master admin)                                                */
/* -------------------------------------------------------------------------- */

/**
 * The first paint of the live panel.
 *
 * Rendered on the server so the control centre opens with real figures rather
 * than a spinner that resolves a beat later. The component then keeps itself
 * current over Realtime, and admin_live_analytics() re-checks is_admin() on
 * every call, here and there.
 */
export async function getLiveAnalytics(): Promise<LiveAnalytics | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_live_analytics');

  if (error) {
    console.error('[admin_live_analytics]', error.message);
    return null;
  }

  return data as unknown as LiveAnalytics;
}
