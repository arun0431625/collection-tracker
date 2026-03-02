import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("branches")
    .select("*");

  if (error) {
    console.error("Supabase error:", error.message);
  } else {
    console.log("Branches from DB ✅", data);
  }
}
