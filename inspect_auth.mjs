import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envStr = fs.readFileSync(".env", "utf-8");
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() || "";
const supabaseKey = envStr.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const res = await supabase.rpc('get_current_branch_profile');
    console.log("Profile sample:", res.data);

    const res2 = await supabase.rpc('admin_list_branch_security_rows');
    console.log("Security Rows Sample:", res2.data?.slice(0, 2));
}

inspect().catch(console.error);
