import 'server-only';

import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Restricts a query on `properties` to what the caller may manage.
 *
 * This must be applied by hand. It is tempting to leave the scoping to RLS —
 * "vendor reads own" and "admin reads all" look like they cover it — but
 * Postgres RLS policies are PERMISSIVE, which means they are OR'd together, and
 * `properties` also carries:
 *
 *   properties: public reads published  ->  status = 'published' AND deleted_at IS NULL
 *
 * That policy exists so search works, and it applies to every role including
 * `authenticated`. So an unfiltered SELECT returns "my rows OR every published
 * row on the platform" — which is how a seller with no listings came to see
 * two other people's listings on their own "My properties" page.
 *
 * RLS is still the boundary for writes and for reads of private tables. What it
 * cannot do is express "only mine" on a table that is also publicly readable.
 * That intent has to be in the query.
 */
function scopeToOwner<T extends { eq: (column: string, value: string) => T; or: (filter: string) => T }>(
  query: T,
  user: { id: string; role: string; agencyId: string | null },
): T {
  if (user.role === 'platform_admin') return query;

  // An agency manager is responsible for their agents' listings as well as
  // their own, which is the same pair owns_property_row() tests.
  if (user.role === 'agency_manager' && user.agencyId) {
    return query.or(`owner_id.eq.${user.id},agency_id.eq.${user.agencyId}`);
  }

  return query.eq('owner_id', user.id);
}

export type LocationOption = {
  id: string;
  name_en: string;
  name_ne: string | null;
  slug: string;
  parent_id: string | null;
};

export type FeatureOption = {
  id: string;
  key: string;
  label_en: string;
  label_ne: string | null;
  category: string;
};

/**
 * Provinces and districts in one round trip.
 *
 * 7 provinces and 77 districts is 84 rows. Fetching the pair up front and
 * filtering in the browser is both cheaper and better behaved than a request
 * per province, and it means the district box works offline once the page has
 * loaded — which matters on a phone on Nepali mobile data.
 */
export async function getLocationOptions(): Promise<{
  provinces: LocationOption[];
  districts: LocationOption[];
}> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('locations')
    .select('id, name_en, name_ne, slug, parent_id, level')
    .in('level', ['province', 'district'])
    .eq('is_active', true)
    .order('name_en');

  const rows = (data ?? []) as Array<LocationOption & { level: string }>;

  return {
    provinces: rows.filter((row) => row.level === 'province'),
    districts: rows.filter((row) => row.level === 'district'),
  };
}

export async function getFeatureOptions(): Promise<FeatureOption[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('features')
    .select('id, key, label_en, label_ne, category')
    .eq('is_active', true)
    .order('category')
    .order('position');

  return (data ?? []) as FeatureOption[];
}

export type ListingRow = {
  id: string;
  title: string;
  reference_code: string;
  slug: string;
  price: number;
  price_period: string | null;
  transaction_type: string;
  category: string;
  subtype: string;
  status: string;
  view_count: number;
  enquiry_count: number;
  favorite_count: number;
  created_at: string;
  published_at: string | null;
  verified_at: string | null;
  owner_id: string;
  location: { name_en: string; slug: string } | null;
  images: Array<{ id: string; storage_path: string; is_cover: boolean }>;
  owner: { full_name: string | null; phone: string | null } | null;
};

/**
 * The listings a caller may manage: their own, their agency's, or all of them
 * for the platform admin.
 *
 * The owner predicate is explicit. See scopeToOwner() above for why leaving it
 * to RLS returned every published listing on the platform to every seller.
 */
export async function getListings(): Promise<ListingRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();

  const query = supabase
    .from('properties')
    .select(
      `
      id, title, reference_code, slug, price, price_period, transaction_type,
      category, subtype, status, view_count, enquiry_count, favorite_count,
      created_at, published_at, verified_at, owner_id,
      location:locations!properties_location_id_fkey ( name_en, slug ),
      images:property_images ( id, storage_path, is_cover ),
      owner:profiles!properties_owner_id_fkey ( full_name, phone )
    `,
    )
    .is('deleted_at', null);

  const { data, error } = await scopeToOwner(query, user).order('created_at', {
    ascending: false,
  });

  if (error) {
    console.error('[getListings]', error.message);
    return [];
  }

  return (data ?? []) as unknown as ListingRow[];
}

