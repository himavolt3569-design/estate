'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authedAction } from '@/lib/auth/action';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseNepaliPhone } from '@/lib/phone/nepal';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

import {
  MIN_IMAGES,
  createListingSchema,
  updateListingSchema,
  type CreateListingValues,
} from './schema';

/**
 * Listing writes.
 *
 * What changed, and why the old version could not work:
 *
 *   1. It was a raw <form action="/api/..."> POST. On success it answered with
 *      NextResponse.redirect(), which defaults to 307 — a status that preserves
 *      the method, so the browser re-POSTed to /dashboard/listings and got a
 *      405. On failure it answered with the string "Internal Error" and the
 *      seller lost everything they had typed.
 *   2. location_id was hardcoded to a lookup for the slug 'kathmandu'. Every
 *      listing in the country was filed in one district, and if that row were
 *      ever missing the insert violated a NOT NULL.
 *   3. Nothing checked the title, description or category/subtype pairing
 *      against the CHECK constraints, so ordinary input produced a 500.
 *   4. price was multiplied by 100 with parseInt, so "25,00,000" became NaN.
 *
 * It is now a Server Action returning a typed result, which is what lets the
 * form keep its state and put the error next to the field that caused it.
 */

const paisaFromRupees = (rupees: number) => Math.round(rupees * 100);

/** Which EAV keys we write, and where they come from on the form. */
const ATTRIBUTE_KEYS = ['bedrooms', 'bathrooms', 'floors', 'parking', 'road_access_ft'] as const;

/**
 * A slug is unique per location, so the same house name in two districts is
 * fine. A Devanagari title slugifies to an empty string, in which case we fall
 * back to the subtype plus a short random suffix rather than failing the CHECK.
 */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  title: string,
  subtype: string,
  locationId: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(title) || slugify(subtype) || 'listing';

  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;

    let query = supabase
      .from('properties')
      .select('id')
      .eq('location_id', locationId)
      .eq('slug', candidate)
      .is('deleted_at', null);

    if (excludeId) query = query.neq('id', excludeId);

    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/** Maps the form's shape onto the columns, shared by create and update. */
function toRow(input: CreateListingValues, slug: string) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    subtype: input.subtype,
    transaction_type: input.transactionType,
    price: paisaFromRupees(input.price),
    price_period: input.transactionType === 'sale' ? null : (input.pricePeriod ?? 'month'),
    price_negotiable: input.priceNegotiable,
    location_id: input.locationId,
    address_line: input.addressLine?.trim() || null,
    geom: `SRID=4326;POINT(${input.lng} ${input.lat})`,
    geom_precision: input.geomPrecision,
    area_raw:
      input.areaValue && input.areaValue > 0 ? { [input.areaUnit]: input.areaValue } : {},
    area_unit_entered: (['ropani', 'aana', 'bigha', 'kattha', 'dhur', 'sqft', 'sqm'] as const).includes(
      input.areaUnit,
    )
      ? input.areaUnit
      : 'ropani',
    show_phone: input.showPhone,
    show_email: input.showEmail,
    show_whatsapp: input.showWhatsapp,
    slug,
  };
}

type WriteClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

/** Replaces the EAV rows for a listing. The hot columns are mirrored by trigger. */
async function writeAttributes(
  client: WriteClient,
  propertyId: string,
  input: CreateListingValues,
) {
  const values: Record<(typeof ATTRIBUTE_KEYS)[number], number | null | undefined> = {
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    floors: input.floors,
    parking: input.parking,
    road_access_ft: input.roadAccessFt,
  };

  const rows = ATTRIBUTE_KEYS.filter((key) => values[key] != null).map((key) => ({
    property_id: propertyId,
    key,
    value_number: values[key] as number,
  }));

  const stale = ATTRIBUTE_KEYS.filter((key) => values[key] == null);
  if (stale.length > 0) {
    await client
      .from('property_attributes')
      .delete()
      .eq('property_id', propertyId)
      .in('key', stale);
  }

  if (rows.length > 0) {
    await client.from('property_attributes').upsert(rows, { onConflict: 'property_id,key' });
  }
}

async function writeFeatures(client: WriteClient, propertyId: string, featureIds: string[]) {
  await client.from('property_features').delete().eq('property_id', propertyId);

  if (featureIds.length > 0) {
    await client
      .from('property_features')
      .insert(featureIds.map((id) => ({ property_id: propertyId, feature_id: id })));
  }
}

/**
 * Replaces a listing's contact numbers.
 *
 * Delete-then-insert rather than a diff, because the set is at most three rows
 * and the ordering is part of what the seller chose. The E.164 normalisation
 * happens here so nothing downstream — the WhatsApp link, the duplicate check,
 * the unique index — ever sees the shape the seller typed.
 */
