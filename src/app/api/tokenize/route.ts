import path from "node:path";
import kuromoji from "kuromoji";
import { toHiragana } from "wanakana";
import type { TokenizedWord } from "@/types/learning";

type KuromojiTokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

let tokenizerPromise: Promise<KuromojiTokenizer> | null = null;

function getTokenizer(): Promise<KuromojiTokenizer> {
  if (!tokenizerPromise) {
    const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) {
          tokenizerPromise = null;
          reject(err);
        } else {
          resolve(tokenizer);
        }
      });
    });
  }
  return tokenizerPromise;
}

const KANJI_REGEX = /[\u4e00-\u9faf\u3400-\u4dbf]/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) {
      return Response.json({ tokens: [] });
    }

    const tokenizer = await getTokenizer();
    const rawTokens = tokenizer.tokenize(text);

    const tokens: TokenizedWord[] = rawTokens.map((t) => {
      const surface = t.surface_form;
      const readingKata = t.reading && t.reading !== "*" ? t.reading : "";
      const readingHiragana = readingKata ? toHiragana(readingKata) : surface;
      const basicForm =
        t.basic_form && t.basic_form !== "*" ? t.basic_form : surface;
      const hasKanji = KANJI_REGEX.test(surface);
      const isContentWord =
        t.pos === "名詞" ||
        t.pos === "動詞" ||
        t.pos === "形容詞" ||
        t.pos === "副詞" ||
        t.pos === "感動詞";

      return {
        surface,
        basicForm,
        readingHiragana,
        pos: t.pos,
        posDetail: t.pos_detail_1,
        hasKanji,
        isContentWord,
      };
    });

    return Response.json({ tokens });
  } catch (error) {
    console.error("Tokenize error:", error);
    return Response.json(
      { error: "Failed to tokenize Japanese text" },
      { status: 500 }
    );
  }
}
