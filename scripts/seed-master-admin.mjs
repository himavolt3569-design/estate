/**
 * Creates the one master admin account.
 *
 * There is deliberately no UI for this. The master admin cannot be created by
 * signing up, cannot be self-selected, and cannot be granted by another admin
 * once one exists (migration 0018 enforces that in the index). This script is
 * the only way in, and it runs against whichever Supabase project the env vars
 * point at.
 *
 * Credentials come from the environment, never from arguments, so the password
 * does not end up in shell history:
 *
 *   MASTER_ADMIN_EMAIL=you@example.com MASTER_ADMIN_PASSWORD='...' \
 *     node scripts/seed-master-admin.mjs
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY, so it must never run in the browser or ship
 * to a client bundle. It is a one-shot operator tool.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// Load whichever env file was asked for, defaulting to local.
const envFile = process.env.ENV_FILE ?? '.env.local';
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...rest] = trimmed.split('=');
    if (!(k in process.env)) process.env[k] = rest.join('=');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.MASTER_ADMIN_EMAIL;
const password = process.env.MASTER_ADMIN_PASSWORD;

if (!url || !serviceKey) {
  console.error(`Missing Supabase URL or service role key in ${envFile}.`);
  process.exit(1);
}
if (!email || !password) {
  console.error('Set MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Use at least 12 characters. This account owns the platform.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await admin
  .from('profiles')
  .select('id')
  .eq('role', 'platform_admin')
  .is('deleted_at', null)
  .maybeSingle();

if (existing) {
  console.error('A master admin already exists. Use transfer_master_admin() to hand the seat over.');
  process.exit(1);
}

// Confirmed on creation: there is no inbox to click a link in for an operator
// account, and an unconfirmed admin cannot sign in.
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Master Admin' },
});

if (createError) {
  console.error('Could not create the account:', createError.message);
  process.exit(1);
}

const userId = created.user.id;

// role and status are guarded columns, so this goes through the same privileged
// path the triggers recognise rather than a bare update.
const { error: promoteError } = await admin.rpc('bootstrap_master_admin', { p_user_id: userId });

if (promoteError) {
  console.error('Account created but promotion failed:', promoteError.message);
  console.error('User id:', userId);
  process.exit(1);
}

console.log('Master admin created.');
console.log('  email:', email);
console.log('  id:   ', userId);
console.log('');
// Migration 0019_remove_admin_mfa dropped the aal2 requirement from is_admin(),
// so the control centre opens on the first sign-in. This used to say the
// opposite, which sent operators looking for a lock that is no longer there.
console.log('Sign in at /login and the control centre is open — two-factor is');
console.log('no longer required for admin functions (migration 0019).');
console.log('Enrol it anyway under Settings -> Security: this account can read');
console.log('and change every listing and every profile on the platform.');
