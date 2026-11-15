"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Mic,
  Play,
  PlusCircle,
  Repeat,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { SHADOWING_SENTENCES, type ShadowingItem } from "@/data/coreCurriculum";
import { PitchAccentChart } from "@/components/PitchAccentChart";
import { speakJapanese, startJapaneseRecognition, stopSpeaking } from "@/lib/speech";
import {
  deleteQueuedShadowing,
  getQueuedShadowing,
  mineCardToSrs,
} from "@/lib/db";
import type { QueuedShadowingRecord } from "@/types/learning";

interface StudioShadowingItem extends ShadowingItem {
  isQueued?: boolean;
}

function toStudioItem(q: QueuedShadowingRecord): StudioShadowingItem {
  return {
    id: q.id,
    title: q.title,
    level: q.level,
    style: q.style,
    japanese: q.japanese,
    reading: q.reading,
    meaningTh: q.meaningTh,
    nuanceTh: q.nuanceTh,
    pitchHighlights: [],
    isQueued: true,
  };
}

export default function ShadowingPage() {
  const [queuedItems, setQueuedItems] = useState<StudioShadowingItem[]>([]);
  const [selected, setSelected] = useState<StudioShadowingItem>(
    SHADOWING_SENTENCES[0]
  );
  const [speed, setSpeed] = useState<number>(0.9);
  const [isLooping, setIsLooping] = useState(false);
  const loopRef = useRef(false);

  // Recording & STT
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [sttTranscript, setSttTranscript] = useState("");
  const [recError, setRecError] = useState<string | null>(null);
  const [minedDone, setMinedDone] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loopRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const targetQueueId = params.get("queueId");
    void getQueuedShadowing().then((rows) => {
      if (!active) return;
      const mapped = rows.map(toStudioItem);
      setQueuedItems(mapped);
      if (targetQueueId) {
        const match = mapped.find((m) => m.id === targetQueueId);
        if (match) setSelected(match);
      }
    });
    return () => {
      active = false;
      loopRef.current = false;
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, []);

  const allItems: StudioShadowingItem[] = [...queuedItems, ...SHADOWING_SENTENCES];

  const handleRemoveQueued = async (id: string) => {
    await deleteQueuedShadowing(id);
    setQueuedItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (selected.id === id) {
        setSelected(next[0] ?? SHADOWING_SENTENCES[0]);
      }
      return next;
    });
  };

  const playNative = async () => {
    await speakJapanese(selected.japanese, { rate: speed });
    if (loopRef.current) {
      setTimeout(() => {
        if (loopRef.current) playNative();
      }, 650);
    }
  };

  const toggleLoop = () => {
    if (isLooping) {
      setIsLooping(false);
      loopRef.current = false;
      stopSpeaking();
    } else {
      setIsLooping(true);
      loopRef.current = true;
      speakJapanese(selected.japanese, { rate: speed }).then(() => {
        if (loopRef.current) {
          setTimeout(() => {
            if (loopRef.current) playNative();
          }, 650);
        }
      });
    }
  };

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
  };

  const startRecording = async () => {
    setRecError(null);
    setSttTranscript("");
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecError("เบราว์เซอร์นี้ไม่รองรับการอัดเสียงผ่านไมโครโฟน");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = getSupportedMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const resolvedType =
          recorder.mimeType ||
          chunksRef.current[0]?.type ||
          preferredMime ||
          "audio/webm";
        const blob = new Blob(chunksRef.current, { type: resolvedType });
        if (blob.size === 0) {
          setRecError("ไม่พบข้อมูลเสียงที่บันทึก กรุณากดอัดค้างไว้สักครู่ขณะพูดแล้วลองใหม่ครับ");
          return;
        }
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Optional live STT verification
      recognitionRef.current = startJapaneseRecognition({
        onResult: (text) => setSttTranscript(text),
        onError: () => {
          // Audio recording still works even if browser lacks SpeechRecognition
        },
      });
    } catch {
      setRecError("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาตรวจสอบสิทธิ์ไมโครโฟนในเบราว์เซอร์");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const handleCompare = async () => {
    setRecError(null);
    await speakJapanese(selected.japanese, { rate: speed });
    const audioEl = audioElRef.current;
    if (audioEl && recordedUrl) {
      try {
        audioEl.currentTime = 0;
        await audioEl.play();
      } catch {
        setRecError("เบราว์เซอร์ไม่สามารถเล่นเสียงที่บันทึกได้ ลองกดปุ่ม Play บนแถบเสียงด้านซ้ายโดยตรงครับ");
      }
    }
  };

  const handleMine = async () => {
    await mineCardToSrs({
      front: selected.japanese,
      reading: selected.reading,
      meaningTh: selected.meaningTh,
      mnemonic: selected.nuanceTh,
      cardType: "sentence",
      tags: ["Shadowing", selected.level, selected.style],
    });
    setMinedDone(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-primary uppercase tracking-wider">
          Phase 4a • Acoustic Mirroring & Pitch Accent Control
        </div>
        <h1 className="text-2xl font-bold mt-0.5">Shadowing & Pitch Accent Studio</h1>
        <p className="text-sm text-foreground/70 mt-1">
          ฝึกพูดตามเงาเสียงเจ้าของภาษาทันทีเพื่อสร้างจังหวะ Mora และหางเสียงที่ฟังดูเป็นธรรมชาติ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentence List */}
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-foreground/60 uppercase px-1">
            เลือกประโยคฝึกพูด ({allItems.length} ประโยค)
          </div>
          {allItems.map((item) => {
            const active = selected.id === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setIsLooping(false);
                    loopRef.current = false;
                    stopSpeaking();
                    setSelected(item);
                    if (recordedUrl) {
                      URL.revokeObjectURL(recordedUrl);
                    }
                    setRecordedUrl(null);
                    setRecError(null);
                    setSttTranscript("");
                    setMinedDone(false);
                  }}
                  className={`w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-surface hover:bg-surface-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                    <span className="font-semibold text-primary truncate inline-flex items-center gap-1">
                      {item.isQueued && <Bookmark className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{item.title}</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-muted text-foreground/70 shrink-0">
                      {item.level}
                    </span>
                  </div>
                  <div className="font-jp text-sm font-medium line-clamp-1">
                    {item.japanese}
                  </div>
                  <div className="text-[11px] text-foreground/60 mt-0.5">{item.style}</div>
                </button>
                {item.isQueued && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveQueued(item.id)}
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-surface border border-border text-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    title="ลบออกจากคิว"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Studio Player & Recorder */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-7 space-y-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold">
                  {selected.level}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-surface-muted text-foreground/75 font-medium">
                  {selected.style}
                </span>
              </div>

              <button
                type="button"
                onClick={handleMine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-muted text-xs font-medium cursor-pointer"
              >
                {minedDone ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-matcha" />
                    <span className="text-matcha">บันทึกเข้า FSRS แล้ว</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5 text-primary" />
                    <span>+ Mine ประโยคนี้</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="font-jp text-2xl sm:text-3xl font-bold leading-relaxed">
                {selected.japanese}
              </h2>
              <p className="font-jp text-sm text-primary">{selected.reading}</p>
              <p className="text-base text-foreground/85">{selected.meaningTh}</p>
            </div>

            <div className="rounded-xl bg-gold/5 border border-gold/25 p-3.5 text-xs text-foreground/80 leading-relaxed">
              <strong className="text-gold">เคล็ดลับความธรรมชาติ:</strong>{" "}
              {selected.nuanceTh}
            </div>

            {/* Pitch Highlights */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground/60">
                จุดสังเกต Pitch Accent ในประโยคนี้:
              </div>
              <div className="flex flex-wrap gap-4">
                {selected.pitchHighlights.map((ph) => (
                  <div
                    key={ph.word}
                    className="rounded-xl border border-border bg-background p-3 space-y-1"
                  >
                    <div className="font-jp text-sm font-bold">{ph.word}</div>
                    <PitchAccentChart
                      reading={ph.reading}
                      pitch={ph.pitch}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => speakJapanese(selected.japanese, { rate: speed })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>ฟังเสียงต้นฉบับ</span>
              </button>

              <button
                type="button"
                onClick={toggleLoop}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium cursor-pointer ${
                  isLooping
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface hover:bg-surface-muted"
                }`}
              >
                <Repeat className="w-4 h-4" />
                <span>{isLooping ? "หยุด Loop" : "เล่นวนซ้ำ (Shadowing)"}</span>
              </button>

              <div className="flex items-center gap-1 ml-auto bg-surface-muted p-1 rounded-xl">
                {[0.7, 0.85, 1.0].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSpeed(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer ${
                      speed === r
                        ? "bg-surface text-foreground shadow-xs font-bold"
                        : "text-foreground/65"
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Record & Compare Panel */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">อัดเสียงพูดของคุณ & เทียบกับต้นฉบับ</h3>
                <p className="text-xs text-foreground/65">
                  กดอัดเสียง แล้วพูดตามให้ทันจังหวะจากนั้นฟังเทียบทันที
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium cursor-pointer hover:opacity-95"
                >
                  <Mic className="w-4 h-4" />
                  <span>เริ่มอัดเสียงพูด</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium animate-pulse cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  <span>หยุดอัดเสียง</span>
                </button>
              )}

              {recordedUrl && (
                <>
                  <audio
                    ref={audioElRef}
                    controls
                    src={recordedUrl}
                    onError={() =>
                      setRecError("รูปแบบเสียงที่บันทึกไม่รองรับบนเบราว์เซอร์นี้ กรุณาลองอัดใหม่อีกครั้ง")
                    }
                    className="h-10 max-w-full"
                  />
                  <button
                    type="button"
                    onClick={handleCompare}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-semibold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>เล่นเทียบ ต้นฉบับ &rarr; เสียงเรา</span>
                  </button>
                </>
              )}
            </div>

            {sttTranscript && (
              <div className="rounded-xl bg-surface-muted p-3.5 text-sm space-y-1">
                <div className="text-xs text-foreground/60">
                  สิ่งที่ระบบฟังได้จากเสียงของคุณ (Speech-to-Text):
                </div>
                <div className="font-jp font-semibold text-primary">
                  {sttTranscript}
                </div>
              </div>
            )}

            {recError && (
              <div className="text-xs text-accent bg-accent/10 rounded-xl px-3 py-2">
                {recError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
