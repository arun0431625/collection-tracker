import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load env vars
const envFile = fs.readFileSync(".env", "utf-8");
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() || "";
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching raw collections_lrs data to inspect payment_date...");
  const { data: raw, error: rawErr } = await supabase
    .from("collections_lrs")
    .select("gr_no, payment_date, received_amount")
    .neq("received_amount", 0)
    .not("payment_date", "is", null)
    .limit(10);
    
  if (rawErr) {
    console.error("Raw Error:", rawErr);
  } else {
    console.log("Sample Data with payment:");
    console.table(raw);
  }

  console.log("\nTesting get_dashboard_daily_trend RPC directly...");
  const { data: rpc, error: rpcErr } = await supabase.rpc("get_dashboard_daily_trend", {
    p_days: 30,
    p_branch: null
  });

  if (rpcErr) {
    console.error("RPC Error:", rpcErr);
  } else {
    console.log(`RPC returned ${rpc.length} rows.`);
    console.table(rpc);
  }
}

test();
