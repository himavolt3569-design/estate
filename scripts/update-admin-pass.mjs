import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

const envFile = '.env.local';
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...rest] = trimmed.split('=');
  if (!(k in process.env)) process.env[k] = rest.join('=');
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error(error); return; }
  
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').in('role', ['platform_admin']);
  if (pError) { console.error(pError); return; }
  
  if (profiles.length === 0) {
    console.log('No admin found.');
    return;
  }
  
  const adminProfile = profiles[0];
  const user = users.users.find(u => u.id === adminProfile.id);
  
  console.log(`Updating password for ${user.email}...`);
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password: 'HimaVolt@Admin#2026' });
  
  if (updateError) {
    console.error('Failed to update password:', updateError);
  } else {
    console.log('Password updated successfully to: HimaVolt@Admin#2026');
  }
}

run();
