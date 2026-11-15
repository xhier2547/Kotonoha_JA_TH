import dns from "node:dns";
import { NextResponse } from "next/server";

dns.setDefaultResultOrder("ipv4first");

interface ImageReqBody {
  word?: string;
  reading?: string;
  meaningTh?: string;
  meaningEn?: string;
  provider?: "offline" | "gemini" | "openai";
  apiKey?: string;
}

async function generateWithGeminiImage(
  apiKey: string,
  prompt: string
): Promise<string | null> {
  const models = ["gemini-2.0-flash-exp-image-generation", "gemini-2.5-flash-image"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: { mimeType?: string; data?: string };
            }>;
          };
        }>;
      };
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p) => p.inlineData?.data);
      if (imgPart?.inlineData?.data) {
        const mime = imgPart.inlineData.mimeType || "image/png";
        return `data:${mime};base64,${imgPart.inlineData.data}`;
      }
    } catch {
      // try next model
    }
  }
  return null;
}

async function generateWithOpenAiImage(
  apiKey: string,
  prompt: string
): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const b64 = json.data?.[0]?.b64_json;
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch {
    return null;
  }
}

async function generateWithPollinations(
  prompt: string,
  seed: number
): Promise<string | null> {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=512&height=512&nologo=true&seed=${seed}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") || "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ImageReqBody;
    const word = (body.word ?? "").trim();
    const meaningEn = (body.meaningEn ?? "").trim();
    const meaningTh = (body.meaningTh ?? "").trim();
    if (!word && !meaningEn && !meaningTh) {
      return NextResponse.json(
        { error: "ต้องระบุคำศัพท์หรือความหมายเพื่อสร้างรูปภาพ" },
        { status: 400 }
      );
    }

    const concept = meaningEn || meaningTh || word;
    const prompt = `Charming clean Japanese anime slice-of-life textbook illustration representing the concept: "${concept}" (Japanese word: ${word}). Warm natural colors, clear central subject, studio art style, NO text, NO kanji, NO letters, NO watermark.`;

    if (body.provider === "gemini" && body.apiKey?.trim()) {
      const geminiImg = await generateWithGeminiImage(body.apiKey.trim(), prompt);
      if (geminiImg) {
        return NextResponse.json({ imageDataUrl: geminiImg, engine: "gemini" });
      }
    }

    if (body.provider === "openai" && body.apiKey?.trim()) {
      const oaImg = await generateWithOpenAiImage(body.apiKey.trim(), prompt);
      if (oaImg) {
        return NextResponse.json({ imageDataUrl: oaImg, engine: "openai" });
      }
    }

    const seed = Array.from(word || concept).reduce(
      (acc, ch) => acc + ch.charCodeAt(0),
      100
    );
    const freeImg = await generateWithPollinations(prompt, seed);
    if (freeImg) {
      return NextResponse.json({ imageDataUrl: freeImg, engine: "pollinations" });
    }

    return NextResponse.json(
      { error: "ไม่สามารถสร้างรูปภาพออนไลน์ได้ในขณะนี้ ลองวางรูปด้วย Ctrl+V หรือใช้อีกครั้งภายหลัง" },
      { status: 502 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation error" },
      { status: 500 }
    );
  }
}
