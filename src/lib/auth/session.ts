import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export type Role =
  | 'platform_admin'
  | 'agency_manager'
  | 'agent'
  | 'property_owner'
  | 'customer';

export type AccountStatus = 'pending_verification' | 'active' | 'suspended' | 'banned';

export type SessionUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: Role;
  status: AccountStatus;
  agencyId: string | null;
  preferredAreaUnit: string;
  preferredLocale: 'en' | 'ne';
};

export const VENDOR_ROLES: readonly Role[] = ['property_owner', 'agent', 'agency_manager'];

/**
 * Resolves the caller once per request. `cache()` dedupes it across every
 * component in the tree, so a layout, a page and three server components all
 * reading the session cost one round trip, not five.
 *
 * Uses getUser(), never getSession(): getSession() reads the cookie without
 * verifying it, which on the server means trusting a value the client controls.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role, status, agency_id, preferred_area_unit, preferred_locale')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role as Role,
    status: profile.status as AccountStatus,
    agencyId: profile.agency_id,
    preferredAreaUnit: profile.preferred_area_unit ?? 'ropani',
    preferredLocale: (profile.preferred_locale ?? 'en') as 'en' | 'ne',
  };
});

export function isVendor(role: Role | undefined | null): boolean {
  return role != null && VENDOR_ROLES.includes(role);
}
