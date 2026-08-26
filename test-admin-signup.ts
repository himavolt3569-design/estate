import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'projectshamro2@gmail.com',
    password: 'Password1234!',
    email_confirm: true,
    user_metadata: { full_name: 'Hima Volt', role: 'property_owner', phone: null },
  });
  console.log('Result:', JSON.stringify({ data, error }, null, 2));
}

run();
