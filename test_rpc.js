import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Calling admin_list_branch_security_rows...");
  const { data, error } = await supabase.rpc('admin_list_branch_security_rows');
  console.log("Error:", error);
  console.log("Data:", data ? data.length + " rows" : null);
}

run();
