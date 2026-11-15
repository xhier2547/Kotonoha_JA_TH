import JSZip from "jszip";
import { stripHtmlAndSoundTags, type ImportedCardRow } from "@/lib/deckPortability";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        { error: "กรุณาเลือกไฟล์ .apkg" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const dbEntry = zip.file("collection.anki21") ?? zip.file("collection.anki2");
    if (!dbEntry) {
      const hasAnki21b = Boolean(zip.file("collection.anki21b"));
      return Response.json(
        {
          error: hasAnki21b
            ? "ไฟล์ .apkg นี้ใช้ฐานข้อมูลบีบอัด Anki 2.1.50+ (collection.anki21b) กรุณา Export จาก Anki แบบเลือก 'Support older Anki versions' หรือ Export เป็น Notes in Plain Text (.txt)"
            : "ไม่พบฐานข้อมูล Anki (collection.anki2 / collection.anki21) ในไฟล์ .apkg นี้",
        },
        { status: 400 }
      );
    }

    const sqliteBytes = await dbEntry.async("uint8array");
    const initSqlJs = (await import("sql.js/dist/sql-wasm-inline.js")).default;
    const SQL = await initSqlJs();
    const ankiDb = new SQL.Database(sqliteBytes);

    let cards: ImportedCardRow[] = [];
    try {
      const queryRes = ankiDb.exec("SELECT flds, tags FROM notes LIMIT 2500");
      if (queryRes.length > 0 && queryRes[0].values.length > 0) {
        cards = queryRes[0].values
          .map((row) => {
            const rawFlds = String(row[0] ?? "");
            const rawTags = String(row[1] ?? "");
            const fields = rawFlds
              .split("\u001f")
              .map((f) => stripHtmlAndSoundTags(f))
              .filter(Boolean);

            if (fields.length === 0) return null;

            const front = fields[0];
            let reading = front;
            let meaningTh = fields[1] ?? front;

            if (fields.length >= 3) {
              if (/^[\u3040-\u30ffー\s・]+$/.test(fields[1])) {
                reading = fields[1];
                meaningTh = fields[2];
              } else {
                reading = /^[\u3040-\u30ffー\s・]+$/.test(fields[2]) ? fields[2] : front;
                meaningTh = fields[1];
              }
            }

            const tags = Array.from(
              new Set([
                "Anki",
                ...rawTags
                  .split(/\s+/)
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 5),
              ])
            );

            return {
              front,
              reading,
              meaningTh,
              tags,
              exampleSentence: fields[3],
            } satisfies ImportedCardRow;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
      }
    } finally {
      ankiDb.close();
    }

    return Response.json({ ok: true, count: cards.length, cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "อ่านไฟล์ .apkg ไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
