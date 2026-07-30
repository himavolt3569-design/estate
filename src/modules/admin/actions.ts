'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authedAction } from '@/lib/auth/action';

/*
 * Admin mutations.
 *
 * Each one is a thin wrapper: authedAction resolves the session, asserts the
 * permission and parses the input, then a SECURITY DEFINER function in the
 * database does the work and re-asserts the same permission plus aal2.
 *
 * The database check is the real one. The check here exists so the UI can show
 * a sentence a person can act on instead of a raw policy violation.
 *
 * No action accepts an actor id. The actor is auth.uid(), decided in Postgres.
 */

const uuid = z.string().uuid('That is not a valid id');

/* -------------------------------------------------------------------------- */
/* Listings                                                                    */
/* -------------------------------------------------------------------------- */
export const moderateProperty = authedAction({
  permission: 'property.publish',
  schema: z
    .object({
      propertyId: uuid,
      decision: z.enum(['approve', 'reject']),
      reason: z.string().trim().max(500).optional(),
    })
    // A rejection with no reason leaves the lister with nothing to fix. The
    // database enforces this too; catching it here gives a field-level error.
    .refine((v) => v.decision !== 'reject' || (v.reason?.length ?? 0) >= 10, {
      message: 'Tell them what to fix, in at least 10 characters',
      path: ['reason'],
    }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('admin_moderate_property', {
      p_property_id: input.propertyId,
      p_decision: input.decision,
      p_reason: input.reason,
    });
    if (error) throw error;

    revalidatePath('/dashboard/admin/moderation');
    revalidatePath('/dashboard/admin');
    return null;
  },
});

export const setPropertyVerified = authedAction({
  permission: 'property.verify',
  schema: z.object({
    propertyId: uuid,
    verified: z.boolean(),
    reason: z.string().trim().max(500).optional(),
  }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('admin_set_property_verified', {
      p_property_id: input.propertyId,
      p_verified: input.verified,
      p_reason: input.reason,
    });
    if (error) throw error;

    revalidatePath('/dashboard/admin/moderation');
    return null;
  },
});

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */
export const setUserRole = authedAction({
  permission: 'user.manage',
  schema: z.object({
    userId: uuid,
    role: z.enum(['platform_admin', 'agency_manager', 'agent', 'property_owner', 'customer']),
    reason: z.string().trim().min(5, 'Say why, so the audit log is useful').max(500),
  }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('admin_set_user_role', {
      p_user_id: input.userId,
      p_role: input.role,
      p_reason: input.reason,
    });
    if (error) throw error;

    revalidatePath('/dashboard/admin/users');
    return null;
  },
});

export const suspendUser = authedAction({
  permission: 'user.suspend',
  schema: z.object({
    userId: uuid,
    reason: z.string().trim().min(5, 'A suspension needs a reason').max(500),
  }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('suspend_user', {
      p_user_id: input.userId,
      p_reason: input.reason,
    });
    if (error) throw error;

    revalidatePath('/dashboard/admin/users');
    revalidatePath('/dashboard/admin');
    return null;
  },
});

export const reinstateUser = authedAction({
  permission: 'user.suspend',
  schema: z.object({
    userId: uuid,
    reason: z.string().trim().min(5, 'Say why they are being reinstated').max(500),
  }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('reinstate_user', {
      p_user_id: input.userId,
      p_reason: input.reason,
    });
    if (error) throw error;

    revalidatePath('/dashboard/admin/users');
    return null;
  },
});

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */
export const resolveReport = authedAction({
  permission: 'report.resolve',
  schema: z.object({
    reportId: uuid,
    status: z.enum(['investigating', 'resolved', 'dismissed']),
    resolution: z.string().trim().max(1000).optional(),
  }).refine(
    (v) => v.status === 'investigating' || (v.resolution?.length ?? 0) >= 5,
    { message: 'Record what was decided', path: ['resolution'] },
  ),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('admin_resolve_report', {
      p_report_id: input.reportId,
      p_status: input.status,
      p_resolution: input.resolution ?? '',
    });
    if (error) throw error;

    revalidatePath('/dashboard/admin/reports');
    revalidatePath('/dashboard/admin');
    return null;
  },
});

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */
export const reviewPayment = authedAction({
  permission: 'payment.verify',
  schema: z
    .object({
      paymentId: uuid,
      decision: z.enum(['approve', 'reject']),
      reason: z.string().trim().max(500).optional(),
    })
    .refine((v) => v.decision !== 'reject' || (v.reason?.length ?? 0) >= 5, {
      message: 'Say why it was rejected',
      path: ['reason'],
    }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('admin_review_payment', {
      p_payment_id: input.paymentId,
      p_decision: input.decision,
      p_reason: input.reason,
    });
    if (error) throw error;

    revalidatePath('/dashboard/admin/payments');
    revalidatePath('/dashboard/admin');
    return null;
  },
});
