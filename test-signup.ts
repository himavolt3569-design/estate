import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const { data, error } = await supabase.auth.signUp({
    email: 'projectshamro3@gmail.com',
    password: 'Password1234!',
    options: {
      data: { full_name: 'Hima Volt', role: 'property_owner', phone: null },
    },
  });
  console.log('Result:', JSON.stringify({ data, error }, null, 2));
}

run();
