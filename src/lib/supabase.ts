import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient<Database> | null = null;
let supabaseClientPromise: Promise<SupabaseClient<Database>> | null = null;

export const getSupabase = async () => {
 if (supabaseClient) {
  return supabaseClient;
 }

 supabaseClientPromise ??= import("@supabase/supabase-js")
  .then(({ createClient }) => {
   if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
     "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
   }

   supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

   return supabaseClient;
  })
  .catch((error: unknown) => {
   supabaseClientPromise = null;
   throw error;
  });

 return supabaseClientPromise;
};
