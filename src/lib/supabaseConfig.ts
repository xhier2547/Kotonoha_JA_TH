export type SupabaseConfigIssue =
  | "ok"
  | "missing"
  | "invalid_url"
  | "secret_key_used_as_public";

export interface SupabaseConfigValidation {
  valid: boolean;
  issue: SupabaseConfigIssue;
  normalizedUrl: string;
}

const SUPABASE_API_SUBPATH_RE = /\/(?:rest|auth|storage|graphql|functions)\/v\d+\/?$/i;

/** Strips accidental API subpaths like `/rest/v1/` from a Supabase Project URL. */
export function normalizeSupabaseUrl(rawUrl?: string): string {
  const trimmed = rawUrl?.trim() ?? "";
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    const cleanPath = parsed.pathname
      .replace(SUPABASE_API_SUBPATH_RE, "")
      .replace(/\/+$/, "");
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return "";
  }
}

/** Validates public Supabase env values before browser client initialization. */
export function validateSupabaseEnv(
  rawUrl?: string,
  rawAnonKey?: string
): SupabaseConfigValidation {
  const url = rawUrl?.trim() ?? "";
  const key = rawAnonKey?.trim() ?? "";

  if (!url || !key) {
    return { valid: false, issue: "missing", normalizedUrl: "" };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, issue: "invalid_url", normalizedUrl: "" };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { valid: false, issue: "invalid_url", normalizedUrl: "" };
  }

  if (
    parsedUrl.hostname === "supabase.com" ||
    parsedUrl.hostname === "www.supabase.com"
  ) {
    return { valid: false, issue: "invalid_url", normalizedUrl: "" };
  }

  // Reject service-role/secret keys placed in NEXT_PUBLIC_SUPABASE_ANON_KEY.
  if (key.startsWith("sb_secret_")) {
    return {
      valid: false,
      issue: "secret_key_used_as_public",
      normalizedUrl: "",
    };
  }

  return {
    valid: true,
    issue: "ok",
    normalizedUrl: normalizeSupabaseUrl(url),
  };
}
