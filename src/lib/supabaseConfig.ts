export type SupabaseConfigIssue =
  | "ok"
  | "missing"
  | "invalid_url"
  | "secret_key_used_as_public";

export interface SupabaseConfigValidation {
  valid: boolean;
  issue: SupabaseConfigIssue;
}

/** Validates public Supabase env values before browser client initialization. */
export function validateSupabaseEnv(
  rawUrl?: string,
  rawAnonKey?: string
): SupabaseConfigValidation {
  const url = rawUrl?.trim() ?? "";
  const key = rawAnonKey?.trim() ?? "";

  if (!url || !key) {
    return { valid: false, issue: "missing" };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, issue: "invalid_url" };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { valid: false, issue: "invalid_url" };
  }

  // Reject service-role/secret keys placed in NEXT_PUBLIC_SUPABASE_ANON_KEY.
  if (key.startsWith("sb_secret_")) {
    return { valid: false, issue: "secret_key_used_as_public" };
  }

  return { valid: true, issue: "ok" };
}
