import dns from "node:dns";

// Prefer IPv4 on Windows/Node to avoid intermittent IPv6 stall/timeouts
dns.setDefaultResultOrder("ipv4first");

type AiMode =
  | "kaiwa"
  | "kaiwa-reply"
  | "kaiwa-coach"
  | "story"
  | "jlpt-generate"
  | "ai-coach";

interface AiRequestBody {
  mode: AiMode;
  provider: "gemini" | "openai";
  apiKey: string;
  model?: string;
  level: string;
  scenarioTitle?: string;
  scenarioPersona?: string;
  history?: { role: "user" | "assistant"; text: string }[];
  userMessage?: string;
  knownWords?: string[];
  topic?: string;
  stream?: boolean;
  hardWordsSummary?: string[];
  weakSectionsSummary?: string[];
  againRatePct?: number;
}

const KAIWA_REPLY_SCHEMA = {
  type: "OBJECT",
  properties: {
    replyJp: { type: "STRING" },
    replyReading: { type: "STRING" },
    replyTh: { type: "STRING" },
  },
  required: ["replyJp", "replyReading", "replyTh"],
};

const KAIWA_COACH_SCHEMA = {
  type: "OBJECT",
  properties: {
    isNatural: { type: "BOOLEAN" },
    grammarFeedbackTh: { type: "STRING" },
    naturalRewriteJp: { type: "STRING" },
    naturalRewriteReading: { type: "STRING" },
    tipTh: { type: "STRING" },
  },
  required: [
    "isNatural",
    "grammarFeedbackTh",
    "naturalRewriteJp",
    "naturalRewriteReading",
    "tipTh",
  ],
};

const KAIWA_SCHEMA = {
  type: "OBJECT",
  properties: {
    ...KAIWA_REPLY_SCHEMA.properties,
    ...KAIWA_COACH_SCHEMA.properties,
  },
  required: [...KAIWA_REPLY_SCHEMA.required, ...KAIWA_COACH_SCHEMA.required],
};

const AI_COACH_SCHEMA = {
  type: "OBJECT",
  properties: {
    diagnosisTh: { type: "STRING" },
    actionPlanTh: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    miniDrills: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          promptJp: { type: "STRING" },
          choices: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          correctIndex: { type: "INTEGER" },
          explainTh: { type: "STRING" },
        },
        required: ["promptJp", "choices", "correctIndex", "explainTh"],
      },
    },
  },
  required: ["diagnosisTh", "actionPlanTh", "miniDrills"],
};

const STORY_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    content: { type: "STRING" },
    translationTh: { type: "STRING" },
    newWords: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          reading: { type: "STRING" },
          meaningTh: { type: "STRING" },
        },
        required: ["word", "reading", "meaningTh"],
      },
    },
  },
  required: ["title", "content", "translationTh", "newWords"],
};

const JLPT_MOCK_SCHEMA = {
  type: "OBJECT",
  properties: {
    titleTh: { type: "STRING" },
    titleJp: { type: "STRING" },
    readingPassageJp: { type: "STRING" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          section: { type: "STRING" },
          mondaiLabel: { type: "STRING" },
          promptJp: { type: "STRING" },
          targetWord: { type: "STRING" },
          choices: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          explainTh: { type: "STRING" },
        },
        required: [
          "section",
          "mondaiLabel",
          "promptJp",
          "choices",
          "correctIndex",
          "explainTh",
        ],
      },
    },
  },
  required: ["titleTh", "titleJp", "readingPassageJp", "questions"],
};

const DEPRECATED_GEMINI_MODELS = new Set([
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
]);

function resolveGeminiModel(model?: string) {
  const requested = model?.trim() || "gemini-3.8-flash";
  return DEPRECATED_GEMINI_MODELS.has(requested) ? "gemini-3.8-flash" : requested;
}

function getThinkingCandidates(
  targetModel: string
): (Record<string, unknown> | undefined)[] {
  if (/^gemini-2\.5/i.test(targetModel)) {
    return [{ thinkingBudget: 0 }, undefined];
  }
  // gemini-3.8-flash supports "low" | "medium" | "high" (not "minimal")
  if (/^gemini-3\.8/i.test(targetModel)) {
    return [{ thinkingLevel: "low" }, undefined];
  }
  return [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }, undefined];
}

function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

