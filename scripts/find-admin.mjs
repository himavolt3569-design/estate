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
  if (pError) { console.error('Error fetching profiles:', pError); return; }
  
  console.log('Admins found:');
  for (const p of profiles) {
    const user = users.users.find(u => u.id === p.id);
    console.log(`Email: ${user?.email}, Role: ${p.role}`);
  }
}

run();
