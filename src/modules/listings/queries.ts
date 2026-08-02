import 'server-only';

import { createClient } from '@/lib/supabase/server';

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
 * The listings table.
 *
 * There is no owner filter in the query, and that is on purpose: "vendor reads
 * own" and "admin reads all" already decide which rows come back. Adding a
 * WHERE owner_id = me here would be a second, weaker copy of a rule that is
 * already enforced, and the two would eventually disagree.
 */
export async function getListings(): Promise<ListingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
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
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getListings]', error.message);
    return [];
  }

  return (data ?? []) as unknown as ListingRow[];
}

/** One listing, with everything the edit form needs to repopulate itself. */
export async function getListingForEdit(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('properties')
    .select(
      `
      id, title, description, category, subtype, transaction_type, price,
      price_period, price_negotiable, status, owner_id, location_id,
      address_line, geom, geom_precision, area_raw, area_unit_entered,
      bedrooms, bathrooms, floors, parking, road_access_ft,
      show_phone, show_email, show_whatsapp, reference_code,
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
