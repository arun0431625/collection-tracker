import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@tracker.com',
    password: 'Branch@123'
  });
  if (authErr) {
    console.error("Login failed:", authErr);
    return;
  }
  
  const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_list_branch_security_rows');
  console.log("RPC Data:", rpcData?.length, "rows");
  console.log("RPC Error:", JSON.stringify(rpcErr, null, 2));

  if (rpcErr) {
    const { data: isAD, error: errIsAD } = await supabase.rpc('is_current_admin');
    console.log("is_current_admin():", isAD, errIsAD);
  }
}
check();