/**
 * One listing, with everything the edit form needs to repopulate itself.
 *
 * Returns null unless the caller may actually manage it. Without that test the
 * "public reads published" policy handed back any live listing on the platform,
 * so the edit form opened on other people's properties. It could not save them
 * — every write policy tests owns_property() — but a form that loads somebody
 * else's address, price and photos has already leaked them, and a form that
 * cannot save is a broken page on top of that.
 */
export async function getListingForEdit(id: string) {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('properties')
    .select(
      `
      id, title, description, category, subtype, transaction_type, price,
      price_period, price_negotiable, status, owner_id, location_id,
      address_line, geom, geom_precision, area_raw, area_unit_entered,
      bedrooms, bathrooms, floors, parking, road_access_ft,
      show_phone, show_email, show_whatsapp, reference_code, agency_id,
      location:locations!properties_location_id_fkey ( id, name_en, slug, parent_id ),
      images:property_images ( id, storage_path, is_cover, position ),
      features:property_features ( feature_id ),
      contacts:property_contacts ( phone_e164, label, is_whatsapp, position )
    `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;

  // Checked here as well as in the query, because this is the answer to
  // "may I edit this", and it should not depend on the shape of the filter
  // above staying correct.
  const ownerId = row.owner_id as string;
  const agencyId = (row.agency_id as string | null) ?? null;
  const mayManage =
    user.role === 'platform_admin' ||
    ownerId === user.id ||
    (user.role === 'agency_manager' && user.agencyId != null && agencyId === user.agencyId);

  if (!mayManage) return null;

  return { ...row, point: decodePoint(row.geom) } as ListingDetail;
}

/**
 * PostGIS hands a geography column back over PostgREST as EWKB hex, which is
 * unusable by a map component. Decoding the one shape we store — a point — is
 * a dozen lines and avoids either a database round trip through a helper
 * function or asking every caller to remember a second query.
 *
 * Layout: 1 byte endianness, 4 bytes type (high bit 0x20000000 flags an
 * embedded SRID), 4 optional bytes of SRID, then X and Y as float64.
 */
export function decodePoint(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'string' || value.length < 42) return null;

  try {
    const bytes = new Uint8Array(value.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }

    const view = new DataView(bytes.buffer);
    const littleEndian = view.getUint8(0) === 1;
    const type = view.getUint32(1, littleEndian);

    // Only a 2D point is expected here; anything else is not ours to guess at.
    if ((type & 0xff) !== 1) return null;

    const offset = type & 0x20000000 ? 9 : 5;
    const lng = view.getFloat64(offset, littleEndian);
    const lat = view.getFloat64(offset + 8, littleEndian);

    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export type ListingDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  subtype: string;
  transaction_type: string;
  price: number;
  price_period: string | null;
  price_negotiable: boolean;
  status: string;
  owner_id: string;
  location_id: string;
  address_line: string | null;
  geom_precision: 'exact' | 'approximate';
  area_raw: Record<string, number>;
  area_unit_entered: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  parking: number | null;
  road_access_ft: number | null;
  show_phone: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  reference_code: string;
  location: { id: string; name_en: string; slug: string; parent_id: string | null } | null;
  images: Array<{ id: string; storage_path: string; is_cover: boolean; position: number }>;
  features: Array<{ feature_id: string }>;
  contacts: Array<{
    phone_e164: string;
    label: string | null;
    is_whatsapp: boolean;
    position: number;
  }>;
  point: { lat: number; lng: number } | null;
};

/** Sellers the master admin can post on behalf of. */
export async function getPostableOwners() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role')
    .in('role', ['property_owner', 'agent', 'agency_manager'])
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('full_name');

  return (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string;
  }>;
}
