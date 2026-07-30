import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type { Database } from '@/lib/supabase/database.types';

import type {
  AdminStats,
  AuditEntry,
  ModerationItem,
  PaymentReviewItem,
  ReportItem,
  UserRow,
} from './types';

/*
 * Admin reads.
 *
 * Every query below uses the RLS-bound server client, never the service role.
 * Admin visibility comes from the is_admin() predicate inside the policies, so
 * a non-admin who somehow reached this code gets an empty result rather than
 * someone else's data. There is no `.eq('is_admin', true)` anywhere, because
 * the client is not the thing deciding.
 */

export async function getAdminStats(): Promise<AdminStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_dashboard_stats');

  // The function raises for non-admins. That is the intended answer, not a bug
  // to paper over, so it surfaces as null and the page renders its denied state.
  if (error) return null;
  return data as unknown as AdminStats;
}

/** The moderation queue: oldest first, because a queue is a queue. */
export async function getModerationQueue(limit = 25): Promise<ModerationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('properties')
    .select(
      `id, title, reference_code, price, transaction_type, category, subtype,
       address_line, created_at, status,
       owner:profiles!properties_owner_id_fkey ( id, full_name, role ),
       location:locations!properties_location_id_fkey ( name_en, name_ne ),
       images:property_images ( storage_path, rendition_paths, is_cover )`,
    )
    .eq('status', 'pending_review')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  return (data ?? []) as unknown as ModerationItem[];
}

type Role = Database['public']['Enums']['user_role'];
type AccountStatus = Database['public']['Enums']['account_status'];
type AuditAction = Database['public']['Enums']['audit_action'];

const ROLES: Role[] = ['platform_admin', 'agency_manager', 'agent', 'property_owner', 'customer'];
const STATUSES: AccountStatus[] = ['pending_verification', 'active', 'suspended', 'banned'];
const AUDIT_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete', 'status_change', 'role_change', 'permission_change',
  'contact_reveal', 'verification', 'payment_review', 'login', 'logout', 'suspend',
  'service_role_write',
];

/**
 * Filters arrive from the URL, so they are strings from an untrusted source.
 * Narrowing them against the real enum here means an unknown value is dropped
 * rather than passed to PostgREST, which would return a 400 and render as a
 * broken page instead of an empty filter.
 */
const narrow = <T extends string>(allowed: T[], value?: string): T | undefined =>
  value && (allowed as string[]).includes(value) ? (value as T) : undefined;

export async function getUsers({
  search,
  role,
  status,
  limit = 50,
}: {
  search?: string;
  role?: string;
  status?: string;
  limit?: number;
} = {}): Promise<UserRow[]> {
  const supabase = await createClient();
  const safeRole = narrow(ROLES, role);
  const safeStatus = narrow(STATUSES, status);

  let query = supabase
    .from('profiles')
    .select(
      'id, full_name, phone, role, status, agency_id, identity_verified_at, suspended_reason, created_at, last_seen_at',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search) query = query.ilike('full_name', `%${search}%`);
  if (safeRole) query = query.eq('role', safeRole);
  if (safeStatus) query = query.eq('status', safeStatus);

  const { data } = await query;
  return (data ?? []) as unknown as UserRow[];
}

/** Open reports, most overdue first: the SLA decides the order, not recency. */
export async function getReports(limit = 50): Promise<ReportItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reports')
    .select(
      `id, target_type, target_id, reason, detail, status, due_at, created_at,
       resolution, resolved_at,
       reporter:profiles!reports_reporter_id_fkey ( id, full_name )`,
    )
    .in('status', ['open', 'investigating'])
    .order('due_at', { ascending: true })
    .limit(limit);

  return (data ?? []) as unknown as ReportItem[];
}

export async function getPendingPayments(limit = 50): Promise<PaymentReviewItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select(
      `id, amount, purpose, reference, note, proof_path, status, created_at,
       property:properties!payments_property_id_fkey ( id, title, reference_code ),
       payer:profiles!payments_payer_id_fkey ( id, full_name ),
       payee:profiles!payments_payee_id_fkey ( id, full_name )`,
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  return (data ?? []) as unknown as PaymentReviewItem[];
}

export async function getAuditLog({
  entityType,
  action,
  limit = 60,
}: {
  entityType?: string;
  action?: string;
  limit?: number;
} = {}): Promise<AuditEntry[]> {
  const supabase = await createClient();

  let query = supabase
    .from('audit_logs')
    .select(
      'id, actor_id, actor_role, action, entity_type, entity_id, summary, previous_value, new_value, ip, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  const safeAction = narrow(AUDIT_ACTIONS, action);

  if (entityType) query = query.eq('entity_type', entityType);
  if (safeAction) query = query.eq('action', safeAction);

  const { data } = await query;
  return (data ?? []) as unknown as AuditEntry[];
}

/**
 * A short-lived signed URL for a payment proof.
 *
 * Proofs live in a private bucket and are never public. Sixty seconds is long
 * enough to look at one and short enough that a copied URL is useless.
 */
export async function getProofUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}
