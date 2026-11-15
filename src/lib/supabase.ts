import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { validateSupabaseEnv, type SupabaseConfigIssue } from "@/lib/supabaseConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfigIssue(): SupabaseConfigIssue {
  return validateSupabaseEnv(SUPABASE_URL, SUPABASE_ANON_KEY).issue;
}

export function isSupabaseConfigured(): boolean {
  return validateSupabaseEnv(SUPABASE_URL, SUPABASE_ANON_KEY).valid;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    try {
      cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch {
      return null;
    }
  }
  return cachedClient;
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}