async function writeContactNumbers(
  client: WriteClient,
  propertyId: string,
  numbers: CreateListingValues['contactNumbers'],
) {
  await client.from('property_contacts').delete().eq('property_id', propertyId);

  const rows = numbers
    .map((row, index) => {
      const parsed = parseNepaliPhone(row.phone);
      if (!parsed.ok) return null;
      return {
        property_id: propertyId,
        phone_e164: parsed.e164,
        label: row.label?.trim() || null,
        is_whatsapp: row.isWhatsapp && parsed.kind === 'mobile',
        position: index,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return;

  const { error } = await client.from('property_contacts').insert(rows);
  if (error) throw error;
}

/* ========================================================================== */
/* Create                                                                     */
/* ========================================================================== */

export const createListing = authedAction({
  schema: createListingSchema,
  permission: 'property.create',
  handler: async ({ input, user, supabase }) => {
    const admin = user.role === 'platform_admin';
    const listingForSomeoneElse = admin && input.ownerId && input.ownerId !== user.id;

    /*
     * Posting on behalf of a seller needs the service role. The insert policy
     * is "vendor creates own draft" — deliberately, since a vendor must never
     * be able to file a listing under another account — so there is no policy
     * that would let even a legitimate master admin do it. The alternative was
     * to widen the policy for everyone holding the admin role; routing the one
     * privileged case through an audited server-side branch keeps the table's
     * rule as strict as it reads.
     */
    const client: WriteClient = listingForSomeoneElse
      ? createAdminClient('master admin posting a listing on behalf of a seller')
      : supabase;

    const ownerId = listingForSomeoneElse ? input.ownerId! : user.id;

    if (listingForSomeoneElse) {
      const { data: owner } = await client
        .from('profiles')
        .select('id, status')
        .eq('id', ownerId)
        .is('deleted_at', null)
        .maybeSingle();

      if (!owner) throw Object.assign(new Error('That seller no longer exists.'), { code: '23503' });
    }

    const slug = await uniqueSlug(supabase, input.title, input.subtype, input.locationId);

    const { data: property, error } = await client
      .from('properties')
      .insert({
        ...toRow(input, slug),
        owner_id: ownerId,
        // Overwritten by tg_properties_set_vendor_context from the owner's
        // profile; supplied only because the column is NOT NULL.
        listed_by_role: 'property_owner',
        status: 'draft',
      } as never)
      .select('id')
      .single();

    if (error || !property) throw error ?? new Error('Could not save the listing');

    await writeAttributes(client, property.id, input);
    await writeFeatures(client, property.id, input.featureIds);
    await writeContactNumbers(client, property.id, input.contactNumbers);

    if (listingForSomeoneElse) {
      await client.from('audit_logs').insert({
        actor_id: user.id,
        action: 'create',
        entity_type: 'properties',
        entity_id: property.id,
        summary: 'master admin posted a listing on behalf of a seller',
        new_value: { owner_id: ownerId },
      } as never);
    }

    revalidatePath('/dashboard/listings');
    return { id: property.id };
  },
});

/* ========================================================================== */
/* Update                                                                     */
/* ========================================================================== */

export const updateListing = authedAction({
  schema: updateListingSchema,
  permission: 'property.edit',
  handler: async ({ input, user, supabase }) => {
    const admin = user.role === 'platform_admin';

    // "properties: admin updates all" covers the master admin, so an ordinary
    // authenticated client is enough here for both cases.
    const client: WriteClient = supabase;

    const slug = await uniqueSlug(
      supabase,
      input.title,
      input.subtype,
      input.locationId,
      input.id,
    );

    const patch: Record<string, unknown> = toRow(input, slug);
    if (admin && input.ownerId) patch.owner_id = input.ownerId;

    const { error } = await client
      .from('properties')
      .update(patch as never)
      .eq('id', input.id);

    if (error) throw error;

    await writeAttributes(client, input.id, input);
    await writeFeatures(client, input.id, input.featureIds);
    await writeContactNumbers(client, input.id, input.contactNumbers);

    revalidatePath('/dashboard/listings');
    revalidatePath(`/dashboard/listings/${input.id}/edit`);
    return { id: input.id };
  },
});

/* ========================================================================== */
/* Lifecycle                                                                  */
/* ========================================================================== */

/**
 * Sends a draft to the moderation queue.
 *
 * The photo minimum and the cover-image rule live in a trigger, so they are
 * checked here first only to produce a sentence a seller can act on rather than
 * a raised exception. The trigger remains the thing that actually enforces it,
 * and MIN_IMAGES is the one number both sides read.
 */
export const submitListingForReview = authedAction({
  schema: z.object({ id: z.string().uuid() }),
  permission: 'property.edit',
  handler: async ({ input, supabase }) => {
    const { count } = await supabase
      .from('property_images')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', input.id);

    if ((count ?? 0) < MIN_IMAGES) {
      throw Object.assign(
        new Error(
          `Add at least ${MIN_IMAGES} photos before sending this for checking. You have ${count ?? 0}.`,
        ),
        { code: '23514' },
      );
    }

    const { error } = await supabase
      .from('properties')
      .update({ status: 'pending_review' })
      .eq('id', input.id);

    if (error) throw error;

    revalidatePath('/dashboard/listings');
    return { submitted: true };
  },
});

/** Soft delete. Hard DELETE is refused by policy, and should be. */
export const archiveListing = authedAction({
  schema: z.object({ id: z.string().uuid() }),
  permission: 'property.delete',
  handler: async ({ input, supabase }) => {
    const { error } = await supabase
      .from('properties')
      .update({ deleted_at: new Date().toISOString(), status: 'archived' })
      .eq('id', input.id);

    if (error) throw error;

    revalidatePath('/dashboard/listings');
    return { archived: true };
  },
});

/** Marks a listing sold or rented, which is what the sales figures count. */
export const markListingClosed = authedAction({
  schema: z.object({
    id: z.string().uuid(),
    outcome: z.enum(['sold', 'rented']),
  }),
  permission: 'property.edit',
  handler: async ({ input, supabase }) => {
    const { error } = await supabase
      .from('properties')
      .update({ status: input.outcome })
      .eq('id', input.id);

    if (error) throw error;

    revalidatePath('/dashboard/listings');
    return { closed: true };
  },
});

/* ========================================================================== */
/* Images                                                                     */
/* ========================================================================== */

/**
 * Records an image that the browser has already put in storage.
 *
 * The upload itself goes straight from the browser to Supabase Storage, so a
 * 4 MB photo never passes through the Next server. Storage authorises it with
 * the same owns_property() the table policies use, which is why the property
 * has to exist before its photos do — and why the wizard saves a draft as soon
 * as it has enough to make one.
 */
export const registerListingImage = authedAction({
  schema: z.object({
    propertyId: z.string().uuid(),
    storagePath: z.string().min(1).max(500),
    /*
     * The three sizes the browser produced. Optional, because storage_path is
     * the source of truth and every reader falls back to it: a photo whose
     * renditions failed to upload is still a photo, and refusing to record it
     * would lose the file the seller already waited for.
     */
    renditions: z
      .object({
        thumb: z.string().max(500).optional(),
        card: z.string().max(500).optional(),
        full: z.string().max(500).optional(),
      })
      .optional(),
    width: z.number().int().positive().max(20000).optional(),
    height: z.number().int().positive().max(20000).optional(),
    isCover: z.boolean().default(false),
    position: z.number().int().min(0).max(60).default(0),
    altText: z.string().max(200).optional(),
  }),
  permission: 'property.edit',
  handler: async ({ input, supabase }) => {
    if (input.isCover) {
      // property_images_one_cover is a unique partial index, so the old cover
      // has to be stood down before the new one is written.
      await supabase
        .from('property_images')
        .update({ is_cover: false })
        .eq('property_id', input.propertyId)
        .eq('is_cover', true);
    }

    const { data, error } = await supabase
      .from('property_images')
      .insert({
        property_id: input.propertyId,
        storage_path: input.storagePath,
        rendition_paths: input.renditions ?? {},
        width: input.width ?? null,
        height: input.height ?? null,
        is_cover: input.isCover,
        position: input.position,
        alt_text: input.altText ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    revalidatePath(`/dashboard/listings/${input.propertyId}/edit`);
    return { id: data.id };
  },
});

export const deleteListingImage = authedAction({
  schema: z.object({ id: z.string().uuid(), propertyId: z.string().uuid() }),
  permission: 'property.edit',
  handler: async ({ input, supabase }) => {
    const { data: image } = await supabase
      .from('property_images')
      .select('storage_path, is_cover')
      .eq('id', input.id)
      .single();

    const { error } = await supabase.from('property_images').delete().eq('id', input.id);
    if (error) throw error;

    if (image?.storage_path) {
      await supabase.storage.from('property-media').remove([image.storage_path]);
    }

    // A listing must always have a cover if it has any photos at all.
    if (image?.is_cover) {
      const { data: next } = await supabase
        .from('property_images')
        .select('id')
        .eq('property_id', input.propertyId)
        .order('position')
        .limit(1)
        .maybeSingle();

      if (next) {
        await supabase.from('property_images').update({ is_cover: true }).eq('id', next.id);
      }
    }

    revalidatePath(`/dashboard/listings/${input.propertyId}/edit`);
    return { deleted: true };
  },
});

export const setListingCoverImage = authedAction({
  schema: z.object({ id: z.string().uuid(), propertyId: z.string().uuid() }),
  permission: 'property.edit',
  handler: async ({ input, supabase }) => {
    await supabase
      .from('property_images')
      .update({ is_cover: false })
      .eq('property_id', input.propertyId)
      .eq('is_cover', true);

    const { error } = await supabase
      .from('property_images')
      .update({ is_cover: true })
      .eq('id', input.id);

    if (error) throw error;

    revalidatePath(`/dashboard/listings/${input.propertyId}/edit`);
    return { updated: true };
  },
});

/* ========================================================================== */
/* Reference data                                                             */
/* ========================================================================== */

/** Districts under a province, for the second box of the location picker. */
export async function getDistricts(provinceId: string) {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('id, name_en, name_ne, slug')
    .eq('parent_id', provinceId)
    .eq('level', 'district')
    .eq('is_active', true)
    .order('name_en');

  return data ?? [];
}
