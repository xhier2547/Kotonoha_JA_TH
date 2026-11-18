"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toHiragana } from "wanakana";
import {
  Bot,
  Check,
  Languages,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Plus,
  PlusCircle,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  User,
  Volume2,
  X,
} from "lucide-react";
import {
  clearKaiwaHistory,
  deleteCustomScenario,
  enqueueShadowing,
  getAppSettings,
  getCustomScenarios,
  getKaiwaHistory,
  mineCardToSrs,
  saveCustomScenario,
  saveKaiwaHistory,
} from "@/lib/db";
import { PitchAccentChart } from "@/components/PitchAccentChart";
import { SpeakButton } from "@/components/SpeakButton";
import { VocabVisualCard, hasBuiltInVisual } from "@/components/VocabVisualCard";
import { StudyPageHero } from "@/components/StudyPageHero";
import { TextShimmer } from "@/components/ui21/TextShimmer";
import { VoiceWaveOrb } from "@/components/ui21/VoiceWaveOrb";
import { startGeminiLiveSession, type GeminiLiveSession } from "@/lib/geminiLive";
import {
  fetchJapaneseReading,
  fetchJapaneseTokens,
  translateJaToTh,
  warmupLocalTranslator,
} from "@/lib/localTranslate";
import { findKanjiMatches, findVocabMatch } from "@/lib/vocabLookup";
import {
  isSpeechRecognitionSupported,
  speakJapanese,
  startJapaneseRecognition,
} from "@/lib/speech";
import type {
  AppSettings,
  CustomScenarioRecord,
  StoredKaiwaMessage,
  TokenizedWord,
} from "@/types/learning";

