import type { TokenizedWord } from "@/types/learning";

interface ChromeTranslatorInstance {
  translate: (text: string) => Promise<string>;
}

interface ChromeTranslatorStatic {
  availability: (opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<string>;
  create: (opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<ChromeTranslatorInstance>;
}

let chromeTranslatorInstance: ChromeTranslatorInstance | null = null;
let chromeCheckedUnavailable = false;
let serverWarmupStarted = false;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function getChromeTranslatorApi(): ChromeTranslatorStatic | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as unknown as {
    Translator?: ChromeTranslatorStatic;
    ai?: { translator?: ChromeTranslatorStatic };
  };
  return g.Translator ?? g.ai?.translator ?? null;
}

async function getReadyChromeTranslator(): Promise<ChromeTranslatorInstance | null> {
  if (chromeTranslatorInstance) return chromeTranslatorInstance;
  if (chromeCheckedUnavailable) return null;

  try {
    const api = getChromeTranslatorApi();
    if (!api || typeof api.availability !== "function") {
      chromeCheckedUnavailable = true;
      return null;
    }

    const status = await withTimeout(
      api.availability({ sourceLanguage: "ja", targetLanguage: "th" }),
      1200
    );

    // Only use Chrome built-in translator if already downloaded and ready ("available" / "readily");
    // never block waiting for background multi-hundred-MB downloads.
    if (status !== "available" && status !== "readily") {
      chromeCheckedUnavailable = true;
      return null;
    }

    const created = await withTimeout(
      api.create({ sourceLanguage: "ja", targetLanguage: "th" }),
      2500
    );
    if (!created) {
      chromeCheckedUnavailable = true;
      return null;
    }

    chromeTranslatorInstance = created;
    return created;
  } catch {
    chromeCheckedUnavailable = true;
    return null;
  }
}

/** Pre-load local translation model in Node server so post-speech translation is fast. */
export function warmupLocalTranslator(): void {
  void getReadyChromeTranslator();
  if (serverWarmupStarted) return;
  serverWarmupStarted = true;
  void fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ warmup: true }),
  }).catch(() => {
    serverWarmupStarted = false;
  });
}

/** Tokenize Japanese sentence into morphemes using local Kuromoji API. */
export async function fetchJapaneseTokens(text: string): Promise<TokenizedWord[]> {
  if (!text.trim()) return [];
  try {
    const res = await fetch("/api/tokenize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { tokens?: TokenizedWord[] };
    return json.tokens ?? [];
  } catch {
    return [];
  }
}

/** Convert Japanese sentence into hiragana reading using local Kuromoji tokenizer. */
export async function fetchJapaneseReading(text: string): Promise<string | undefined> {
  if (!text.trim()) return undefined;
  const tokens = await fetchJapaneseTokens(text);
  const reading = tokens
    .map((t) => t.readingHiragana || t.surface)
    .join("")
    .trim();
  return reading && reading !== text.trim() ? reading : undefined;
}

const translationCache = new Map<
  string,
  { translation: string; engine: "chrome" | "nllb-local" }
>();

function cacheTranslation(
  key: string,
  val: { translation: string; engine: "chrome" | "nllb-local" }
) {
  if (translationCache.size > 200) {
    const first = translationCache.keys().next().value;
    if (first) translationCache.delete(first);
  }
  translationCache.set(key, val);
  return val;
}

/** Translate Japanese text to Thai locally without consuming external API quota. */
export async function translateJaToTh(
  text: string
): Promise<{ translation: string; engine: "chrome" | "nllb-local" } | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const cached = translationCache.get(trimmed);
  if (cached) return cached;

  // 1. Try Chrome built-in on-device Translator only if already ready (max 2.5s)
  const chromeTr = await getReadyChromeTranslator();
  if (chromeTr) {
    try {
      const translated = await withTimeout(chromeTr.translate(trimmed), 2500);
      if (translated?.trim()) {
        return cacheTranslation(trimmed, {
          translation: translated.trim(),
          engine: "chrome",
        });
      }
    } catch {
      // Fall through to local NLLB server model
    }
  }

  // 2. Fallback to local Transformers.js NLLB-200 on Next.js server
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { translation?: string };
    const translation = json.translation?.trim();
    if (!translation) return null;
    return cacheTranslation(trimmed, { translation, engine: "nllb-local" });
  } catch {
    return null;
  }
}