/** Incrementally extract partial JSON string values from a streamed JSON object buffer. */
function extractStreamingJsonFields(buffer: string, keys: string[]) {
  const values: Record<string, string> = {};
  const complete: Record<string, boolean> = {};
  for (const key of keys) {
    const keyToken = `"${key}"`;
    const keyIdx = buffer.indexOf(keyToken);
    if (keyIdx === -1) continue;
    const colonIdx = buffer.indexOf(":", keyIdx + keyToken.length);
    if (colonIdx === -1) continue;
    let i = colonIdx + 1;
    while (i < buffer.length && /\s/.test(buffer[i])) i++;
    if (buffer[i] !== '"') continue;
    i++;
    let rawSlice = "";
    let closed = false;
    while (i < buffer.length) {
      const ch = buffer[i];
      if (ch === "\\") {
        if (i + 1 >= buffer.length) break;
        const next = buffer[i + 1];
        if (next === "u" && i + 5 >= buffer.length) break;
        rawSlice += ch + next;
        i += 2;
        continue;
      }
      if (ch === '"') {
        closed = true;
        break;
      }
      rawSlice += ch;
      i++;
    }
    try {
      values[key] = JSON.parse(`"${rawSlice}"`);
      complete[key] = closed;
    } catch {
      // Ignore partial escape edge until more bytes arrive
    }
  }
  return { values, complete };
}

async function fetchGeminiWithConfig(
  url: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
  maxOutputTokens: number,
  thinkingConfig?: Record<string, unknown>
) {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.7,
    maxOutputTokens,
    responseMimeType: "application/json",
    responseSchema,
  };
  if (thinkingConfig) {
    generationConfig.thinkingConfig = thinkingConfig;
  }

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });
}

async function openGeminiRequest(
  apiKey: string,
  model: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
  maxOutputTokens: number,
  stream: boolean
) {
  const targetModel = resolveGeminiModel(model);
  const method = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    targetModel
  )}:${method}key=${encodeURIComponent(apiKey)}`;

  let res: Response | null = null;
  let lastErrText = "";
  const t0 = Date.now();

  for (const thinkingConfig of getThinkingCandidates(targetModel)) {
    res = await fetchGeminiWithConfig(
      url,
      prompt,
      responseSchema,
      maxOutputTokens,
      thinkingConfig
    );
    if (res.ok) break;
    lastErrText = await res.text();
    if (res.status !== 400 || !/thinking|schema/i.test(lastErrText)) {
      throw new Error(`Gemini API Error (${res.status}): ${lastErrText.slice(0, 300)}`);
    }
  }

  if (!res || !res.ok) {
    throw new Error(
      `Gemini API Error (${res?.status ?? 500}): ${lastErrText.slice(0, 300)}`
    );
  }

  return { res, targetModel, t0 };
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
  maxOutputTokens: number
) {
  const { res, targetModel, t0 } = await openGeminiRequest(
    apiKey,
    model,
    prompt,
    responseSchema,
    maxOutputTokens,
    false
  );
  const data = await res.json();
  const elapsedMs = Date.now() - t0;
  const thoughtsTokens = data?.usageMetadata?.thoughtsTokenCount ?? 0;
  console.log(
    `[AI] model=${targetModel} ms=${elapsedMs} thoughtsTokens=${thoughtsTokens}`
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { data: extractJson(text), elapsedMs, model: targetModel };
}

function buildNdjsonStream(
  upstreamBody: ReadableStream<Uint8Array>,
  t0: number,
  targetModel: string,
  extractChunkText: (sseDataPayload: string) => { text?: string; thoughts?: number }
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const keys = ["replyJp", "replyReading", "replyTh"];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let sseBuffer = "";
      let jsonBuffer = "";
      let lastSnapshot = "";
      let thoughtsTokens = 0;

      const emit = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });

          const lines = sseBuffer.split(/\r?\n/);
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            const parsedChunk = extractChunkText(payload);
            if (typeof parsedChunk.thoughts === "number") {
              thoughtsTokens = parsedChunk.thoughts;
            }
            if (!parsedChunk.text) continue;

            jsonBuffer += parsedChunk.text;
            const extracted = extractStreamingJsonFields(jsonBuffer, keys);
            const snapshot = JSON.stringify(extracted);
            if (snapshot !== lastSnapshot) {
              lastSnapshot = snapshot;
              emit({
                type: "partial",
                data: extracted.values,
                complete: extracted.complete,
              });
            }
          }
        }

        const elapsedMs = Date.now() - t0;
        console.log(
          `[AI stream] model=${targetModel} ms=${elapsedMs} thoughtsTokens=${thoughtsTokens}`
        );
        const finalData = extractJson(jsonBuffer);
        emit({
          type: "done",
          data: finalData,
          meta: { elapsedMs, model: targetModel },
        });
      } catch (err) {
        emit({
          type: "error",
          error: err instanceof Error ? err.message : "AI stream error",
        });
      } finally {
        controller.close();
      }
    },
  });
}

async function streamGeminiReply(
  apiKey: string,
  model: string,
  prompt: string
) {
  const { res, targetModel, t0 } = await openGeminiRequest(
    apiKey,
    model,
    prompt,
    KAIWA_REPLY_SCHEMA,
    400,
    true
  );

  if (!res.body) {
    throw new Error("Gemini stream returned empty body");
  }

  const stream = buildNdjsonStream(res.body, t0, targetModel, (payload) => {
    try {
      const chunk = JSON.parse(payload);
      const parts = chunk?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      const thoughts = chunk?.usageMetadata?.thoughtsTokenCount;
      return { text, thoughts };
    } catch {
      return {};
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

async function openOpenAIRequest(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
  stream: boolean
) {
  const targetModel = model || "gpt-4o-mini";
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model: targetModel,
      temperature: 0.7,
      max_tokens: maxTokens,
      stream,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a helpful Japanese conversation tutor for Thai learners. Always reply in valid JSON matching the requested fields.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API Error (${res.status}): ${errText.slice(0, 300)}`);
  }

  return { res, targetModel, t0 };
}

