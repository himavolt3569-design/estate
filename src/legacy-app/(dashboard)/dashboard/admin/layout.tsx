import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';

/**
 * The admin shell.
 *
 * This decides what gets drawn, and nothing else. Every query behind these
 * pages runs through policies that call is_admin() inside Postgres, and every
 * privileged write goes through modules/admin/master.ts, which resolves the
 * caller from the session and refuses anyone else. Deleting this file would not
 * open the control centre.
 *
 * It used to also bounce any admin whose session was aal1 to the 2FA setup
 * screen. Migration 0019 took the aal2 requirement out of is_admin() — MFA was
 * deliberately switched off for this role — so that redirect was checking a
 * rule the database no longer had, and it shut the owner out of their own
 * control centre with no way back in. The gate is gone; the roles check stays.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return <div className="pb-10">{children}</div>;
}
