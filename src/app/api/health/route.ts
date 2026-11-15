import { NextResponse } from "next/server";
import { validateSupabaseEnv } from "@/lib/supabaseConfig";

export async function GET() {
  const validation = validateSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return NextResponse.json({
    ok: true,
    service: "Kotonoha Studio",
    supabaseConfigured: validation.valid,
    supabaseIssue: validation.issue,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
}