interface Scenario {
  id: string;
  title: string;
  style: string;
  level: "N5" | "N4" | "N3";
  persona: string;
  openingJp: string;
  openingReading: string;
  openingTh: string;
  isCustom?: boolean;
  offlineTurns: {
    userHintJp: string;
    userHintTh: string;
    replyJp: string;
    replyReading: string;
    replyTh: string;
    naturalTip: string;
  }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "ramen",
    title: "สั่งราเมงร้านดังในโตเกียว",
    style: "สุภาพ (丁寧語)",
    level: "N5",
    persona: "พนักงานร้านราเมงใจดีในโตเกียว",
    openingJp: "いらっしゃいませ！何名様ですか？",
    openingReading: "いらっしゃいませ！なんめいさまですか？",
    openingTh: "ยินดีต้อนรับครับ! กี่ท่านดีครับ?",
    offlineTurns: [
      {
        userHintJp: "一人です。",
        userHintTh: "1 คนครับ",
        replyJp: "一名様ですね。カウンター席へどうぞ！ご注文はお決まりですか？",
        replyReading: "いちめいさまですね。かうんたーせきへどうぞ！ごちゅうもんはおきまりですか？",
        replyTh: "1 ท่านนะครับ เชิญนั่งที่เคาน์เตอร์ได้เลยครับ! ตัดสินใจเรื่องออเดอร์หรือยังครับ?",
        naturalTip: "เวลาบอกจำนวนคน 1 คน ใช้ ひとり (hitori), 2 คน ใช้ ふたり (futari)",
      },
      {
        userHintJp: "おすすめのラーメンを一つお願いします。",
        userHintTh: "ขอราเมงเมนูแนะนำ 1 ชามครับ",
        replyJp: "かしこまりました！濃厚豚骨ラーメンですね。麺の硬さはどうしますか？",
        replyReading: "かしこまりました！のうこうとんこつらーめんですね。めんのかたさはどうしますか？",
        replyTh: "รับทราบครับ! ทงคตสึราเมงเข้มข้นนะครับ ความแข็งของเส้นเอาแบบไหนดีครับ?",
        naturalTip: "ใช้ ～をお願いします แทน ～をください จะฟังดูนุ่มนวลและเป็นธรรมชาติแบบผู้ใหญ่",
      },
      {
        userHintJp: "普通で大丈夫です。あと、お水もください。",
        userHintTh: "เอาแบบธรรมดาก็พอครับ แล้วก็ขอน้ำเปล่าด้วยครับ",
        replyJp: "はーい、普通ですね！お水もお持ちします。少々お待ちください。",
        replyReading: "はーい、ふつうですね！おみずもおもちします。しょうしょうおまちください。",
        replyTh: "ได้เลยครับ แบบธรรมดานะครับ! เดี๋ยวเอาน้ำมาเสิร์ฟด้วย รอสักครู่นะครับ",
        naturalTip: "คำว่า ～で大丈夫です / ～でいいです ใช้ตอบเลือกตัวเลือกเวลาพนักงานถามได้สารพัด!",
      },
    ],
  },
  {
    id: "friend",
    title: "คุยเล่นกับเพื่อนคนญี่ปุ่น (タメ口)",
    style: "กันเอง (タメ口)",
    level: "N4",
    persona: "เพื่อนคนญี่ปุ่นชื่อยูโตะ อายุรุ่นเดียวกัน ชอบอนิเมะและคาเฟ่",
    openingJp: "おー、久しぶり！最近、日本語の勉強どう？",
    openingReading: "おー、ひさしぶり！さいきん、にほんごのべんきょうどう？",
    openingTh: "โอ้ ไม่เจอกันนานเลย! ช่วงนี้เรียนภาษาญี่ปุ่นเป็นไงบ้าง?",
    offlineTurns: [
      {
        userHintJp: "まだ難しいけど、毎日少しずつ頑張ってるよ！",
        userHintTh: "ยังยากอยู่ แต่ก็พยายามวันละนิดทุกวันนะ!",
        replyJp: "へえ、すごいじゃん！日本のドラマとかアニメも見てるの？",
        replyReading: "へえ、すごいじゃん！にほんのどらまとかあにめもみてるの？",
        replyTh: "เฮ้ย สุดยอดเลยนี่! ได้ดูซีรีส์หรืออนิเมะญี่ปุ่นด้วยป่ะ?",
        naturalTip: "กับเพื่อนสนิท ลด ている เป็น てる และลงท้าย ～よ หรือ ～の แทน です/ます",
      },
      {
        userHintJp: "うん、よく見てる！やっぱりリスニングが一番難しいなあ。",
        userHintTh: "อื้อ ดูบ่อยเลย! การฟังนี่แหละที่ยากที่สุดเลยแฮะ",
        replyJp: "わかるわかる！でも毎日聞いてたら、絶対に慣れるよ。今度一緒にカフェで話そうよ！",
        replyReading: "わかるわかる！でもまいにちきいてたら、ぜったいになれるよ。こんどいっしょにかふぇではなそうよ！",
        replyTh: "เข้าใจเลยๆ! แต่ถ้าฟังทุกวันเดี๋ยวก็ชินแน่นอน วันหลังไปนั่งคุยกันที่คาเฟ่เถอะ!",
        naturalTip: "พูดว่า わかるわかる！ (เข้าใจเลย!) ช่วยให้บทสนทนาไหลลื่นเหมือนเพื่อนญี่ปุ่นจริงๆ",
      },
    ],
  },
  {
    id: "station",
    title: "ถามทางที่สถานีรถไฟ",
    style: "สุภาพ (丁寧語)",
    level: "N5",
    persona: "นายสถานีรถไฟในชินจูกุที่ช่วยเหลือดีมาก",
    openingJp: "どうされましたか？何かお探しですか？",
    openingReading: "どうされましたか？なにかおさがしですか？",
    openingTh: "มีอะไรให้ช่วยไหมครับ? กำลังมองหาอะไรอยู่หรือเปล่าครับ?",
    offlineTurns: [
      {
        userHintJp: "すみません、渋谷へ行きたいんですが、何番線ですか？",
        userHintTh: "ขอโทษนะครับ พอดีอยากไปชิบุย่า ต้องขึ้นชานชาลาไหนเหรอครับ?",
        replyJp: "渋谷ですね。山手線の内回り、１４番線ですよ。あちらの階段を上ってください。",
        replyReading: "しぶやですね。やまのてせんのうちまわり、じゅうよんばんせんですよ。あちらのかいだんをのぼってください。",
        replyTh: "ชิบุย่านะครับ สายยามาโนเตะวนใน ชานชาลา 14 ครับ เดินขึ้นบันไดตรงนั้นไปได้เลยครับ",
        naturalTip: "เวลาขอความช่วยเหลือ เริ่มด้วย すみません + เหตุผล + ～んですが จะสุภาพและได้คำตอบเร็วมาก",
      },
      {
        userHintJp: "なるほど、１４番線ですね。ありがとうございます！",
        userHintTh: "อ๋อ ชานชาลา 14 นะครับ ขอบคุณมากครับ!",
        replyJp: "はい、気をつけて行ってらっしゃいませ！",
        replyReading: "はい、きをつけていってらっしゃいませ！",
        replyTh: "ครับ เดินทางปลอดภัยนะครับ!",
        naturalTip: "ทวนข้อมูลสำคัญ (１４番線ですね) ก่อนขอบคุณ เป็นมารยาทสื่อสารที่คนญี่ปุ่นชอบมาก",
      },
    ],
  },
  {
    id: "conbini",
    title: "จ่ายเงินที่ร้านสะดวกซื้อ (コンビニ)",
    style: "สุภาพ (丁寧語)",
    level: "N5",
    persona: "พนักงานร้านสะดวกซื้อ 7-Eleven ในโตเกียวที่พูดคล่องและสุภาพ",
    openingJp: "いらっしゃいませ！お弁当は温めますか？",
    openingReading: "いらっしゃいませ！おべんとうはあたためますか？",
    openingTh: "ยินดีต้อนรับครับ! ข้าวกล่องรับอุ่นด้วยไหมครับ?",
    offlineTurns: [
      {
        userHintJp: "はい、お願いします。",
        userHintTh: "ครับ รบกวนอุ่นด้วยครับ",
        replyJp: "かしこまりました。レジ袋はご利用ですか？",
        replyReading: "かしこまりました。れじぶくろはごりようですか？",
        replyTh: "รับทราบครับ รับถุงพลาสติกด้วยไหมครับ?",
        naturalTip: "ตอบรับให้ช่วยอุ่นหรือบริการต่างๆ ใช้ はい、お願いします จำง่ายและสุภาพที่สุด",
      },
      {
        userHintJp: "大丈夫です。あ、Suicaでお願いします。",
        userHintTh: "ไม่เป็นไรครับ (ไม่รับถุง) อ้อ ขอจ่ายด้วยบัตร Suica ครับ",
        replyJp: "はい、こちらの端末にタッチしてください。ありがとうございました！",
        replyReading: "はい、こちらのたんまつにたっちしてください。ありがとうございました！",
        replyTh: "ครับ แตะบัตรที่เครื่องตรงนี้ได้เลยครับ ขอบคุณที่ใช้บริการครับ!",
        naturalTip: "เวลาปฏิเสธถุงพูดสั้นๆ ว่า 大丈夫です (ไม่เอา/ไม่เป็นไรครับ) แล้วบอกวิธีจ่ายด้วย ～でお願いします",
      },
    ],
  },
  {
    id: "hotel",
    title: "เช็คอินโรงแรมที่เกียวโต",
    style: "สุภาพ (丁寧語)",
    level: "N4",
    persona: "พนักงานต้อนรับโรงแรมเรียวกังในเกียวโต",
    openingJp: "ようこそお越しくださいました。ご予約のお名前をお願いします。",
    openingReading: "ようこそおこしくださいました。ごよやくのおなまえをおねがいします。",
    openingTh: "ยินดีต้อนรับสู่โรงแรมครับ ขอทราบชื่อที่จองไว้ด้วยครับ",
    offlineTurns: [
      {
        userHintJp: "タナカです。二泊予約しています。",
        userHintTh: "ทานากะครับ จองไว้ 2 คืนครับ",
        replyJp: "タナカ様ですね。確認できました！パスポートをお借りできますか？",
        replyReading: "たなかさまですね。かくにんできました！ぱすぽーとをおかりできますか？",
        replyTh: "คุณทานากะนะครับ ตรวจสอบพบแล้วครับ! ขอดูพาสปอร์ตสักครู่ได้ไหมครับ?",
        naturalTip: "～泊 (はく/ぱく) ใช้บอกจำนวนคืนที่พัก เช่น 1 คืน 一泊, 2 คืน 二泊",
      },
      {
        userHintJp: "はい、どうぞ。朝食は何時からですか？",
        userHintTh: "นี่ครับ อาหารเช้าเริ่มกี่โมงเหรอครับ?",
        replyJp: "朝食は朝七時から九時半まででございます。ごゆっくりどうぞ！",
        replyReading: "ちょうしょくはあさしちじからくじはんまででございます。ごゆっくりどうぞ！",
        replyTh: "อาหารเช้าเปิดตั้งแต่ 7 โมงถึง 9 โมงครึ่งครับ เชิญพักผ่อนตามสบายนะครับ!",
        naturalTip: "เวลาพนักงานบอกเวลาใช้ ～から～まで และลงท้ายด้วย でございます (รูปสุภาพมากของ です)",
      },
    ],
  },
  {
    id: "anime-cafe",
    title: "คุยเรื่องอนิเมะ & คาเฟ่ (オタク仲間)",
    style: "กันเอง (タメ口)",
    level: "N4",
    persona: "เพื่อนโอตาคุสายอนิเมะและเกมญี่ปุ่นที่คุยสนุกเป็นกันเอง",
    openingJp: "最近めっちゃ面白いアニメ見つけたんだ！普段どんなアニメ見るの？",
    openingReading: "さいきんめっちゃおもしろいあにめみつけたんだ！ふだんどんなあにめみるの？",
    openingTh: "ช่วงนี้ฉันเจอเมะโคตรสนุกเรื่องนึงด้วย! ปกตินายดูเมะแนวไหนอะ?",
    offlineTurns: [
      {
        userHintJp: "バトル系とか日常系がよく見るよ！おすすめある？",
        userHintTh: "ดูแนวต่อสู้กับแนวชีวิตประจำวันบ่อยนะ! มีเรื่องแนะนำไหม?",
        replyJp: "それなら今期のあの作品が神作画でやばいよ！主題歌も最高なの。",
        replyReading: "それならこんきのあのさくひんがかみさくがでやばいよ！しゅだいかもさいこうなの。",
        replyTh: "งั้นเรื่องนั้นของซีซั่นนี้งานภาพเทพโคตรๆ เลยนะ! เพลงเปิดก็โคตรดีด้วย",
        naturalTip: "今期 (こんき) = ซีซั่นนี้, 神作画 (かみさくが) = งานภาพระดับเทพ, 推し = เมน/ตัวอวย",
      },
    ],
  },
];

