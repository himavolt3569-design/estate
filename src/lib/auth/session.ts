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
  /** Assurance level from the JWT. 'aal2' means a TOTP challenge was satisfied. */
  aal: 'aal1' | 'aal2';
  hasMfa: boolean;
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

  /*
   * The assurance level has to come from the auth server, not from the user
   * object. `getUser()` does not carry an `aal` field at all, so reading
   * user.app_metadata.aal always produced 'aal1' — which meant an admin who had
   * just satisfied their TOTP challenge was still bounced to the "set up 2FA"
   * screen on every single request, with no way through.
   */
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = (assurance?.currentLevel ?? 'aal1') as 'aal1' | 'aal2';

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role as Role,
    status: profile.status as AccountStatus,
    agencyId: profile.agency_id,
    aal,
    hasMfa: (user.factors ?? []).some((f) => f.status === 'verified'),
    preferredAreaUnit: profile.preferred_area_unit ?? 'ropani',
    preferredLocale: (profile.preferred_locale ?? 'en') as 'en' | 'ne',
  };
});

/** True assurance level, read from the auth server rather than inferred. */
export async function getAssuranceLevel() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    current: (data?.currentLevel ?? 'aal1') as 'aal1' | 'aal2',
    next: (data?.nextLevel ?? 'aal1') as 'aal1' | 'aal2',
    /** The user has a verified factor but has not satisfied it in this session. */
    needsChallenge: data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2',
  };
}

export function isVendor(role: Role | undefined | null): boolean {
  return role != null && VENDOR_ROLES.includes(role);
}
