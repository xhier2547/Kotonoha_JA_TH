import {
  parseDialogueTurns,
  type DialogueTurn,
  type SpeakerGender,
} from "@/lib/dialogueParser";

let activeDialogueSessionId = 0;

export interface JapaneseSpeechCapabilities {
  supported: boolean;
  voiceCount: number;
  hasMultipleVoices: boolean;
  voiceNames: string[];
}

export function getJapaneseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("ja"));
}

export function getJapaneseSpeechCapabilities(): JapaneseSpeechCapabilities {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return {
      supported: false,
      voiceCount: 0,
      hasMultipleVoices: false,
      voiceNames: [],
    };
  }
  const voices = getJapaneseVoices();
  return {
    supported: true,
    voiceCount: voices.length,
    hasMultipleVoices: voices.length >= 2,
    voiceNames: voices.map((v) => v.name),
  };
}

/** Waits briefly for async browser speechSynthesis voices when initially empty. */
export function waitForJapaneseVoices(timeoutMs = 700): Promise<SpeechSynthesisVoice[]> {
  const immediate = getJapaneseVoices();
  if (
    immediate.length > 0 ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    let settled = false;
    const synth = window.speechSynthesis;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.("voiceschanged", onVoices);
      resolve(getJapaneseVoices());
    };
    const onVoices = () => finish();
    synth.addEventListener?.("voiceschanged", onVoices);
    setTimeout(finish, timeoutMs);
  });
}

export function stopSpeaking(): void {
  activeDialogueSessionId += 1;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function pickVoiceForGender(
  voices: SpeechSynthesisVoice[],
  gender: SpeakerGender,
  preferredVoiceName?: string
): { voice?: SpeechSynthesisVoice; pitch: number } {
  if (voices.length === 0) {
    return { pitch: gender === "female" ? 1.12 : gender === "male" ? 0.88 : 1.0 };
  }

  const femaleVoice =
    voices.find((v) => /nanami|kyoko|haruka|o-ren|sayaka|ayumi/i.test(v.name)) ||
    (preferredVoiceName ? voices.find((v) => v.name === preferredVoiceName) : undefined);
  const maleVoice = voices.find((v) => /keita|otoya|ichiro|hattori|daichi/i.test(v.name));

  if (gender === "female") {
    return {
      voice: femaleVoice || voices[0],
      pitch: femaleVoice ? 1.05 : 1.16,
    };
  }
  if (gender === "male") {
    const fallbackSecond = voices.length > 1 ? voices[1] : voices[0];
    return {
      voice: maleVoice || fallbackSecond,
      pitch: maleVoice ? 0.95 : 0.82,
    };
  }

  const narrator =
    (preferredVoiceName ? voices.find((v) => v.name === preferredVoiceName) : undefined) ||
    voices.find((v) => /nanami|keita|google|kyoko|otoya|haruka/i.test(v.name)) ||
    voices[0];
  return { voice: narrator, pitch: 1.0 };
}

function speakSingleUtterance(
  text: string,
  options?: { rate?: number; voice?: SpeechSynthesisVoice; pitch?: number }
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const clean = text.trim();
    if (!clean) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "ja-JP";
    utterance.rate = options?.rate ?? 0.95;
    utterance.pitch = options?.pitch ?? 1.0;
    if (options?.voice) {
      utterance.voice = options.voice;
    }
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakJapanese(
  text: string,
  options?: { rate?: number; voiceName?: string; pitch?: number }
): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  stopSpeaking();
  const voices = await waitForJapaneseVoices();
  const voice =
    (options?.voiceName ? voices.find((v) => v.name === options.voiceName) : undefined) ||
    voices.find((v) => /nanami|keita|google|kyoko|otoya|haruka/i.test(v.name)) ||
    voices[0];

  return speakSingleUtterance(text, {
    rate: options?.rate,
    pitch: options?.pitch,
    voice,
  });
}

/**
 * Plays a multi-turn dialogue script (or array of explicit DialogueTurn items),
 * stripping speaker labels (`男：`, `女：`, etc.) and switching voice/pitch per speaker.
 */
export async function speakJapaneseDialogue(
  scriptOrTurns: string | DialogueTurn[],
  options?: {
    rate?: number;
    voiceName?: string;
    onTurnChange?: (turnIndex: number, turn: DialogueTurn) => void;
    onDone?: () => void;
  }
): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  stopSpeaking();
  const mySessionId = activeDialogueSessionId;
  const turns =
    typeof scriptOrTurns === "string" ? parseDialogueTurns(scriptOrTurns) : scriptOrTurns;
  const voices = await waitForJapaneseVoices();

  for (let i = 0; i < turns.length; i++) {
    if (activeDialogueSessionId !== mySessionId) return;
    const turn = turns[i];
    options?.onTurnChange?.(i, turn);
    const { voice, pitch } = pickVoiceForGender(voices, turn.gender, options?.voiceName);
    await speakSingleUtterance(turn.text, {
      rate: options?.rate ?? 0.95,
      voice,
      pitch,
    });
    if (activeDialogueSessionId !== mySessionId) return;
    await new Promise((r) => setTimeout(r, 180));
  }

  if (activeDialogueSessionId === mySessionId) {
    options?.onDone?.();
  }
}

export interface SpeechRecognitionHandle {
  stop: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startJapaneseRecognition(callbacks: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}): SpeechRecognitionHandle | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const SpeechRecCtor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
    | (new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
        onerror: ((ev: { error: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      })
    | undefined;

  if (!SpeechRecCtor) {
    callbacks.onError?.("เบราว์เซอร์นี้ยังไม่รองรับ Speech Recognition (แนะนำ Chrome / Edge)");
    return null;
  }

  const recognition = new SpeechRecCtor();
  recognition.lang = "ja-JP";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    let combined = "";
    let isFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      const res = event.results[i];
      combined += res[0]?.transcript ?? "";
      if (res.isFinal) isFinal = true;
    }
    callbacks.onResult(combined.trim(), isFinal);
  };

  recognition.onerror = (event) => {
    callbacks.onError?.(
      event.error === "not-allowed"
        ? "ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน กรุณากดอนุญาตในเบราว์เซอร์"
        : `เกิดข้อผิดพลาดในการฟังเสียง: ${event.error}`
    );
  };

  recognition.onend = () => {
    callbacks.onEnd?.();
  };

  recognition.start();
  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // ignore if already stopped
      }
    },
  };
}
