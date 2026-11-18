import { findVocabMatch } from "@/lib/vocabLookup";
import { findExactJmdictWord } from "@/lib/openDictServer";

type TranslationFn = (
  input: string,
  options: { src_lang: string; tgt_lang: string; max_new_tokens: number }
) => Promise<{ translation_text: string } | { translation_text: string }[]>;

const globalForTranslate = globalThis as unknown as {
  __nllbCpuPromise?: Promise<TranslationFn>;
  __jaThCache?: Map<string, string>;
};

function getCache() {
  if (!globalForTranslate.__jaThCache) {
    globalForTranslate.__jaThCache = new Map<string, string>();
  }
  return globalForTranslate.__jaThCache;
}

async function getLocalCpuNllb(): Promise<TranslationFn> {
  if (!globalForTranslate.__nllbCpuPromise) {
    globalForTranslate.__nllbCpuPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      // Strictly CPU-only lightweight fallback so GPU/VRAM is never stressed
      const pipe = await pipeline(
        "translation",
        "Xenova/nllb-200-distilled-600M",
        { dtype: "q8", device: "cpu" }
      );
      return pipe as unknown as TranslationFn;
    })().catch((err) => {
      globalForTranslate.__nllbCpuPromise = undefined;
      throw err;
    });
  }
  return globalForTranslate.__nllbCpuPromise;
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[。！？\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 4) return parts;
  return [parts.slice(0, 3).join(""), parts.slice(3).join("")].filter(Boolean);
}

async function translateViaMyMemory(text: string): Promise<string | null> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    text
  )}&langpair=ja|th`;
  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };
  const translated = json?.responseData?.translatedText?.trim();
  if (
    !translated ||
    json?.responseStatus !== 200 ||
    /MYMEMORY WARNING/i.test(translated)
  ) {
    return null;
  }
  return translated;
}

async function translateViaLocalPivot(text: string): Promise<string> {
  const translator = await getLocalCpuNllb();
  const sentences = splitSentences(text);
  const results: string[] = [];

  for (const sentence of sentences) {
    // Pivot ja -> en -> th produces much more natural Thai than direct ja -> th on 600M NLLB
    const enOut = await translator(sentence, {
      src_lang: "jpn_Jpan",
      tgt_lang: "eng_Latn",
      max_new_tokens: 72,
    });
    const enText = (Array.isArray(enOut) ? enOut[0] : enOut)?.translation_text?.trim();
    if (!enText) continue;

    const thOut = await translator(enText, {
      src_lang: "eng_Latn",
      tgt_lang: "tha_Thai",
      max_new_tokens: 96,
    });
    const thText = (Array.isArray(thOut) ? thOut[0] : thOut)?.translation_text?.trim();
    if (thText) {
      results.push(thText);
    }
  }

  return results.join(" ").trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string; warmup?: boolean };

    // Keep warmup lightweight so we do not allocate GPU/heavy memory unnecessarily
    if (body.warmup) {
      return Response.json({ ok: true, ready: true, elapsedMs: 0 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json({ ok: true, translation: "", elapsedMs: 0 });
    }

    const cache = getCache();
    const cached = cache.get(text);
    if (cached) {
      return Response.json({
        ok: true,
        translation: cached,
        engine: "cache",
        elapsedMs: 0,
      });
    }

    const t0 = Date.now();
    const localThaiHit = findVocabMatch(text, text);
    const jmdictHit = findExactJmdictWord(text, text);

    if (localThaiHit && localThaiHit.meaningTh) {
      cache.set(text, localThaiHit.meaningTh);
      return Response.json({
        ok: true,
        translation: localThaiHit.meaningTh,
        dictEntry: jmdictHit,
        engine: "local-th-dict",
        elapsedMs: Date.now() - t0,
      });
    }

    let translation: string | null = null;
    let engine = "mymemory";

    try {
      translation = await translateViaMyMemory(text);
    } catch {
      translation = null;
    }

    if (!translation && jmdictHit?.meaningEn) {
      engine = "jmdict-en";
      translation = jmdictHit.meaningEn;
    }

    if (!translation && !process.env.VERCEL) {
      engine = "nllb-cpu-pivot";
      translation = await translateViaLocalPivot(text);
    }

    if (translation) {
      if (cache.size >= 200) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      cache.set(text, translation);
    }

    const elapsedMs = Date.now() - t0;
    console.log(`[Translate ${engine}] ms=${elapsedMs} len=${text.length}`);

    return Response.json({
      ok: true,
      translation,
      dictEntry: jmdictHit,
      engine,
      elapsedMs,
    });
  } catch (error) {
    console.error("Translate error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Translation failed",
      },
      { status: 500 }
    );
  }
}
