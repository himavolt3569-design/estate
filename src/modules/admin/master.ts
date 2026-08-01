'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/auth/action';

/**
 * The master admin's reach.
 *
 * The platform has one owner, and the brief for that seat is total: see every
 * listing, edit every listing, see every customer, fix a customer's sign-in
 * when they call, and post a property for a seller who does not want to use a
 * website. Several of those are things RLS deliberately forbids to everyone,
 * including an admin — changing another person's password is not a table write
 * at all, it is an Auth Admin API call that only the service role can make.
 *
 * So this module holds the privileged operations, and it holds all of them, in
 * one file, under one rule:
 *
 *   1. Resolve the caller from the session. Never from an argument.
 *   2. Refuse unless they are the platform_admin, and are themselves active.
 *   3. Do the work with the service role.
 *   4. Write an audit row naming the actor, the target, and the reason.
 *
 * Step 4 is the part that makes step 3 acceptable. A power that leaves no trace
 * is indistinguishable from a compromise, so nothing here runs silently.
 */

/** Resolves the caller and refuses anyone who is not the master admin. */
async function requireMasterAdmin() {
  const user = await getSessionUser();

  if (!user) throw new Error('Sign in to continue.');
  if (user.role !== 'platform_admin') throw new Error('Only the master admin can do this.');
  if (user.status !== 'active') throw new Error('This account is not active.');

  return user;
}

/** Mirrors public.audit_action. A value outside this set is rejected by the enum. */
type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'role_change'
  | 'permission_change'
  | 'verification'
  | 'suspend'
  | 'service_role_write';

type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  reason: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

async function audit(
  client: ReturnType<typeof createAdminClient>,
  actorId: string,
  entry: AuditEntry,
) {
  const { error } = await client.from('audit_logs').insert({
    actor_id: actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    summary: entry.reason,
    previous_value: entry.before ?? null,
    new_value: entry.after ?? null,
  } as never);

  // An audit write that fails must not be swallowed: the whole justification
  // for the service role here is that the trail exists.
  if (error) throw new Error(`Could not record this in the audit log: ${error.message}`);
}

/** Wraps a privileged operation so every one of them is guarded and reported the same way. */
function masterAction<TSchema extends z.ZodType, TOutput>(config: {
  schema: TSchema;
  handler: (ctx: {
    input: z.infer<TSchema>;
    actorId: string;
    client: ReturnType<typeof createAdminClient>;
    audit: (entry: AuditEntry) => Promise<void>;
  }) => Promise<TOutput>;
}) {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    let actorId: string;
    try {
      actorId = (await requireMasterAdmin()).id;
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }

    const parsed = config.schema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        (fieldErrors[issue.path.join('.') || '_root'] ??= []).push(issue.message);
      }
      return { ok: false, error: 'Check the highlighted fields.', fieldErrors };
    }

    try {
      const client = createAdminClient('master admin control centre');
      const data = await config.handler({
        input: parsed.data,
        actorId,
        client,
        audit: (entry) => audit(client, actorId, entry),
      });
      return { ok: true, data };
    } catch (error) {
      const message = (error as { message?: string }).message ?? 'Something went wrong.';
      return { ok: false, error: message };
    }
  };
}

const REASON = z
  .string()
  .trim()
  .min(6, 'Say why, in a few words. It goes in the record.')
  .max(500);

/* ========================================================================== */
/* Customers                                                                  */
/* ========================================================================== */

/**
 * Changes a customer's sign-in email.
 *
 * Someone who has lost access to the address they registered with cannot fix it
 * themselves — the confirm-both-inboxes flow needs the old inbox. The master
 * admin doing it by hand is the escape hatch, and the audit row is what keeps
 * that from being a quiet account takeover.
 */