async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number
) {
  const { res, targetModel, t0 } = await openOpenAIRequest(
    apiKey,
    model,
    prompt,
    maxTokens,
    false
  );
  const data = await res.json();
  const elapsedMs = Date.now() - t0;
  const text = data?.choices?.[0]?.message?.content ?? "";
  return { data: extractJson(text), elapsedMs, model: targetModel };
}

async function streamOpenAIReply(
  apiKey: string,
  model: string,
  prompt: string
) {
  const { res, targetModel, t0 } = await openOpenAIRequest(
    apiKey,
    model,
    prompt,
    400,
    true
  );

  if (!res.body) {
    throw new Error("OpenAI stream returned empty body");
  }

  const stream = buildNdjsonStream(res.body, t0, targetModel, (payload) => {
    try {
      const chunk = JSON.parse(payload);
      return { text: chunk?.choices?.[0]?.delta?.content ?? "" };
    } catch {
      return {};
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

function buildPromptAndSchema(body: AiRequestBody) {
  const historyText = (body.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Learner" : "Partner"}: ${m.text}`)
    .join("\n");

  const persona = body.scenarioPersona ?? "Friendly Japanese native speaker";
  const title = body.scenarioTitle ?? "Daily Japanese Conversation";
  const level = body.level || "N5";

  if (body.mode === "kaiwa-reply") {
    return {
      schema: KAIWA_REPLY_SCHEMA as Record<string, unknown>,
      maxTokens: 400,
      prompt: `Roleplay as: ${persona} in "${title}".
Learner level: JLPT ${level}.
History:
${historyText}
Learner: "${body.userMessage ?? ""}"

Reply naturally in 1-2 short Japanese sentences for JLPT ${level}. Return JSON keys in exact order: replyJp, replyReading (hiragana), replyTh (concise Thai).`,
    };
  }

  if (body.mode === "kaiwa-coach") {
    const lastPartner = [...(body.history ?? [])]
      .reverse()
      .find((m) => m.role === "assistant")?.text;
    return {
      schema: KAIWA_COACH_SCHEMA as Record<string, unknown>,
      maxTokens: 650,
      prompt: `Evaluate the Japanese learner's sentence in "${title}" (${persona}), JLPT ${level}.
${lastPartner ? `Partner asked: "${lastPartner}"` : ""}
Learner said: "${body.userMessage ?? ""}"

Return JSON with concise Thai feedback:
- isNatural (boolean)
- grammarFeedbackTh (brief Thai feedback on naturalness & grammar)
- naturalRewriteJp (most natural native phrasing for this context)
- naturalRewriteReading (hiragana)
- tipTh (1 short practical cultural/language tip in Thai)`,
    };
  }

  if (body.mode === "kaiwa") {
    return {
      schema: KAIWA_SCHEMA as Record<string, unknown>,
      maxTokens: 1200,
      prompt: `Roleplay as: ${persona} in "${title}".
Learner level: JLPT ${level}.
History:
${historyText}
Learner: "${body.userMessage ?? ""}"

Reply naturally in Japanese (1-2 short sentences for JLPT ${level}) and give brief Thai feedback on naturalness & grammar. Keep every field concise.`,
    };
  }

  if (body.mode === "ai-coach") {
    const hardWords =
      (body.hardWordsSummary ?? []).slice(0, 8).join("; ") ||
      "ยังไม่มีคำที่มีความคลาดเคลื่อนสูง";
    const weakSections =
      (body.weakSectionsSummary ?? []).slice(0, 4).join("; ") ||
      "ยังไม่มีประวัติทำข้อสอบ JLPT";
    const againRate = body.againRatePct ?? 0;

    return {
      schema: AI_COACH_SCHEMA as Record<string, unknown>,
      maxTokens: 1600,
      prompt: `You are a supportive, expert Japanese language tutor coaching a Thai learner at JLPT ${level}.
Learner telemetry:
- SRS lapse / Again rate: ${againRate}%
- Hardest or frequently lapsed cards: ${hardWords}
- JLPT mock exam section breakdown: ${weakSections}

Respond in concise, encouraging Thai:
1. diagnosisTh: 2-sentence root-cause diagnosis of their current bottleneck.
2. actionPlanTh: 3 concrete, actionable micro-habits they can do today (each 1 short sentence).
3. miniDrills: exactly 3 targeted multiple-choice Japanese practice questions focusing on those hard words or weak JLPT skills, each with 4 Japanese/context choices, correctIndex (0..3), and concise Thai explanation (explainTh).`,
    };
  }

  if (body.mode === "jlpt-generate") {
    return {
      schema: JLPT_MOCK_SCHEMA as Record<string, unknown>,
      maxTokens: 2200,
      prompt: `Generate an original JLPT ${level} mini mock test for a Thai learner (5 high-quality multiple-choice questions).
Focus topic: "${body.topic || "General JLPT Practice"}".
Requirements:
- Return exactly 5 questions:
  - Question 1: section "vocab", mondaiLabel "問題1 漢字読み", test reading a kanji word in context (put the target kanji in targetWord)
  - Question 2: section "vocab", mondaiLabel "問題2 文脈規定", test natural vocabulary usage
  - Question 3: section "grammar_reading", mondaiLabel "問題3 文法形式", sentence completion with ★ or blank (______)
  - Question 4: section "grammar_reading", mondaiLabel "問題4 短文読解", comprehension question about readingPassageJp (write a natural 3-5 sentence ${level} passage in readingPassageJp)
  - Question 5: section "listening", mondaiLabel "問題5 応答表現", conversational response question
- Each question must have 4 choices in Japanese and correctIndex (0..3).
- Write clear, helpful Thai explanations in explainTh.`,
    };
  }

  const words = (body.knownWords ?? []).slice(0, 35).join(", ");
  return {
    schema: STORY_SCHEMA as Record<string, unknown>,
    maxTokens: 1500,
    prompt: `Write a short i+1 Japanese story/dialogue (5-6 sentences) on topic "${
      body.topic || "ชีวิตประจำวันในญี่ปุ่น"
    }" for JLPT ${level} Thai learner.
Use familiar words where natural: ${words || "日本語, 食べる, 行く, 友達, 好き"}.
Include 2-3 useful new words and Thai translation.`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiRequestBody;
    if (!body.apiKey || !body.provider) {
      return Response.json(
        { error: "กรุณาระบุ Provider และ API Key ในหน้าตั้งค่า" },
        { status: 400 }
      );
    }

    const { prompt, schema, maxTokens } = buildPromptAndSchema(body);

    if (body.mode === "kaiwa-reply" && body.stream) {
      return body.provider === "openai"
        ? await streamOpenAIReply(body.apiKey, body.model ?? "gpt-4o-mini", prompt)
        : await streamGeminiReply(
            body.apiKey,
            body.model ?? "gemini-3.8-flash",
            prompt
          );
    }

    const result =
      body.provider === "openai"
        ? await callOpenAI(
            body.apiKey,
            body.model ?? "gpt-4o-mini",
            prompt,
            maxTokens
          )
        : await callGemini(
            body.apiKey,
            body.model ?? "gemini-3.8-flash",
            prompt,
            schema,
            maxTokens
          );

    return Response.json({
      ok: true,
      data: result.data,
      meta: { elapsedMs: result.elapsedMs, model: result.model },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return Response.json(
        { error: "AI ใช้เวลาตอบนานเกิน 45 วินาที กรุณาลองส่งใหม่อีกครั้งครับ" },
        { status: 504 }
      );
    }
    const message = error instanceof Error ? error.message : "AI request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
