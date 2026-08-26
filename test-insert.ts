import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const testId = '00000000-0000-0000-0000-000000000001';
  
  const { data, error } = await supabase.from('profiles').insert({
    id: testId,
    full_name: 'Hima Volt',
    status: 'pending_verification',
    role: 'property_owner',
  });
  
  console.log('Result:', { data, error });
}

run();
