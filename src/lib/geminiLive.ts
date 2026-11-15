export interface GeminiLiveCallbacks {
  onStatus: (status: "connecting" | "connected" | "closed", detail?: string) => void;
  onUserTranscript: (text: string) => void;
  onAssistantTranscript: (text: string) => void;
  onTurnComplete: (turn: { userText: string; assistantText: string }) => void;
  onError: (message: string) => void;
}

export interface GeminiLiveSession {
  setMuted: (muted: boolean) => void;
  sendText: (text: string) => void;
  close: () => void;
}

const LIVE_MODEL_CANDIDATES = [
  "models/gemini-3.8-live",
  "models/gemini-2.5-flash-native-audio-preview-12-2025",
];

function downsampleTo16kPcm(input: Float32Array, inputRate: number): Int16Array {
  if (inputRate === 16000) {
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm;
  }

  const ratio = inputRate / 16000;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const pcm = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const idx = i * ratio;
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = idx - lo;
    const sample = input[lo] * (1 - frac) + input[hi] * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function parseSampleRate(mimeType?: string): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : 24000;
}

/** Open a real-time bidirectional Gemini Live WebSocket voice session directly from the browser. */
export async function startGeminiLiveSession(opts: {
  apiKey: string;
  persona: string;
  scenarioTitle: string;
  level: string;
  openingJp?: string;
  callbacks: GeminiLiveCallbacks;
}): Promise<GeminiLiveSession> {
  const { apiKey, persona, scenarioTitle, level, openingJp, callbacks } = opts;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const captureCtx = new AudioContext({ sampleRate: 16000 });
  const playbackCtx = new AudioContext({ sampleRate: 24000 });
  await captureCtx.resume().catch(() => {});
  await playbackCtx.resume().catch(() => {});

  let ws: WebSocket | null = null;
  let closedByUser = false;
  let muted = false;
  let setupDone = false;
  let candidateIndex = 0;
  let userTurnText = "";
  let assistantTurnText = "";
  let nextPlayTime = 0;
  const activeSources = new Set<AudioBufferSourceNode>();

  const stopAllPlayback = () => {
    for (const src of activeSources) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    activeSources.clear();
    nextPlayTime = playbackCtx.currentTime;
  };

  const enqueuePcmPlayback = (b64Data: string, mimeType?: string) => {
    const bytes = base64ToBytes(b64Data);
    const sampleRate = parseSampleRate(mimeType);
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }

    const buffer = playbackCtx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = playbackCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackCtx.destination);
    activeSources.add(source);
    source.onended = () => activeSources.delete(source);

    const now = playbackCtx.currentTime;
    if (nextPlayTime < now) nextPlayTime = now + 0.02;
    source.start(nextPlayTime);
    nextPlayTime += buffer.duration;
  };

  // Setup mic capture node
  const micSource = captureCtx.createMediaStreamSource(stream);
  const processor = captureCtx.createScriptProcessor(2048, 1, 1);
  const muteSink = captureCtx.createGain();
  muteSink.gain.value = 0;

  processor.onaudioprocess = (event) => {
    if (muted || !setupDone || !ws || ws.readyState !== WebSocket.OPEN) return;
    const input = event.inputBuffer.getChannelData(0);
    const pcm16 = downsampleTo16kPcm(input, captureCtx.sampleRate);
    const b64 = bytesToBase64(new Uint8Array(pcm16.buffer));
    ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: b64,
            mimeType: "audio/pcm;rate=16000",
          },
        },
      })
    );
  };

  micSource.connect(processor);
  processor.connect(muteSink);
  muteSink.connect(captureCtx.destination);

  const cleanup = () => {
    stopAllPlayback();
    try {
      processor.disconnect();
      micSource.disconnect();
      muteSink.disconnect();
    } catch {
      // ignore
    }
    stream.getTracks().forEach((t) => t.stop());
    captureCtx.close().catch(() => {});
    playbackCtx.close().catch(() => {});
  };

  const connectCandidate = () => {
    const modelName = LIVE_MODEL_CANDIDATES[candidateIndex];
    callbacks.onStatus("connecting", modelName.replace("models/", ""));

    const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    ws = new WebSocket(endpoint);
    setupDone = false;

    ws.onopen = () => {
      ws?.send(
        JSON.stringify({
          setup: {
            model: modelName,
            generationConfig: {
              responseModalities: ["AUDIO"],
            },
            systemInstruction: {
              parts: [
                {
                  text: `You are roleplaying as: ${persona} in scenario "${scenarioTitle}". Speak ONLY natural Japanese suited for JLPT ${level} learner (1-2 short conversational sentences per turn).${
                    openingJp
                      ? ` You opened the conversation by saying: "${openingJp}".`
                      : ""
                  } Continue naturally and keep turns brisk.`,
                },
              ],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : await (event.data as Blob).text();
        const msg = JSON.parse(raw);

        if (msg.setupComplete) {
          setupDone = true;
          callbacks.onStatus("connected", modelName.replace("models/", ""));
          return;
        }

        const sc = msg.serverContent;
        if (!sc) return;

        if (sc.interrupted) {
          stopAllPlayback();
        }

        const inText = sc.inputTranscription?.text;
        if (typeof inText === "string" && inText) {
          userTurnText += inText;
          callbacks.onUserTranscript(userTurnText.trim());
        }

        const outText = sc.outputTranscription?.text;
        if (typeof outText === "string" && outText) {
          assistantTurnText += outText;
          callbacks.onAssistantTranscript(assistantTurnText.trim());
        }

        const parts = sc.modelTurn?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            const inline = part?.inlineData;
            if (inline?.data && typeof inline.mimeType === "string" && inline.mimeType.startsWith("audio/pcm")) {
              enqueuePcmPlayback(inline.data, inline.mimeType);
            }
          }
        }

        if (sc.turnComplete) {
          const finishedUser = userTurnText.trim();
          const finishedAssistant = assistantTurnText.trim();
          userTurnText = "";
          assistantTurnText = "";
          if (finishedUser || finishedAssistant) {
            callbacks.onTurnComplete({
              userText: finishedUser,
              assistantText: finishedAssistant,
            });
          }
        }
      } catch {
        // Ignore malformed partial frame
      }
    };

    ws.onerror = () => {
      if (!closedByUser && !setupDone && candidateIndex + 1 >= LIVE_MODEL_CANDIDATES.length) {
        callbacks.onError("ไม่สามารถเชื่อมต่อ Gemini Live WebSocket ได้ กรุณาตรวจสอบ API Key หรือสิทธิ์โมเดล Live");
      }
    };

    ws.onclose = (ev) => {
      if (closedByUser) {
        cleanup();
        callbacks.onStatus("closed");
        return;
      }
      if (!setupDone && candidateIndex + 1 < LIVE_MODEL_CANDIDATES.length) {
        candidateIndex += 1;
        connectCandidate();
        return;
      }
      cleanup();
      if (!setupDone) {
        callbacks.onError(
          `เชื่อมต่อ Gemini Live ไม่สำเร็จ (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`
        );
      }
      callbacks.onStatus("closed");
    };
  };

  connectCandidate();

  return {
    setMuted: (m: boolean) => {
      muted = m;
    },
    sendText: (text: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN || !setupDone) return;
      userTurnText = text;
      callbacks.onUserTranscript(text);
      ws.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: "user", parts: [{ text }] }],
            turnComplete: true,
          },
        })
      );
    },
    close: () => {
      closedByUser = true;
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close(1000, "User ended live call");
        } else {
          cleanup();
          callbacks.onStatus("closed");
        }
      } catch {
        cleanup();
        callbacks.onStatus("closed");
      }
    },
  };
}
