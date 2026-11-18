import {
  getOpenDictStats,
  searchJmdict,
  searchKanjidic,
} from "@/lib/openDictServer";
import type { JlptLevel } from "@/types/learning";

const VALID_LEVELS = new Set<string>(["ALL", "N5", "N4", "N3", "N2", "N1"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "kanji" ? "kanji" : "vocab";
  const q = searchParams.get("q") ?? "";
  const rawLevel = searchParams.get("level") ?? "ALL";
  const level = (VALID_LEVELS.has(rawLevel) ? rawLevel : "ALL") as
    | "ALL"
    | JlptLevel;
  const limit = Number(searchParams.get("limit") ?? "40") || 40;

  if (tab === "kanji") {
    const result = searchKanjidic({ query: q, level, limit });
    return Response.json({
      tab,
      stats: getOpenDictStats(),
      totalAvailable: result.totalAvailable,
      items: result.items,
    });
  }

  const result = searchJmdict({ query: q, limit });
  return Response.json({
    tab,
    stats: getOpenDictStats(),
    totalAvailable: result.totalAvailable,
    items: result.items,
  });
}
