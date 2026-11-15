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
  const validation = validateSupabaseEnv(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!validation.valid || !validation.normalizedUrl) return null;
  if (!cachedClient) {
    try {
      cachedClient = createClient(validation.normalizedUrl, SUPABASE_ANON_KEY, {
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

/** Resolves a readable display name across email signup and OAuth providers (e.g. Google). */
export function getUserDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const raw =
    (typeof meta?.display_name === "string" && meta.display_name) ||
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    user.email ||
    "สมาชิก";
  return raw.trim() || "สมาชิก";
}
