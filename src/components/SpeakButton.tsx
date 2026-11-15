"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { speakJapanese } from "@/lib/speech";
import { getAppSettings } from "@/lib/db";

interface SpeakButtonProps {
  text: string;
  rate?: number;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function SpeakButton({
  text,
  rate,
  label,
  size = "sm",
  className = "",
}: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSpeaking(true);
    try {
      const settings = await getAppSettings();
      await speakJapanese(text, {
        rate: rate ?? settings.speechRate,
        voiceName: settings.preferredVoiceName || undefined,
      });
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted transition-colors cursor-pointer ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${speaking ? "border-primary text-primary" : "text-foreground/80"} ${className}`}
      title="ฟังเสียงภาษาญี่ปุ่น"
    >
      <Volume2 className={`${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} ${speaking ? "animate-pulse" : ""}`} />
      {label && <span>{label}</span>}
    </button>
  );
}
