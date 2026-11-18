import { getKanjiVgStrokeOrder } from "@/lib/openDictServer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const char = searchParams.get("char") ?? "";
  if (!char.trim()) {
    return Response.json({ error: "Missing char parameter" }, { status: 400 });
  }

  const strokeOrder = getKanjiVgStrokeOrder(char);
  if (!strokeOrder) {
    return Response.json({ error: "Stroke order not found" }, { status: 404 });
  }

  return Response.json(strokeOrder, {
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}