export const adminChangeUserEmail = masterAction({
  schema: z.object({
    userId: z.string().uuid(),
    email: z.email('Enter a valid email address'),
    reason: REASON,
  }),
  handler: async ({ input, client, audit }) => {
    const { data: before } = await client.auth.admin.getUserById(input.userId);

    const { error } = await client.auth.admin.updateUserById(input.userId, {
      email: input.email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    await audit({
      action: 'update',
      entityType: 'auth.users',
      entityId: input.userId,
      reason: input.reason,
      before: { email: before?.user?.email ?? null },
      after: { email: input.email },
    });

    revalidatePath('/dashboard/admin/users');
    return { updated: true };
  },
});

/**
 * Sets a customer's password.
 *
 * The new password is never stored or logged — only the fact that it was
 * changed, by whom, and why.
 */
export const adminSetUserPassword = masterAction({
  schema: z.object({
    userId: z.string().uuid(),
    password: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(200, 'That is longer than any password needs to be'),
    reason: REASON,
  }),
  handler: async ({ input, client, audit }) => {
    const { error } = await client.auth.admin.updateUserById(input.userId, {
      password: input.password,
    });
    if (error) throw new Error(error.message);

    await audit({
      action: 'update',
      entityType: 'auth.users',
      entityId: input.userId,
      reason: input.reason,
      after: { password: 'changed by master admin' },
    });

    revalidatePath('/dashboard/admin/users');
    return { updated: true };
  },
});

/** Corrects a customer's own details when they ask over the phone. */
export const adminUpdateUserProfile = masterAction({
  schema: z.object({
    userId: z.string().uuid(),
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional().or(z.literal('')),
    reason: REASON,
  }),
  handler: async ({ input, client, audit }) => {
    const { data: before } = await client
      .from('profiles')
      .select('full_name, phone')
      .eq('id', input.userId)
      .maybeSingle();

    const { error } = await client
      .from('profiles')
      .update({ full_name: input.fullName, phone: input.phone || null })
      .eq('id', input.userId);
    if (error) throw new Error(error.message);

    await audit({
      action: 'update',
      entityType: 'profiles',
      entityId: input.userId,
      reason: input.reason,
      before: before ?? null,
      after: { full_name: input.fullName, phone: input.phone || null },
    });

    revalidatePath('/dashboard/admin/users');
    return { updated: true };
  },
});

/**
 * Moves an account between the non-privileged roles.
 *
 * platform_admin is absent from this list on purpose. Migration 0018 puts a
 * unique index on the admin seat so a second one cannot exist at all, and the
 * only supported way to move it is transfer_master_admin(), which demotes and
 * promotes in a single statement.
 */
export const adminSetUserRole = masterAction({
  schema: z.object({
    userId: z.string().uuid(),
    role: z.enum(['customer', 'property_owner', 'agent', 'agency_manager']),
    reason: REASON,
  }),
  handler: async ({ input, client, audit }) => {
    const { data: before } = await client
      .from('profiles')
      .select('role')
      .eq('id', input.userId)
      .maybeSingle();

    if (before?.role === 'platform_admin') {
      throw new Error('Use "hand over the platform" to move the master admin seat.');
    }

    const { error } = await client
      .from('profiles')
      .update({ role: input.role, account_type_chosen_at: new Date().toISOString() })
      .eq('id', input.userId);
    if (error) throw new Error(error.message);

    await audit({
      action: 'role_change',
      entityType: 'profiles',
      entityId: input.userId,
      reason: input.reason,
      before: before ?? null,
      after: { role: input.role },
    });

    revalidatePath('/dashboard/admin/users');
    return { updated: true };
  },
});

export const adminSetUserStatus = masterAction({
  schema: z.object({
    userId: z.string().uuid(),
    status: z.enum(['active', 'suspended', 'banned']),
    reason: REASON,
  }),
  handler: async ({ input, client, audit }) => {
    const { data: before } = await client
      .from('profiles')
      .select('status, role')
      .eq('id', input.userId)
      .maybeSingle();

    if (before?.role === 'platform_admin') {
      throw new Error('The master admin account cannot be suspended.');
    }

    const { error } = await client
      .from('profiles')
      .update({ status: input.status })
      .eq('id', input.userId);
    if (error) throw new Error(error.message);

    await audit({
      action: input.status === 'active' ? 'status_change' : 'suspend',
      entityType: 'profiles',
      entityId: input.userId,
      reason: input.reason,
      before: before ?? null,
      after: { status: input.status },
    });

    revalidatePath('/dashboard/admin/users');
    return { updated: true };
  },
});

/* ========================================================================== */
/* Listings                                                                   */
/* ========================================================================== */

/**
 * Publishes or rejects a listing.
 *
 * admin_moderate_property() in the database does this properly — it writes the
 * trust ledger entry and notifies the seller — so this calls it rather than
 * writing status directly. It runs through the service role because the RPC
 * asserts is_admin(), which the service role does not satisfy, so the guard has
 * already happened up here instead.
 */
export const adminSetListingStatus = masterAction({
  schema: z.object({
    propertyId: z.string().uuid(),
    status: z.enum(['draft', 'pending_review', 'published', 'rejected', 'sold', 'rented', 'archived']),
    reason: REASON,
  }),
  handler: async ({ input, client, audit }) => {
    const { data: before } = await client
      .from('properties')
      .select('status, title, owner_id')
      .eq('id', input.propertyId)
      .maybeSingle();

    const patch: Record<string, unknown> = { status: input.status };
    if (input.status === 'rejected') patch.rejection_reason = input.reason;
    if (input.status === 'published') patch.published_at = new Date().toISOString();

    const { error } = await client
      .from('properties')
      .update(patch as never)
      .eq('id', input.propertyId);
    if (error) throw new Error(error.message);

    await audit({
      action: 'status_change',
      entityType: 'properties',
      entityId: input.propertyId,
      reason: input.reason,
      before: before ?? null,
      after: { status: input.status },
    });

    revalidatePath('/dashboard/admin/listings');
    revalidatePath('/dashboard/listings');
    return { updated: true };
  },
});

/** Sets or lifts the verified seal. */
export const adminSetListingVerified = masterAction({
  schema: z.object({
    propertyId: z.string().uuid(),
    verified: z.boolean(),
    reason: REASON,
  }),
  handler: async ({ input, actorId, client, audit }) => {
    const { error } = await client
      .from('properties')
      .update({
        verified_at: input.verified ? new Date().toISOString() : null,
        verified_by: input.verified ? actorId : null,
      })
      .eq('id', input.propertyId);
    if (error) throw new Error(error.message);

    await audit({
      action: 'verification',
      entityType: 'properties',
      entityId: input.propertyId,
      reason: input.reason,
      after: { verified: input.verified },
    });

    revalidatePath('/dashboard/admin/listings');
    return { updated: true };
  },
});

/** Moves a listing to a different seller, for when it was filed under the wrong account. */
export const adminReassignListing = masterAction({
  schema: z.object({
    propertyId: z.string().uuid(),
    ownerId: z.string().uuid(),
    reason: REASON,
  }),
  handler: async ({ input, client, audit }) => {
    const { data: before } = await client
      .from('properties')
      .select('owner_id')
      .eq('id', input.propertyId)
      .maybeSingle();

    const { error } = await client
      .from('properties')
      .update({ owner_id: input.ownerId })
      .eq('id', input.propertyId);
    if (error) throw new Error(error.message);

    await audit({
      action: 'update',
      entityType: 'properties',
      entityId: input.propertyId,
      reason: input.reason,
      before: before ?? null,
      after: { owner_id: input.ownerId },
    });

    revalidatePath('/dashboard/admin/listings');
    return { updated: true };
  },
});
