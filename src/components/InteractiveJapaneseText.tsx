"use client";

import { useEffect, useState } from "react";
import type { TokenizedWord } from "@/types/learning";

const tokenCache = new Map<string, TokenizedWord[]>();
const inflightMap = new Map<string, Promise<TokenizedWord[]>>();

async function tokenizeCached(text: string): Promise<TokenizedWord[]> {
  const existing = tokenCache.get(text);
  if (existing) return existing;

  const inflight = inflightMap.get(text);
  if (inflight) return inflight;

  const promise = fetch("/api/tokenize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
    .then(async (res) => {
      if (!res.ok) return [] as TokenizedWord[];
      const json = (await res.json()) as { tokens?: TokenizedWord[] };
      const list = json.tokens ?? [];
      if (list.length > 0) {
        tokenCache.set(text, list);
      }
      return list;
    })
    .catch(() => [] as TokenizedWord[])
    .finally(() => {
      inflightMap.delete(text);
    });

  inflightMap.set(text, promise);
  return promise;
}

interface InteractiveJapaneseTextProps {
  text: string;
  showFurigana: boolean;
  knownFronts?: Set<string>;
  selectedWord?: string | null;
  onWordClick?: (tok: TokenizedWord, sentenceContext: string) => void;
  /** Optional target substring wrapped in 【...】 in question prompt to render underline without leaking reading */
  maskTargetReading?: boolean;
  className?: string;
}

function annotateTokens(list: TokenizedWord[]) {
  const result: { tok: TokenizedWord; isBracket: boolean; isTargetWord: boolean }[] = [];
  let inBracket = false;
  for (const tok of list) {
    if (tok.surface === "【") {
      inBracket = true;
      result.push({ tok, isBracket: true, isTargetWord: false });
      continue;
    }
    if (tok.surface === "】") {
      inBracket = false;
      result.push({ tok, isBracket: true, isTargetWord: false });
      continue;
    }
    result.push({ tok, isBracket: false, isTargetWord: inBracket });
  }
  return result;
}

export function InteractiveJapaneseText({
  text,
  showFurigana,
  knownFronts,
  selectedWord,
  onWordClick,
  maskTargetReading = false,
  className = "",
}: InteractiveJapaneseTextProps) {
  const cached = tokenCache.get(text) ?? null;
  const [tokens, setTokens] = useState<TokenizedWord[] | null>(cached);

  useEffect(() => {
    if (!text.trim()) return;
    if (tokenCache.has(text)) return;
    let active = true;
    void tokenizeCached(text).then((list) => {
      if (active && list.length > 0) {
        setTokens(list);
      }
    });
    return () => {
      active = false;
    };
  }, [text]);

  const activeTokens = cached ?? tokens;

  if (!activeTokens || activeTokens.length === 0) {
    return <span className={`font-jp ${className}`}>{text}</span>;
  }

  const annotated = annotateTokens(activeTokens);

  return (
    <span className={`font-jp leading-[2.1] ${className}`}>
      {annotated.map(({ tok, isBracket, isTargetWord }, idx) => {
        if (isBracket) {
          return (
            <span key={idx} className="text-primary/70 font-normal">
              {" "}
            </span>
          );
        }

        const shouldShowRuby =
          showFurigana &&
          tok.hasKanji &&
          tok.readingHiragana &&
          tok.readingHiragana !== tok.surface &&
          !(maskTargetReading && isTargetWord);

        const isKnown =
          knownFronts?.has(tok.basicForm) || knownFronts?.has(tok.surface);
        const isSelected =
          Boolean(selectedWord) &&
          (selectedWord === tok.surface || selectedWord === tok.basicForm);

        const isNewline = tok.surface.includes("\n");
        if (isNewline) {
          return <br key={idx} />;
        }

        const isPunct =
          tok.pos === "記号" ||
          /^[。、！？「」（）()・\s＿★]+$/.test(tok.surface);

        if (isPunct || !onWordClick) {
          return (
            <span
              key={idx}
              className={
                isTargetWord
                  ? "underline decoration-2 decoration-primary underline-offset-4 font-bold text-primary"
                  : ""
              }
            >
              {shouldShowRuby ? (
                <ruby>
                  {tok.surface}
                  <rt className="text-foreground/65">{tok.readingHiragana}</rt>
                </ruby>
              ) : (
                tok.surface
              )}
            </span>
          );
        }

        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWordClick(tok, text);
            }}
            title="คลิกดูความหมายและเก็บเข้าคลังคำศัพท์"
            className={`inline-block rounded px-[1px] transition-colors cursor-pointer text-left ${
              isTargetWord
                ? "underline decoration-2 decoration-primary underline-offset-4 font-bold text-primary bg-primary/5"
                : ""
            } ${
              isSelected
                ? "bg-primary/20 text-primary ring-1 ring-primary"
                : isKnown && tok.isContentWord
                  ? "hover:bg-matcha/15 border-b border-dotted border-matcha/50"
                  : tok.isContentWord
                    ? "hover:bg-primary/10 border-b border-dotted border-primary/35"
                    : "hover:bg-surface-muted"
            }`}
          >
            {shouldShowRuby ? (
              <ruby>
                {tok.surface}
                <rt className="text-foreground/65">{tok.readingHiragana}</rt>
              </ruby>
            ) : (
              tok.surface
            )}
          </button>
        );
      })}
    </span>
  );
}