interface ChatMsg extends StoredKaiwaMessage {
  translating?: boolean;
}

function toScenarioFromCustom(c: CustomScenarioRecord): Scenario {
  return {
    id: c.id,
    title: c.title,
    style: c.style,
    level: c.level,
    persona: c.persona,
    openingJp: c.openingJp,
    openingReading: c.openingReading,
    openingTh: c.openingTh,
    isCustom: true,
    offlineTurns: [
      {
        userHintJp: "なるほど、もっと詳しく教えてください。",
        userHintTh: "อ๋อ ช่วยเล่าเพิ่มเติมอีกหน่อยได้ไหมครับ",
        replyJp: "もちろんです！他にはどんなことが気になりますか？",
        replyReading: "もちろん！ほかにはどんなことがきになりますか？",
        replyTh: "ได้เลยครับ! มีเรื่องอื่นที่อยากรู้อีกไหมครับ?",
        naturalTip: "หากเล่นในสถานการณ์สร้างเอง แนะนำเปิดโหมด Gemini Live เพื่อคุยอิสระตามบทบาทนี้ครับ",
      },
    ],
  };
}

export default function KaiwaPage() {
  const router = useRouter();
  const [customScenarios, setCustomScenarios] = useState<Scenario[]>([]);
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    {
      id: `open-${SCENARIOS[0].id}`,
      role: "assistant",
      textJp: SCENARIOS[0].openingJp,
      reading: SCENARIOS[0].openingReading,
      textTh: SCENARIOS[0].openingTh,
    },
  ]);
  const [showFurigana, setShowFurigana] = useState(true);
  const [selectedToken, setSelectedToken] = useState<{
    tok: TokenizedWord;
    sentenceJp: string;
    sentenceTh?: string;
  } | null>(null);
  const [wordLocalMeaning, setWordLocalMeaning] = useState<string | null>(null);
  const [wordTranslating, setWordTranslating] = useState(false);
  const [wordMined, setWordMined] = useState(false);

  const [showCreateScenario, setShowCreateScenario] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPersona, setNewPersona] = useState("");
  const [newStyle, setNewStyle] = useState("สุภาพ (丁寧語)");
  const [newLevel, setNewLevel] = useState<"N5" | "N4" | "N3">("N4");
  const [newOpeningJp, setNewOpeningJp] = useState("こんにちは！よろしくお願いします。");
  const [newOpeningTh, setNewOpeningTh] = useState("สวัสดีครับ/ค่ะ ยินดีที่ได้คุยกันนะ!");

  const [input, setInput] = useState("");
  const [useIme, setUseIme] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [offlineStep, setOfflineStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [loadingSec, setLoadingSec] = useState(0);
  const [minedIds, setMinedIds] = useState<Set<string>>(new Set());

  // Gemini Live WebSocket Voice Call state
  const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [liveModelName, setLiveModelName] = useState<string>("");
  const [liveMuted, setLiveMuted] = useState(false);
  const [liveDraftUser, setLiveDraftUser] = useState("");
  const [liveDraftAi, setLiveDraftAi] = useState("");

  const recRef = useRef<{ stop: () => void } | null>(null);
  const liveSessionRef = useRef<GeminiLiveSession | null>(null);
  const loadedHistoryIdRef = useRef<string | null>(null);
  const msgSeqRef = useRef(0);
  const nextMsgId = (prefix: string) => {
    msgSeqRef.current += 1;
    return `${prefix}-${msgSeqRef.current}`;
  };
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const speechSupported = useSyncExternalStore(
    () => () => {},
    () => isSpeechRecognitionSupported(),
    () => false
  );

  const enrichMessageTokens = (msgId: string, jpText: string) => {
    if (!jpText.trim()) return;
    void fetchJapaneseTokens(jpText).then((tokens) => {
      if (tokens.length === 0) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, tokens } : m))
      );
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [s, customList] = await Promise.all([
        getAppSettings(),
        getCustomScenarios(),
      ]);
      const targetScenarioLevel =
        s.learnerLevel === "N4"
          ? "N4"
          : s.learnerLevel === "N3" || s.learnerLevel === "N2" || s.learnerLevel === "N1"
            ? "N3"
            : "N5";
      const initialScenario =
        SCENARIOS.find((item) => item.level === targetScenarioLevel) ?? SCENARIOS[0];
      const savedMsgs = await getKaiwaHistory(initialScenario.id);
      if (!active) return;
      setSettings(s);
      setCustomScenarios(customList.map(toScenarioFromCustom));
      setScenario(initialScenario);
      setShowFurigana(s.furiganaMode !== "off");
      loadedHistoryIdRef.current = initialScenario.id;
      if (savedMsgs.length > 0) {
        setMessages(savedMsgs);
      } else {
        const openMsg: ChatMsg = {
          id: `open-${initialScenario.id}`,
          role: "assistant",
          textJp: initialScenario.openingJp,
          reading: initialScenario.openingReading,
          textTh: initialScenario.openingTh,
        };
        setMessages([openMsg]);
        void fetchJapaneseTokens(initialScenario.openingJp).then((tokens) => {
          if (!active || tokens.length === 0) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === openMsg.id ? { ...m, tokens } : m))
          );
        });
      }
    })();
    return () => {
      active = false;
      liveSessionRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (loadedHistoryIdRef.current !== scenario.id) return;
    const storable: StoredKaiwaMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      textJp: m.textJp,
      reading: m.reading,
      textTh: m.textTh,
      tokens: m.tokens,
      feedback: m.feedback,
    }));
    void saveKaiwaHistory(scenario.id, storable);
  }, [messages, scenario.id]);

  const stopLiveCall = () => {
    liveSessionRef.current?.close();
    liveSessionRef.current = null;
    setLiveStatus("idle");
    setLiveMuted(false);
    setLiveDraftUser("");
    setLiveDraftAi("");
  };

  const resetScenario = async (sc: Scenario, forceFresh = false) => {
    stopLiveCall();
    loadedHistoryIdRef.current = null;
    setScenario(sc);
    setOfflineStep(0);
    setErrorMsg(null);
    setLastFailedText(null);
    setLastLatencyMs(null);
    setCoachLoading(false);
    setSelectedToken(null);

    if (forceFresh) {
      await clearKaiwaHistory(sc.id);
    }
    const saved = forceFresh ? [] : await getKaiwaHistory(sc.id);
    if (saved.length > 0) {
      setMessages(saved);
      loadedHistoryIdRef.current = sc.id;
      return;
    }

    const openId = `open-${sc.id}`;
    setMessages([
      {
        id: openId,
        role: "assistant",
        textJp: sc.openingJp,
        reading: sc.openingReading,
        textTh: sc.openingTh,
      },
    ]);
    loadedHistoryIdRef.current = sc.id;
    enrichMessageTokens(openId, sc.openingJp);
    speakJapanese(sc.openingJp);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      setLoadingSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  const isLiveAi = Boolean(
    settings && settings.aiProvider !== "offline" && settings.apiKey.trim()
  );

  const handleToggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    setErrorMsg(null);
    setListening(true);
    recRef.current = startJapaneseRecognition({
      onResult: (transcript) => {
        setInput(transcript);
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
  };

  const runCoachManual = async (
    textToEvaluate: string,
    targetMsgId: string,
    historySnapshot: { role: "user" | "assistant"; text: string }[],
    activeSettings: AppSettings
  ) => {
    if (coachLoading) return;
    setCoachLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "kaiwa-coach",
          provider: activeSettings.aiProvider,
          apiKey: activeSettings.apiKey,
          model: activeSettings.aiModel,
          level: activeSettings.learnerLevel,
          scenarioTitle: scenario.title,
          scenarioPersona: scenario.persona,
          history: historySnapshot,
          userMessage: textToEvaluate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "วิเคราะห์ไวยากรณ์ไม่สำเร็จ");
      }
      if (!json?.data) return;
      const fb = json.data as ChatMsg["feedback"];
      setMessages((prev) =>
        prev.map((m) => (m.id === targetMsgId ? { ...m, feedback: fb } : m))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "วิเคราะห์ไวยากรณ์ไม่สำเร็จ");
    } finally {
      setCoachLoading(false);
    }
  };

  const enrichLiveReply = (targetMsgId: string, jpText: string) => {
    enrichMessageTokens(targetMsgId, jpText);
    void fetchJapaneseReading(jpText).then((reading) => {
      if (!reading) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === targetMsgId ? { ...m, reading } : m))
      );
    });
    void translateJaToTh(jpText).then((res) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetMsgId
            ? {
                ...m,
                textTh: res?.translation ?? m.textTh,
                translating: false,
              }
            : m
        )
      );
    });
  };

  const toggleLiveCall = async () => {
    if (liveStatus !== "idle") {
      stopLiveCall();
      return;
    }
    if (!settings || settings.aiProvider !== "gemini" || !settings.apiKey.trim()) {
      setErrorMsg("ต้องตั้งค่า Google Gemini API Key ก่อนใช้งานโหมดโทรคุยสด");
      return;
    }

    setErrorMsg(null);
    setLiveStatus("connecting");
    warmupLocalTranslator();
    try {
      const session = await startGeminiLiveSession({
        apiKey: settings.apiKey,
        persona: scenario.persona,
        scenarioTitle: scenario.title,
        level: settings.learnerLevel,
        openingJp: scenario.openingJp,
        callbacks: {
          onStatus: (status, detail) => {
            if (status === "connecting") {
              setLiveStatus("connecting");
              if (detail) setLiveModelName(detail);
            } else if (status === "connected") {
              setLiveStatus("connected");
              if (detail) setLiveModelName(detail);
            } else {
              liveSessionRef.current = null;
              setLiveStatus("idle");
              setLiveDraftUser("");
              setLiveDraftAi("");
            }
          },
          onUserTranscript: (text) => setLiveDraftUser(text),
          onAssistantTranscript: (text) => setLiveDraftAi(text),
          onTurnComplete: ({ userText, assistantText }) => {
            setLiveDraftUser("");
            setLiveDraftAi("");
            const aiMsgId = nextMsgId("live-a");
            const added: ChatMsg[] = [];
            if (userText) {
              added.push({ id: nextMsgId("live-u"), role: "user", textJp: userText });
            }
            if (assistantText) {
              added.push({
                id: aiMsgId,
                role: "assistant",
                textJp: assistantText,
                translating: true,
              });
            }
            if (added.length > 0) {
              setMessages((prev) => [...prev, ...added]);
            }
            if (assistantText) {
              enrichLiveReply(aiMsgId, assistantText);
            }
          },
          onError: (msg) => setErrorMsg(msg),
        },
      });
      liveSessionRef.current = session;
    } catch (err) {
      setLiveStatus("idle");
      setErrorMsg(
        err instanceof Error ? err.message : "ไม่สามารถเปิดไมโครโฟนสำหรับ Gemini Live ได้"
      );
    }
  };

  const handleSend = async (customText?: string, skipAppendUser = false) => {
    const textToSend = (customText ?? input).trim();
    if (!textToSend || loading) return;

    // If a Gemini Live voice session is connected, forward typed message there
    if (liveStatus === "connected" && liveSessionRef.current) {
      setInput("");
      liveSessionRef.current.sendText(textToSend);
      return;
    }

    setErrorMsg(null);
    setLastFailedText(null);
    setLoadingSec(0);
    if (!skipAppendUser) {
      const userMsg: ChatMsg = {
        id: nextMsgId("u"),
        role: "user",
        textJp: textToSend,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
    }
    setLoading(true);

    try {
      if (isLiveAi && settings) {
        const history = messages
          .filter((m) => !(skipAppendUser && m === messages[messages.length - 1]))
          .map((m) => ({
            role: m.role,
            text: m.textJp,
          }));

        const aiMsgId = nextMsgId("a");

        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "kaiwa-reply",
            stream: true,
            provider: settings.aiProvider,
            apiKey: settings.apiKey,
            model: settings.aiModel,
            level: settings.learnerLevel,
            scenarioTitle: scenario.title,
            scenarioPersona: scenario.persona,
            history,
            userMessage: textToSend,
          }),
        });

        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "AI ตอบกลับไม่สำเร็จ");
        }

        if (contentType.includes("application/x-ndjson") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let receivedAny = false;
          let spoken = false;
          let finalReplyJp = "";

          const upsertAiMsg = (patch: {
            replyJp?: string;
            replyReading?: string;
            replyTh?: string;
          }) => {
            if (!patch.replyJp && !patch.replyReading && !patch.replyTh) return;
            receivedAny = true;
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === aiMsgId);
              if (!exists) {
                return [
                  ...prev,
                  {
                    id: aiMsgId,
                    role: "assistant",
                    textJp: patch.replyJp ?? "",
                    reading: patch.replyReading,
                    textTh: patch.replyTh,
                  },
                ];
              }
              return prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      textJp: patch.replyJp ?? m.textJp,
                      reading: patch.replyReading ?? m.reading,
                      textTh: patch.replyTh ?? m.textTh,
                    }
                  : m
              );
            });
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              const ev = JSON.parse(line) as {
                type: "partial" | "done" | "error";
                data?: { replyJp?: string; replyReading?: string; replyTh?: string };
                complete?: { replyJp?: boolean };
                meta?: { elapsedMs?: number };
                error?: string;
              };
              if (ev.type === "error") {
                throw new Error(ev.error || "AI stream interrupted");
              }
              if (ev.type === "partial" && ev.data) {
                upsertAiMsg(ev.data);
                if (!spoken && ev.complete?.replyJp && ev.data.replyJp) {
                  spoken = true;
                  finalReplyJp = ev.data.replyJp;
                  speakJapanese(ev.data.replyJp, { rate: settings.speechRate });
                }
              }
              if (ev.type === "done" && ev.data) {
                upsertAiMsg(ev.data);
                if (typeof ev.meta?.elapsedMs === "number") {
                  setLastLatencyMs(ev.meta.elapsedMs);
                }
                if (ev.data.replyJp) {
                  enrichMessageTokens(aiMsgId, ev.data.replyJp);
                }
                if (!spoken && ev.data.replyJp) {
                  spoken = true;
                  finalReplyJp = ev.data.replyJp;
                  speakJapanese(ev.data.replyJp, { rate: settings.speechRate });
                }
              }
            }
          }

          if (!finalReplyJp && !receivedAny) {
            throw new Error("AI ไม่ได้ส่งข้อความตอบกลับมา");
          }
        } else {
          const json = await res.json();
          if (typeof json?.meta?.elapsedMs === "number") {
            setLastLatencyMs(json.meta.elapsedMs);
          }
          const d = json.data as {
            replyJp: string;
            replyReading?: string;
            replyTh?: string;
          };
          setMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              role: "assistant",
              textJp: d.replyJp,
              reading: d.replyReading,
              textTh: d.replyTh,
            },
          ]);
          enrichMessageTokens(aiMsgId, d.replyJp);
          speakJapanese(d.replyJp, { rate: settings.speechRate });
        }
      } else {
        // Offline Guided Simulation Mode
        const turn =
          scenario.offlineTurns[offlineStep] ??
          scenario.offlineTurns[scenario.offlineTurns.length - 1];
        setOfflineStep((s) => Math.min(s + 1, scenario.offlineTurns.length - 1));

        await new Promise((r) => setTimeout(r, 350));

        const aiMsgId = nextMsgId("a");
        const aiMsg: ChatMsg = {
          id: aiMsgId,
          role: "assistant",
          textJp: turn.replyJp,
          reading: turn.replyReading,
          textTh: turn.replyTh,
          feedback: {
            isNatural: true,
            grammarFeedbackTh:
              "โหมดจำลองออฟไลน์: คุณสื่อสารได้ยอดเยี่ยม! ดูวิธีพูดแบบเจ้าของภาษาด้านล่าง:",
            naturalRewriteJp: turn.userHintJp,
            tipTh: turn.naturalTip,
          },
        };
        setMessages((prev) => [...prev, aiMsg]);
        enrichMessageTokens(aiMsgId, turn.replyJp);
        speakJapanese(turn.replyJp, { rate: settings?.speechRate ?? 0.95 });
      }
    } catch (err) {
      setLastFailedText(textToSend);
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสนทนา");
    } finally {
      setLoading(false);
    }
  };

  const handleMineExpression = async (
    id: string,
    jp: string,
    reading: string | undefined,
    meaning: string
  ) => {
    await mineCardToSrs({
      front: jp,
      reading: reading ?? jp,
      meaningTh: meaning,
      cardType: "sentence",
      tags: ["Kaiwa", scenario.level],
    });
    setMinedIds((prev) => new Set(prev).add(id));
  };

  const handleSelectKaiwaToken = (
    tok: TokenizedWord,
    sentenceJp: string,
    sentenceTh?: string
  ) => {
    if (tok.pos === "記号" || !tok.surface.trim()) return;
    setSelectedToken({ tok, sentenceJp, sentenceTh });
    setWordLocalMeaning(null);
    setWordMined(false);
    speakJapanese(tok.surface, { rate: settings?.speechRate ?? 0.95 });
  };

  const handleTranslateSelectedToken = async () => {
    if (!selectedToken) return;
    const word = selectedToken.tok.basicForm || selectedToken.tok.surface;
    setWordTranslating(true);
    try {
      const res = await translateJaToTh(word);
      if (res?.translation) {
        setWordLocalMeaning(res.translation);
      }
    } finally {
      setWordTranslating(false);
    }
  };

  const handleMineSelectedToken = async () => {
    if (!selectedToken) return;
    const { tok, sentenceJp, sentenceTh } = selectedToken;
    const word = tok.basicForm || tok.surface;
    const vocabMatch = findVocabMatch(tok.surface, tok.basicForm, tok.readingHiragana);
    await mineCardToSrs({
      front: word,
      reading: tok.readingHiragana || word,
      meaningTh:
        vocabMatch?.meaningTh ||
        wordLocalMeaning ||
        `คำศัพท์จาก Kaiwa (${tok.pos})`,
      meaningEn: vocabMatch?.meaningEn,
      pitch: vocabMatch?.pitch,
      visualKey: word,
      exampleSentence: sentenceJp,
      exampleMeaningTh: sentenceTh,
      cardType: "vocab",
      tags: ["Kaiwa", scenario.level, tok.pos],
    });
    setWordMined(true);
  };

  const handleSendToShadowing = async (msg: ChatMsg) => {
    const saved = await enqueueShadowing({
      title: `Kaiwa: ${scenario.title}`,
      level: scenario.level,
      style: scenario.style.includes("กันเอง")
        ? "กันเอง (タメ口)"
        : "สุภาพ (丁寧語)",
      japanese: msg.textJp,
      reading: msg.reading || msg.textJp,
      meaningTh: msg.textTh || "ประโยคจากบทสนทนา Kaiwa",
      nuanceTh: `ประโยคจริงจากสถานการณ์ "${scenario.title}"`,
    });
    router.push(`/shadowing?queueId=${encodeURIComponent(saved.id)}`);
  };

  const handleCreateCustomScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPersona.trim() || !newOpeningJp.trim()) return;
    const openingReading =
      (await fetchJapaneseReading(newOpeningJp.trim())) ?? newOpeningJp.trim();
    const saved = await saveCustomScenario({
      title: newTitle.trim(),
      style: newStyle,
      level: newLevel,
      persona: newPersona.trim(),
      openingJp: newOpeningJp.trim(),
      openingReading,
      openingTh: newOpeningTh.trim() || "เริ่มการสนทนา",
    });
    const sc = toScenarioFromCustom(saved);
    setCustomScenarios((prev) => [sc, ...prev]);
    setShowCreateScenario(false);
    setNewTitle("");
    setNewPersona("");
    await resetScenario(sc, true);
  };

  const handleDeleteCustomScenario = async (id: string) => {
    await deleteCustomScenario(id);
    await clearKaiwaHistory(id);
    setCustomScenarios((prev) => prev.filter((c) => c.id !== id));
    if (scenario.id === id) {
      await resetScenario(SCENARIOS[0]);
    }
  };

  const allScenarios = [...SCENARIOS, ...customScenarios];
  const matchedSelectedVocab = selectedToken
    ? findVocabMatch(
        selectedToken.tok.surface,
        selectedToken.tok.basicForm,
        selectedToken.tok.readingHiragana
      )
    : null;
  const relatedSelectedKanji = selectedToken
    ? findKanjiMatches(selectedToken.tok.surface)
    : [];

  const latestUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const latestAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const latestFeedback = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.feedback)?.feedback;

  const currentOfflineHint = scenario.offlineTurns[offlineStep];

  return (
    <div className="space-y-6">
      <StudyPageHero
        tone="sakura"
        kanjiWatermark="会話"
        eyebrow="Phase 4b • Conversational Fluency & Naturalness Coach"
        title="คู่สนทนา AI Kaiwa (会話スタジオ)"
        subtitle="ฝึกพูดโต้ตอบตามสถานการณ์จริง พร้อมคำแนะนำวิธีพูดให้เป็นธรรมชาติแบบคนญี่ปุ่น"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isLiveAi && settings?.aiProvider === "gemini" && (
              <button
                type="button"
                onClick={toggleLiveCall}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                  liveStatus === "idle"
                    ? "bg-white text-[#5b1d2e] border-white hover:bg-white/90"
                    : liveStatus === "connecting"
                      ? "bg-amber-400/20 border-amber-300 text-amber-200 animate-pulse"
                      : "bg-rose-600 text-white border-rose-400"
                }`}
                title="สนทนาเสียงสด Real-time ผ่าน Gemini Live WebSocket"
              >
                {liveStatus === "idle" ? (
                  <>
                    <Phone className="w-3.5 h-3.5" />
                    <span>โทรคุยสด (Gemini Live)</span>
                  </>
                ) : liveStatus === "connecting" ? (
                  <>
                    <Phone className="w-3.5 h-3.5" />
                    <span>กำลังต่อ Live...</span>
                  </>
                ) : (
                  <>
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>วางสาย Live</span>
                  </>
                )}
              </button>
            )}
            <span className="text-xs font-medium px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-xs">
              {isLiveAi
                ? `Live AI: ${settings?.aiProvider.toUpperCase()}${
                    lastLatencyMs !== null
                      ? ` (${(lastLatencyMs / 1000).toFixed(1)}s)`
                      : ""
                  }`
                : "โหมดจำลองออฟไลน์ (ฟรี)"}
            </span>
            <Link
              href="/settings"
              className="p-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white"
              title="ตั้งค่า AI API Key"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        }
      />

      {/* Scenario Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {allScenarios.map((sc) => (
          <div key={sc.id} className="inline-flex items-center">
            <button
              type="button"
              onClick={() => void resetScenario(sc)}
              className={`px-3.5 py-2 text-xs font-medium border transition-colors cursor-pointer ${
                sc.isCustom ? "rounded-l-xl" : "rounded-xl"
              } ${
                scenario.id === sc.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface border-border text-foreground/75 hover:bg-surface-muted"
              }`}
            >
              {sc.title} ({sc.style})
            </button>
            {sc.isCustom && (
              <button
                type="button"
                onClick={() => void handleDeleteCustomScenario(sc.id)}
                className="px-2 py-2 rounded-r-xl border border-l-0 border-border bg-surface hover:bg-rose-500/10 text-foreground/60 hover:text-rose-500 cursor-pointer"
                title="ลบสถานการณ์ที่สร้าง"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setShowCreateScenario((v) => !v)}
          className="px-3.5 py-2 rounded-xl text-xs font-medium border border-dashed border-primary/50 text-primary hover:bg-primary/10 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>สร้างสถานการณ์เอง</span>
        </button>
      </div>

      {showCreateScenario && (
        <form
          onSubmit={handleCreateCustomScenario}
          className="rounded-2xl border border-primary/30 bg-surface p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-primary">
              สร้างห้องสนทนา Roleplay ของตัวเอง
            </div>
            <button
              type="button"
              onClick={() => setShowCreateScenario(false)}
              className="p-1 rounded-lg hover:bg-surface-muted cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="ชื่อสถานการณ์ (เช่น สัมภาษณ์งาน IT โตเกียว)"
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
            />
            <select
              value={newStyle}
              onChange={(e) => setNewStyle(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
            >
              <option value="สุภาพ (丁寧語)">สุภาพ (丁寧語)</option>
              <option value="กันเอง (タメ口)">กันเอง (タメ口)</option>
            </select>
            <select
              value={newLevel}
              onChange={(e) => setNewLevel(e.target.value as "N5" | "N4" | "N3")}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
            >
              <option value="N5">JLPT N5</option>
              <option value="N4">JLPT N4</option>
              <option value="N3">JLPT N3</option>
            </select>
          </div>
          <input
            type="text"
            required
            value={newPersona}
            onChange={(e) => setNewPersona(e.target.value)}
            placeholder="บทบาทคู่สนทนา AI (เช่น ผู้จัดการร้านกาแฟในชิบุย่า ใจดีแต่พูดเร็วเล็กน้อย)"
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={newOpeningJp}
              onChange={(e) => setNewOpeningJp(e.target.value)}
              placeholder="ประโยคทักทายแรก (ภาษาญี่ปุ่น)"
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm font-jp"
            />
            <input
              type="text"
              value={newOpeningTh}
              onChange={(e) => setNewOpeningTh(e.target.value)}
              placeholder="คำแปลประโยคแรก (ภาษาไทย)"
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateScenario(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
            >
              บันทึกและเริ่มสนทนา
            </button>
          </div>
        </form>
      )}

      {/* Main Chat + Feedback Coach Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Column */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface flex flex-col h-[560px]">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2 text-xs">
            <div className="font-semibold flex items-center gap-2 min-w-0">
              <Bot className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">คู่สนทนา: {scenario.persona}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowFurigana((v) => !v)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                  showFurigana
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-foreground/65"
                }`}
              >
                フリガナ {showFurigana ? "เปิด" : "ปิด"}
              </button>
              <button
                type="button"
                onClick={() => void resetScenario(scenario, true)}
                className="px-2 py-1 rounded-lg border border-border hover:bg-surface-muted text-foreground/70 inline-flex items-center gap-1 text-[11px] cursor-pointer"
                title="ล้างประวัติและเริ่มสนทนาใหม่"
              >
                <RotateCcw className="w-3 h-3" />
                <span>เริ่มใหม่</span>
              </button>
              <span className="text-foreground/55">{scenario.level}</span>
            </div>
          </div>

          {liveStatus !== "idle" && (
            <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <VoiceWaveOrb
                active={liveStatus === "connected" || liveStatus === "connecting"}
                tone="rose"
                label={
                  liveStatus === "connecting"
                    ? `กำลังเชื่อมต่อ ${liveModelName || "Gemini Live"}...`
                    : `Gemini Live เสียงสดเชื่อมต่อแล้ว (${liveModelName}) • พูดได้เลย`
                }
              />
              {liveStatus === "connected" && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !liveMuted;
                    setLiveMuted(next);
                    liveSessionRef.current?.setMuted(next);
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                    liveMuted
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-surface border-border hover:bg-surface-muted"
                  }`}
                >
                  {liveMuted ? "ปิดไมค์อยู่ (กดเปิด)" : "ไมค์เปิดอยู่"}
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 space-y-1.5 ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-surface-muted border border-border rounded-tl-sm"
                  }`}
                >
                  <div className="font-jp text-base font-medium leading-[2.1]">
                    {m.role === "assistant" && m.tokens && m.tokens.length > 0 ? (
                      m.tokens.map((tok, tIdx) => {
                        const isPunct = tok.pos === "記号" || !tok.surface.trim();
                        if (isPunct) return <span key={tIdx}>{tok.surface}</span>;
                        const hasRuby =
                          showFurigana &&
                          tok.hasKanji &&
                          tok.readingHiragana &&
                          tok.readingHiragana !== tok.surface;
                        const active =
                          selectedToken?.tok.surface === tok.surface &&
                          selectedToken?.sentenceJp === m.textJp;
                        return (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() =>
                              handleSelectKaiwaToken(tok, m.textJp, m.textTh)
                            }
                            className={`inline-block rounded px-0.5 transition-colors cursor-pointer ${
                              active
                                ? "bg-primary/20 text-primary ring-1 ring-primary"
                                : "hover:bg-primary/10 border-b border-dotted border-foreground/25"
                            }`}
                            title="คลิกดูคำแปล / Mine คำศัพท์"
                          >
                            {hasRuby ? (
                              <ruby>
                                {tok.surface}
                                <rt className="text-[10px] text-foreground/65">
                                  {tok.readingHiragana}
                                </rt>
                              </ruby>
                            ) : (
                              tok.surface
                            )}
                          </button>
                        );
                      })
                    ) : (
                      m.textJp
                    )}
                  </div>
                  {m.reading && (!m.tokens || m.tokens.length === 0) && (
                    <div className="font-jp text-xs opacity-70">{m.reading}</div>
                  )}
                  {m.textTh ? (
                    <div className="text-xs opacity-85 border-t border-current/15 pt-1.5">
                      {m.textTh}
                    </div>
                  ) : m.translating ? (
                    <div className="text-xs opacity-55 italic border-t border-current/15 pt-1.5">
                      กำลังแปลความหมายภาษาไทย...
                    </div>
                  ) : null}
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-2 pt-1">
                      <SpeakButton text={m.textJp} />
                      <button
                        type="button"
                        onClick={() =>
                          handleMineExpression(
                            m.id,
                            m.textJp,
                            m.reading,
                            m.textTh ?? "ประโยคจาก Kaiwa"
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border bg-surface hover:bg-background cursor-pointer"
                      >
                        {minedIds.has(m.id) ? (
                          <>
                            <Check className="w-3 h-3 text-matcha" />
                            <span className="text-matcha">Mined</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3 h-3 text-primary" />
                            <span>Mine</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendToShadowing(m)}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border bg-surface hover:bg-background cursor-pointer"
                        title="ส่งประโยคนี้ไปฝึกพูดเทียบเสียง Native ใน Shadowing Studio"
                      >
                        <Mic className="w-3 h-3 text-matcha" />
                        <span>Shadowing</span>
                      </button>
                      {!m.textTh && !m.translating && (
                        <button
                          type="button"
                          onClick={() => {
                            setMessages((prev) =>
                              prev.map((item) =>
                                item.id === m.id
                                  ? { ...item, translating: true }
                                  : item
                              )
                            );
                            enrichLiveReply(m.id, m.textJp);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border bg-surface hover:bg-background cursor-pointer"
                        >
                          <span>แปลไทย</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-foreground/10 text-foreground flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {liveDraftUser && (
              <div className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-primary/70 text-primary-foreground text-sm font-jp italic">
                  {liveDraftUser} ...
                </div>
              </div>
            )}
            {liveDraftAi && (
              <div className="flex justify-start">
                <div className="max-w-[82%] rounded-2xl rounded-tl-sm px-4 py-2.5 bg-surface-muted/80 border border-border text-sm font-jp italic">
                  {liveDraftAi} ...
                </div>
              </div>
            )}
            {loading && (
              <div className="px-2 py-1 flex items-center gap-2">
                <VoiceWaveOrb active tone="indigo" />
                <TextShimmer
                  text={`คู่สนทนากำลังคิดคำตอบ... (${loadingSec}s)`}
                  className="text-xs font-medium"
                />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Suggestion Chip in Offline Mode */}
          {!isLiveAi && currentOfflineHint && (
            <div className="px-4 py-2 bg-surface-muted/70 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-foreground/75 flex items-center gap-1.5 flex-wrap">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>ลองพูด/ส่งประโยคนี้:</span>{" "}
                <span className="font-jp font-semibold text-primary">
                  {currentOfflineHint.userHintJp}
                </span>{" "}
                <span className="text-foreground/55">
                  ({currentOfflineHint.userHintTh})
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSend(currentOfflineHint.userHintJp)}
                className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer"
              >
                ใช้ประโยคนี้ตอบ
              </button>
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-border flex items-center gap-2"
          >
            {speechSupported && (
              <button
                type="button"
                onClick={handleToggleMic}
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  listening
                    ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                    : "border-border bg-background hover:bg-surface-muted"
                }`}
                title="พูดภาษาญี่ปุ่นด้วยไมโครโฟน"
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => setUseIme((v) => !v)}
              className={`px-2.5 py-2 rounded-xl border text-xs font-mono cursor-pointer ${
                useIme
                  ? "bg-primary/15 border-primary text-primary font-bold"
                  : "border-border text-foreground/65"
              }`}
              title="เปิด/ปิดแปลง Romaji เป็น Hiragana อัตโนมัติ"
            >
              あ
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) =>
                setInput(
                  useIme
                    ? toHiragana(e.target.value, { IMEMode: true })
                    : e.target.value
                )
              }
              placeholder={
                liveStatus === "connected"
                  ? "พูดใส่ไมค์หรือพิมพ์ส่งเข้า Gemini Live (ไม่จำกัด)..."
                  : useIme
                    ? "พิมพ์ Romaji จะแปลงเป็นภาษาญี่ปุ่น..."
                    : "พิมพ์หรือกดไมค์พูดภาษาญี่ปุ่น..."
              }
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-jp focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Naturalness Feedback & Word Inspector Side Panel */}
        <div className="rounded-2xl border border-border bg-surface p-5 h-fit space-y-4">
          {selectedToken && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Word Inspector (คลิกคำในแชท)
                  </div>
                  <div className="font-jp text-2xl font-bold text-primary mt-0.5">
                    {selectedToken.tok.surface}
                  </div>
                  <div className="font-jp text-xs text-foreground/75">
                    {selectedToken.tok.readingHiragana} • {selectedToken.tok.pos}
                    {selectedToken.tok.basicForm !== selectedToken.tok.surface
                      ? ` • พจนานุกรม: ${selectedToken.tok.basicForm}`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => speakJapanese(selectedToken.tok.surface)}
                    className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted cursor-pointer"
                    title="ฟังเสียงคำนี้"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedToken(null)}
                    className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {matchedSelectedVocab ? (
                <div className="space-y-2 rounded-lg bg-surface p-2.5 border border-border">
                  <div className="text-xs font-bold">
                    {matchedSelectedVocab.meaningTh}
                  </div>
                  <div className="text-[11px] text-foreground/60">
                    {matchedSelectedVocab.meaningEn}
                  </div>
                  <PitchAccentChart
                    reading={matchedSelectedVocab.reading}
                    pitch={matchedSelectedVocab.pitch}
                    compact
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {wordLocalMeaning ? (
                    <div className="rounded-lg bg-surface p-2.5 border border-border text-xs font-semibold">
                      คำแปล: {wordLocalMeaning}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={wordTranslating}
                      onClick={() => void handleTranslateSelectedToken()}
                      className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-surface text-primary text-xs font-medium inline-flex items-center gap-1.5 hover:bg-primary/10 cursor-pointer disabled:opacity-50"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span>
                        {wordTranslating ? "กำลังแปล..." : "แปลคำนี้ (Local)"}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {hasBuiltInVisual(
                selectedToken.tok.basicForm || selectedToken.tok.surface
              ) && (
                <VocabVisualCard
                  word={selectedToken.tok.basicForm || selectedToken.tok.surface}
                  compact
                />
              )}

              {relatedSelectedKanji.length > 0 && (
                <div className="text-[11px] space-y-1 bg-surface rounded-lg p-2 border border-border">
                  {relatedSelectedKanji.map((k) => (
                    <div key={k.id}>
                      <strong className="font-jp text-primary">{k.kanji}</strong>:{" "}
                      {k.meaningTh}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleMineSelectedToken()}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-95 cursor-pointer"
              >
                {wordMined ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>บันทึกคำนี้ลง FSRS แล้ว!</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Mine คำนี้ลง FSRS</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="w-4 h-4" />
              <span>Naturalness & Grammar Coach</span>
            </div>
            {coachLoading && (
              <span className="text-[11px] text-foreground/55 animate-pulse">
                กำลังวิเคราะห์...
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="text-xs text-accent bg-accent/10 border border-accent/25 rounded-xl p-3 space-y-2">
              <div>{errorMsg}</div>
              <div className="flex flex-wrap gap-2">
                {lastFailedText && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSend(lastFailedText, true)}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white font-medium cursor-pointer hover:opacity-95"
                  >
                    ลองส่ง &ldquo;{lastFailedText}&rdquo; ใหม่อีกครั้ง
                  </button>
                )}
                {settings?.aiProvider === "gemini" && liveStatus === "idle" && (
                  <button
                    type="button"
                    onClick={toggleLiveCall}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer hover:opacity-95"
                  >
                    สลับไปคุยผ่าน Gemini Live (Unlimited)
                  </button>
                )}
              </div>
            </div>
          )}

          {isLiveAi && settings?.aiProvider === "gemini" && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs text-foreground/80 space-y-2">
              <div className="font-semibold text-primary">
                โหมดประหยัดโควต้า (ใช้เฉพาะ Gemini Live)
              </div>
              <p className="leading-relaxed text-foreground/70">
                ปิด Auto-Coach แล้ว เพื่อไม่ให้เปลืองโควต้า Flash (20/วัน) แนะนำกด{" "}
                <strong>โทรคุยสด (Gemini Live)</strong> เพื่อฝึกพูด-พิมพ์แบบ Unlimited
              </p>
              {liveStatus === "idle" && (
                <button
                  type="button"
                  onClick={toggleLiveCall}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer hover:opacity-95"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>เริ่มคุยผ่าน Gemini Live</span>
                </button>
              )}
            </div>
          )}

          {isLiveAi && settings && latestUserMsg && latestAssistantMsg && (
            <button
              type="button"
              disabled={coachLoading}
              onClick={() =>
                runCoachManual(
                  latestUserMsg.textJp,
                  latestAssistantMsg.id,
                  messages.map((m) => ({ role: m.role, text: m.textJp })),
                  settings
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-border bg-surface-muted hover:bg-background text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              {coachLoading
                ? "กำลังให้ Coach วิเคราะห์..."
                : `ตรวจไวยากรณ์ "${latestUserMsg.textJp}" (ใช้ 1 โควต้า)`}
            </button>
          )}

          {!latestFeedback ? (
            <div className="text-sm text-foreground/65 py-4 leading-relaxed">
              ลองคุยโต้ตอบดูนะครับ หากต้องการตรวจไวยากรณ์ประโยคล่าสุด สามารถกดปุ่มด้านบนเฉพาะประโยคที่อยากเช็กได้ (เพื่อประหยัดโควต้า API)
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-surface-muted p-3.5 space-y-1.5">
                <div className="text-xs font-semibold text-foreground/65">
                  การวิเคราะห์ประโยคล่าสุดของคุณ
                </div>
                <p className="text-sm leading-relaxed">
                  {latestFeedback.grammarFeedbackTh}
                </p>
              </div>

              {latestFeedback.naturalRewriteJp && (
                <div className="rounded-xl border border-matcha/30 bg-matcha/5 p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-matcha">
                    คนญี่ปุ่นมักพูดแบบนี้ให้เป็นธรรมชาติ:
                  </div>
                  <div className="font-jp text-base font-bold">
                    {latestFeedback.naturalRewriteJp}
                  </div>
                  {latestFeedback.naturalRewriteReading && (
                    <div className="font-jp text-xs text-foreground/65">
                      {latestFeedback.naturalRewriteReading}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <SpeakButton text={latestFeedback.naturalRewriteJp} label="ฟัง" />
                    <button
                      type="button"
                      onClick={() =>
                        handleMineExpression(
                          `nat-${latestFeedback.naturalRewriteJp}`,
                          latestFeedback.naturalRewriteJp!,
                          latestFeedback.naturalRewriteReading,
                          latestFeedback.tipTh ?? "สำนวนธรรมชาติจาก AI Kaiwa"
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted cursor-pointer"
                    >
                      {minedIds.has(`nat-${latestFeedback.naturalRewriteJp}`) ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-matcha" />
                          <span className="text-matcha">บันทึกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5 text-primary" />
                          <span>Mine สำนวนนี้</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {latestFeedback.tipTh && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3.5 text-xs text-foreground/80 leading-relaxed">
                  <strong className="text-gold">เคล็ดลับวัฒนธรรม/ภาษา:</strong>{" "}
                  {latestFeedback.tipTh}
                </div>
              )}
            </div>
          )}

          {!isLiveAi && (
            <div className="rounded-xl border border-border bg-surface-muted/60 p-3.5 text-xs text-foreground/75 space-y-2">
              <div className="font-semibold">อยากคุยแบบอิสระไม่จำกัดหัวข้อ?</div>
              <p>
                สามารถนำ Gemini API Key (ฟรี tier) หรือ OpenAI API Key มาใส่ในหน้า{" "}
                <Link href="/settings" className="text-primary underline font-medium">
                  ตั้งค่า
                </Link>{" "}
                เพื่อปลดล็อก Live AI Kaiwa ได้ทันทีครับ
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
