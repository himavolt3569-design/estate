import type { Role } from './session';

/**
 * The permission keys seeded in supabase/migrations/0013_seed_reference.sql.
 *
 * This module is a UI convenience: it lets a dashboard hide a button the user
 * cannot use. It is NOT the authorization boundary; that lives in RLS policies
 * and in has_permission() inside the database. Never gate a mutation on this
 * alone; gate it with authedAction({ permission }), which re-checks server-side.
 */
export const PERMISSIONS = [
  'property.create',
  'property.edit',
  'property.delete',
  'property.publish',
  'property.verify',
  'enquiry.view',
  'enquiry.respond',
  'appointment.manage',
  'payment.manage',
  'payment.verify',
  'user.manage',
  'user.suspend',
  'report.resolve',
  'review.moderate',
  'audit.view',
  'system.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Mirrors the role_permissions rows. Kept in sync by a test in 0013's suite. */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  platform_admin: PERMISSIONS,
  agency_manager: [
    'property.create',
    'property.edit',
    'property.delete',
    'enquiry.view',
    'enquiry.respond',
    'appointment.manage',
    'payment.manage',
    'payment.verify',
  ],
  agent: [
    'property.create',
    'property.edit',
    'enquiry.view',
    'enquiry.respond',
    'appointment.manage',
    'payment.manage',
  ],
  property_owner: [
    'property.create',
    'property.edit',
    'property.delete',
    'enquiry.view',
    'enquiry.respond',
    'appointment.manage',
    'payment.manage',
    'payment.verify',
  ],
  customer: ['enquiry.view', 'appointment.manage'],
};

export function roleHasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: 'Platform admin',
  agency_manager: 'Agency manager',
  agent: 'Agent',
  property_owner: 'Owner',
  customer: 'Customer',
};

/** What a buyer sees on a listing. The owner/agent distinction carries weight. */
export const LISTED_BY_LABELS: Record<Role, string> = {
  platform_admin: 'Listed by Kitta',
  agency_manager: 'Listed by agency',
  agent: 'Listed by agent',
  property_owner: 'Listed by owner',
  customer: 'Listed by owner',
};
