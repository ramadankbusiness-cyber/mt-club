import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[SUPABASE] Missing env vars:", {
    SUPABASE_URL: supabaseUrl ? "set" : "MISSING",
    SUPABASE_SECRET_KEY: supabaseKey ? "set" : "MISSING",
  });
}

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : (console.error("[SUPABASE] Client disabled — env vars missing"), null);
