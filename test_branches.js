import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: bData } = await supabase.from('branches').select('*');
  console.log("Branches in DB:", bData);

  const { data: uData } = await supabase.auth.admin?.listUsers() || { data: "no admin auth" };
  console.log("Users:", uData);
}
check();
