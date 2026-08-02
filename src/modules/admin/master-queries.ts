import 'server-only';

import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import type { Person } from './components/PersonSheet';

/**
 * Reads that only the master admin may perform.
 *
 * Most admin reads belong in queries.ts, which uses the RLS-bound client and
 * lets the is_admin() predicate in the policies decide. These are the ones that
 * cannot work that way: email addresses live in auth.users, a schema PostgREST
 * does not expose at all, so there is no policy that could return them.
 *
 * Each function resolves the caller from the session first and returns empty
 * for anybody else, so a mistaken import into a non-admin page leaks nothing.
 */

async function isMasterAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return user?.role === 'platform_admin' && user.status === 'active';
}

/**
 * Every account, with the sign-in address attached.
 *
 * Two sources, joined in memory: profiles carries the product's view of a
 * person, auth.users carries their credentials. The listUsers page size is
 * capped at 1000 by the Auth API; past that this needs to paginate, and the
 * table it feeds needs a server-side search at the same time.
 */
export async function getAllPeople(): Promise<Person[]> {
  if (!(await isMasterAdmin())) return [];

  const client = createAdminClient('master admin reading the people directory');

  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    client
      .from('profiles')
      .select('id, full_name, avatar_url, phone, role, status, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailById = new Map(
    (authUsers?.users ?? []).map((user) => [user.id, user.email ?? null]),
  );

  return ((profiles ?? []) as Array<Omit<Person, 'email'>>).map((profile) => ({
    ...profile,
    email: emailById.get(profile.id) ?? null,
  }));
}

export type SalesRow = {
  id: string;
  title: string;
  reference_code: string;
  price: number;
  transaction_type: string;
  status: string;
  category: string;
  updated_at: string;
  published_at: string | null;
  view_count: number;
  enquiry_count: number;
  owner: { id: string; full_name: string | null; phone: string | null; role: string } | null;
  location: { name_en: string } | null;
};

/**
 * Everything that has changed hands, and who moved it.
 *
 * Read through the RLS client on purpose: "properties: admin reads all" already
 * returns every row to the master admin, so there is nothing here the service
 * role would add except the loss of that check.
 */
export async function getSales(): Promise<SalesRow[]> {
  if (!(await isMasterAdmin())) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('properties')
    .select(
      `
      id, title, reference_code, price, transaction_type, status, category,
      updated_at, published_at, view_count, enquiry_count,
      owner:profiles!properties_owner_id_fkey ( id, full_name, phone, role ),
      location:locations!properties_location_id_fkey ( name_en )
    `,
    )
    .in('status', ['sold', 'rented'])
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[getSales]', error.message);
    return [];
  }

  return (data ?? []) as unknown as SalesRow[];
}

export type PlatformTotals = {
  users: number;
  vendors: number;
  listingsLive: number;
  listingsPending: number;
  listingsDraft: number;
  sold: number;
  rented: number;
  valueClosed: number;
  views: number;
  enquiries: number;
};

/** The numbers the owner wants on one screen, with nothing hidden. */
export async function getPlatformTotals(): Promise<PlatformTotals | null> {
  if (!(await isMasterAdmin())) return null;

  const supabase = await createClient();

  const [{ data: properties }, { count: users }, { count: vendors }, { count: enquiries }] =
    await Promise.all([
      supabase
        .from('properties')
        .select('status, price, view_count, transaction_type')
        .is('deleted_at', null),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['property_owner', 'agent', 'agency_manager'])
        .is('deleted_at', null),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }),
    ]);

  const rows = (properties ?? []) as Array<{
    status: string;
    price: number;
    view_count: number;
  }>;

  const closed = rows.filter((row) => row.status === 'sold' || row.status === 'rented');

  return {
    users: users ?? 0,
    vendors: vendors ?? 0,
    listingsLive: rows.filter((row) => row.status === 'published').length,
    listingsPending: rows.filter((row) => row.status === 'pending_review').length,
    listingsDraft: rows.filter((row) => row.status === 'draft').length,
    sold: rows.filter((row) => row.status === 'sold').length,
    rented: rows.filter((row) => row.status === 'rented').length,
    valueClosed: closed.reduce((sum, row) => sum + (row.price ?? 0), 0),
    views: rows.reduce((sum, row) => sum + (row.view_count ?? 0), 0),
    enquiries: enquiries ?? 0,
  };
}

export type AdminListing = {
  id: string;
  title: string;
  reference_code: string;
  slug: string;
  status: string;
  price: number;
  category: string;
  subtype: string;
  transaction_type: string;
  verified_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  owner: { id: string; full_name: string | null; role: string } | null;
  location: { name_en: string; slug: string; path: string } | null;
  images: Array<{ storage_path: string; rendition_paths: Record<string, string> | null; is_cover: boolean }>;
};

/**
 * Every listing on the platform, whatever its state.
 *
 * The moderation queue only ever shows `pending_review`, which left the admin
 * with no screen on which a published listing could be given the verified seal —
 * the reason properties.verified_at was null across the whole table and the
 * home page's verified rail had nothing to rank.
 */
export async function getAllListings(limit = 200): Promise<AdminListing[]> {
  if (!(await isMasterAdmin())) return [];

  const client = createAdminClient('master admin listing overview');
  const { data, error } = await client
    .from('properties')
    .select(
      `id, title, reference_code, slug, status, price, category, subtype, transaction_type,
       verified_at, published_at, expires_at, created_at,
       owner:profiles!properties_owner_id_fkey ( id, full_name, role ),
       location:locations ( name_en, slug, path ),
       images:property_images ( storage_path, rendition_paths, is_cover )`,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getAllListings]', error.message);
    return [];
  }

  return (data ?? []) as unknown as AdminListing[];
}
