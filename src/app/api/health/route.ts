import { NextResponse } from "next/server";

export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  return NextResponse.json({
    ok: true,
    service: "Kotonoha Studio",
    supabaseConfigured: hasUrl && hasAnonKey,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
}
