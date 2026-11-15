"use client";

import React from "react";

interface VisualSpec {
  bg: string;
  caption: string;
  svg: React.ReactNode;
}

const VISUAL_MAP: Record<string, VisualSpec> = {
  // Nature & Kanji pictographs
  "日": {
    bg: "from-amber-100 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/30",
    caption: "ดวงอาทิตย์ / วัน",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <circle cx="40" cy="40" r="16" fill="#f59e0b" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="40"
            y1="14"
            x2="40"
            y2="20"
            stroke="#f59e0b"
            strokeWidth="3.5"
            strokeLinecap="round"
            transform={`rotate(${deg} 40 40)`}
          />
        ))}
      </svg>
    ),
  },
  "月": {
    bg: "from-indigo-100 to-slate-50 dark:from-indigo-950/50 dark:to-slate-900",
    caption: "พระจันทร์เสี้ยว / เดือน",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path
          d="M46 16a24 24 0 1 0 18 40 20 20 0 1 1-18-40Z"
          fill="#6366f1"
        />
        <circle cx="58" cy="24" r="2.5" fill="#fbbf24" />
        <circle cx="64" cy="36" r="1.8" fill="#fbbf24" />
      </svg>
    ),
  },
  "火": {
    bg: "from-rose-100 to-amber-50 dark:from-rose-950/50 dark:to-amber-950/30",
    caption: "เปลวไฟ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path
          d="M40 12c6 12 18 18 18 33a18 18 0 0 1-36 0c0-10 6-17 10-22 1 6 5 9 8 9-2-7 0-14 0-20Z"
          fill="#ef4444"
        />
        <path
          d="M41 36c4 5 8 9 8 15a8 8 0 0 1-16 0c0-6 4-10 8-15Z"
          fill="#fbbf24"
        />
      </svg>
    ),
  },
  "水": {
    bg: "from-sky-100 to-cyan-50 dark:from-sky-950/50 dark:to-cyan-950/30",
    caption: "หยดน้ำ / น้ำเปล่า",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path
          d="M40 12S20 35 20 49a20 20 0 0 0 40 0C60 35 40 12 40 12Z"
          fill="#0ea5e9"
        />
        <path
          d="M32 45a9 9 0 0 0 5 11"
          fill="none"
          stroke="#e0f2fe"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  "木": {
    bg: "from-emerald-100 to-lime-50 dark:from-emerald-950/50 dark:to-lime-950/30",
    caption: "ต้นไม้",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="36" y="42" width="8" height="24" rx="3" fill="#92400e" />
        <circle cx="40" cy="30" r="18" fill="#22c55e" />
        <circle cx="28" cy="36" r="11" fill="#16a34a" />
        <circle cx="52" cy="36" r="11" fill="#16a34a" />
      </svg>
    ),
  },
  "山": {
    bg: "from-emerald-100 to-sky-50 dark:from-emerald-950/50 dark:to-sky-950/30",
    caption: "ภูเขา (ฟูจิ)",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path d="M10 62L36 22h8l26 40H10Z" fill="#334155" />
        <path d="M36 22h8l7 11-5 3-6-4-6 4-5-3 7-11Z" fill="#f8fafc" />
      </svg>
    ),
  },
  "川": {
    bg: "from-cyan-100 to-blue-50 dark:from-cyan-950/50 dark:to-blue-950/30",
    caption: "สายน้ำ / แม่น้ำ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        {[22, 40, 58].map((x) => (
          <path
            key={x}
            d={`M${x} 16c-5 12 5 22 0 34s-4 14-4 14`}
            fill="none"
            stroke="#0284c7"
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
      </svg>
    ),
  },
  "雨": {
    bg: "from-slate-200 to-sky-100 dark:from-slate-800 dark:to-sky-950/40",
    caption: "ฝนตก",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path
          d="M22 42a12 12 0 0 1 2-23 15 15 0 0 1 29 3 10 10 0 0 1 5 20H22Z"
          fill="#64748b"
        />
        {[28, 40, 52].map((x) => (
          <line
            key={x}
            x1={x}
            y1="48"
            x2={x - 4}
            y2="62"
            stroke="#0ea5e9"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ))}
      </svg>
    ),
  },
  // Daily nouns & verbs
  "ラーメン": {
    bg: "from-orange-100 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/30",
    caption: "ราเมงร้อนๆ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path d="M14 42h52a26 26 0 0 1-52 0Z" fill="#dc2626" />
        <rect x="28" y="64" width="24" height="5" rx="2" fill="#991b1b" />
        <path d="M22 42c0-7 36-7 36 0" fill="#fde047" />
        <line x1="20" y1="22" x2="62" y2="30" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="29" x2="62" y2="33" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  "コーヒー": {
    bg: "from-amber-100 to-stone-100 dark:from-amber-950/50 dark:to-stone-900",
    caption: "กาแฟ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path d="M20 34h34v18a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14V34Z" fill="#78350f" />
        <path d="M54 38h6a6 6 0 0 1 0 12h-6" fill="none" stroke="#78350f" strokeWidth="4" />
        <path d="M30 18c-3 4 3 7 0 11M42 18c-3 4 3 7 0 11" fill="none" stroke="#a8a29e" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  "本": {
    bg: "from-indigo-100 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/30",
    caption: "หนังสือ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="18" y="18" width="44" height="46" rx="4" fill="#3b82f6" />
        <rect x="24" y="18" width="38" height="46" rx="3" fill="#60a5fa" />
        <rect x="29" y="26" width="26" height="8" rx="2" fill="#eff6ff" />
        <line x1="29" y1="42" x2="52" y2="42" stroke="#eff6ff" strokeWidth="2.5" />
      </svg>
    ),
  },
  "電車": {
    bg: "from-emerald-100 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/30",
    caption: "รถไฟ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="18" y="18" width="44" height="40" rx="8" fill="#10b981" />
        <rect x="24" y="26" width="14" height="12" rx="2" fill="#ecfdf5" />
        <rect x="42" y="26" width="14" height="12" rx="2" fill="#ecfdf5" />
        <circle cx="28" cy="48" r="3" fill="#fef08a" />
        <circle cx="52" cy="48" r="3" fill="#fef08a" />
        <line x1="24" y1="64" x2="18" y2="70" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="56" y1="64" x2="62" y2="70" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  "駅": {
    bg: "from-sky-100 to-indigo-50 dark:from-sky-950/50 dark:to-indigo-950/30",
    caption: "สถานีรถไฟ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="14" y="28" width="52" height="34" rx="4" fill="#4f46e5" />
        <polygon points="10,28 40,14 70,28" fill="#312e81" />
        <rect x="33" y="44" width="14" height="18" rx="2" fill="#e0e7ff" />
        <circle cx="40" cy="34" r="5" fill="#fde047" />
      </svg>
    ),
  },
  "食べる": {
    bg: "from-rose-100 to-orange-50 dark:from-rose-950/50 dark:to-orange-950/30",
    caption: "กินอาหาร",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <circle cx="40" cy="44" r="22" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
        <circle cx="34" cy="42" r="7" fill="#fb923c" />
        <circle cx="47" cy="47" r="6" fill="#4ade80" />
        <line x1="16" y1="16" x2="30" y2="34" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        <line x1="24" y1="14" x2="34" y2="34" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  "飲む": {
    bg: "from-sky-100 to-teal-50 dark:from-sky-950/50 dark:to-teal-950/30",
    caption: "ดื่มเครื่องดื่ม",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <polygon points="24,24 56,24 50,64 30,64" fill="#bae6fd" stroke="#0284c7" strokeWidth="2.5" />
        <polygon points="27,38 53,38 50,62 30,62" fill="#0ea5e9" />
        <line x1="48" y1="14" x2="40" y2="48" stroke="#f43f5e" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  "寝る": {
    bg: "from-violet-100 to-indigo-50 dark:from-violet-950/50 dark:to-indigo-950/30",
    caption: "นอนหลับ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="12" y="42" width="56" height="16" rx="4" fill="#6366f1" />
        <rect x="14" y="34" width="16" height="10" rx="4" fill="#e0e7ff" />
        <text x="48" y="28" fontSize="14" fontWeight="bold" fill="#6366f1">Zzz</text>
      </svg>
    ),
  },
  "見る": {
    bg: "from-blue-100 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/30",
    caption: "ดู / มอง",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path d="M12 40s12-16 28-16 28 16 28 16-12 16-28 16S12 40 12 40Z" fill="#ffffff" stroke="#3b82f6" strokeWidth="3" />
        <circle cx="40" cy="40" r="9" fill="#2563eb" />
        <circle cx="43" cy="37" r="3" fill="#ffffff" />
      </svg>
    ),
  },
  "聞く": {
    bg: "from-pink-100 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/30",
    caption: "ฟังเสียง / ดนตรี",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <path d="M20 44v-6a20 20 0 0 1 40 0v6" fill="none" stroke="#e11d48" strokeWidth="5" strokeLinecap="round" />
        <rect x="14" y="42" width="10" height="18" rx="4" fill="#be123c" />
        <rect x="56" y="42" width="10" height="18" rx="4" fill="#be123c" />
      </svg>
    ),
  },
  "家": {
    bg: "from-amber-100 to-rose-50 dark:from-amber-950/50 dark:to-rose-950/30",
    caption: "บ้าน",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <polygon points="14,38 40,16 66,38" fill="#ea580c" />
        <rect x="20" y="38" width="40" height="26" rx="2" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
        <rect x="34" y="48" width="12" height="16" fill="#92400e" />
      </svg>
    ),
  },
  "学校": {
    bg: "from-sky-100 to-emerald-50 dark:from-sky-950/50 dark:to-emerald-950/30",
    caption: "โรงเรียน",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="14" y="34" width="52" height="30" rx="3" fill="#f8fafc" stroke="#0284c7" strokeWidth="2.5" />
        <polygon points="28,34 40,20 52,34" fill="#0284c7" />
        <circle cx="40" cy="34" r="5" fill="#fde047" stroke="#0284c7" strokeWidth="2" />
        <rect x="35" y="48" width="10" height="16" fill="#38bdf8" />
      </svg>
    ),
  },
  "猫": {
    bg: "from-amber-100 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/30",
    caption: "แมว (เนะโกะ)",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <polygon points="20,34 24,16 36,28" fill="#f59e0b" />
        <polygon points="60,34 56,16 44,28" fill="#f59e0b" />
        <circle cx="40" cy="44" r="19" fill="#fbbf24" />
        <circle cx="33" cy="42" r="2.8" fill="#1e293b" />
        <circle cx="47" cy="42" r="2.8" fill="#1e293b" />
        <polygon points="38,48 42,48 40,51" fill="#f43f5e" />
      </svg>
    ),
  },
  "日本": {
    bg: "from-rose-100 to-white dark:from-rose-950/40 dark:to-slate-900",
    caption: "ประเทศญี่ปุ่น",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="12" y="20" width="56" height="40" rx="5" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
        <circle cx="40" cy="40" r="11" fill="#e11d48" />
      </svg>
    ),
  },
  "友達": {
    bg: "from-emerald-100 to-amber-50 dark:from-emerald-950/50 dark:to-amber-950/30",
    caption: "เพื่อน",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <circle cx="29" cy="30" r="9" fill="#3b82f6" />
        <path d="M16 58a13 13 0 0 1 26 0" fill="#60a5fa" />
        <circle cx="51" cy="30" r="9" fill="#10b981" />
        <path d="M38 58a13 13 0 0 1 26 0" fill="#34d399" />
      </svg>
    ),
  },
  "映画": {
    bg: "from-slate-200 to-indigo-100 dark:from-slate-800 dark:to-indigo-950/40",
    caption: "ภาพยนตร์ / อนิเมะ",
    svg: (
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <rect x="14" y="22" width="52" height="36" rx="4" fill="#1e293b" />
        <polygon points="35,32 51,40 35,48" fill="#f43f5e" />
      </svg>
    ),
  },
};

// Aliases mapping word -> visual spec key
const WORD_ALIAS: Record<string, string> = {
  "みず": "水",
  "水": "水",
  "みず (水)": "水",
  "コーヒー": "コーヒー",
  "ラーメン": "ラーメン",
  "ほん": "本",
  "本": "本",
  "でんしゃ": "電車",
  "電車": "電車",
  "えき": "駅",
  "駅": "駅",
  "食べる": "食べる",
  "飲む": "飲む",
  "寝る": "寝る",
  "見る": "見る",
  "観る": "見る",
  "聞く": "聞く",
  "家": "家",
  "うち": "家",
  "学校": "学校",
  "猫": "猫",
  "ねこ": "猫",
  "日本": "日本",
  "にほん": "日本",
  "友達": "友達",
  "ともだち": "友達",
  "映画": "映画",
  "アニメ": "映画",
  "あめ": "雨",
  "雨": "雨",
  "やま": "山",
  "山": "山",
  "かわ": "川",
  "川": "川",
  "火": "火",
  "日": "日",
  "月": "月",
  "木": "木",
  "先生": "日本語",
  "学生": "日本語",
  "辞書": "本",
  "新幹線": "電車",
  "飛行機": "電車",
  "時計": "コンビニ",
  "お土産": "コンビニ",
  "図書館": "本",
  "教室": "日本語",
};

interface ArtAssetSpec {
  src: string;
  caption: string;
}

const ART_ASSET_MAP: Record<string, ArtAssetSpec> = {
  // Morning & Everyday Greetings
  "おはようございます": { src: "/vocab/morning-greeting.jpg", caption: "อรุณสวัสดิ์ตอนเช้า" },
  "朝": { src: "/vocab/morning-greeting.jpg", caption: "ยามเช้าสดใส" },
  "朝ごはん": { src: "/vocab/morning-greeting.jpg", caption: "มื้อเช้า" },
  "今日": { src: "/vocab/morning-greeting.jpg", caption: "วันนี้" },
  "毎日": { src: "/vocab/morning-greeting.jpg", caption: "ทุกวัน" },
  "元気": { src: "/vocab/morning-greeting.jpg", caption: "ร่าเริง แข็งแรง" },

  // Polite Conversation & Gratitude
  "ありがとうございます": { src: "/vocab/thank-you-bow.jpg", caption: "ขอบคุณจากใจ" },
  "すみません": { src: "/vocab/thank-you-bow.jpg", caption: "ขอโทษ / เรียกพนักงาน" },
  "お願いします": { src: "/vocab/thank-you-bow.jpg", caption: "ขอความกรุณา" },
  "大丈夫": { src: "/vocab/thank-you-bow.jpg", caption: "ไม่เป็นไรครับ" },
  "なるほど": { src: "/vocab/thank-you-bow.jpg", caption: "เข้าใจแล้ว / อย่างนี้นี่เอง" },
  "そうですね": { src: "/vocab/thank-you-bow.jpg", caption: "นั่นสินะครับ" },
  "ちょっと": { src: "/vocab/thank-you-bow.jpg", caption: "สักครู่ / นิดหน่อย" },
  "本当": { src: "/vocab/thank-you-bow.jpg", caption: "เรื่องจริง" },
  "確かに": { src: "/vocab/thank-you-bow.jpg", caption: "จริงด้วย" },
  "やっぱり": { src: "/vocab/thank-you-bow.jpg", caption: "ว่าแล้วเชียว" },
  "ทักทาย & มารยาท": { src: "/vocab/thank-you-bow.jpg", caption: "บทสนทนา & มารยาทญี่ปุ่น" },
  "วลีธรรมชาติในชีวิตจริง": { src: "/vocab/thank-you-bow.jpg", caption: "สำนวนที่ใช้จริง" },

  // Food & Ramen
  "ラーメン": { src: "/vocab/ramen-bowl.jpg", caption: "ราเมงร้อนๆ" },
  "食べる": { src: "/vocab/ramen-bowl.jpg", caption: "กิน" },
  "食": { src: "/vocab/ramen-bowl.jpg", caption: "อาหาร / การกิน" },
  "美味しい": { src: "/vocab/ramen-bowl.jpg", caption: "อร่อย!" },
  "ご飯": { src: "/vocab/ramen-bowl.jpg", caption: "ข้าวสวย / มื้ออาหาร" },
  "昼ごはん": { src: "/vocab/ramen-bowl.jpg", caption: "อาหารกลางวัน" },
  "箸": { src: "/vocab/ramen-bowl.jpg", caption: "ตะเกียบ" },
  "อาหาร & คาเฟ่": { src: "/vocab/ramen-bowl.jpg", caption: "อาหาร & ร้านดัง" },

  // Coffee, Matcha, Drinks
  "コーヒー": { src: "/vocab/matcha-cafe.jpg", caption: "กาแฟหอมกรุ่น" },
  "お茶": { src: "/vocab/matcha-cafe.jpg", caption: "ชาเขียวญี่ปุ่น" },
  "飲む": { src: "/vocab/matcha-cafe.jpg", caption: "ดื่ม" },
  "飲": { src: "/vocab/matcha-cafe.jpg", caption: "เครื่องดื่ม" },
  "水": { src: "/vocab/matcha-cafe.jpg", caption: "น้ำ / เครื่องดื่ม" },

  // Train, Station & Travel
  "電車": { src: "/vocab/tokyo-train-station.jpg", caption: "รถไฟโตเกียว" },
  "駅": { src: "/vocab/tokyo-train-station.jpg", caption: "สถานีรถไฟ" },
  "電": { src: "/vocab/tokyo-train-station.jpg", caption: "รถไฟฟ้า" },
  "車": { src: "/vocab/tokyo-train-station.jpg", caption: "รถ / การเดินทาง" },
  "行く": { src: "/vocab/tokyo-train-station.jpg", caption: "ออกเดินทาง / ไป" },
  "行": { src: "/vocab/tokyo-train-station.jpg", caption: "ไป" },
  "来る": { src: "/vocab/tokyo-train-station.jpg", caption: "มาถึง" },
  "来": { src: "/vocab/tokyo-train-station.jpg", caption: "มา" },
  "帰る": { src: "/vocab/tokyo-train-station.jpg", caption: "เดินทางกลับ" },
  "帰": { src: "/vocab/tokyo-train-station.jpg", caption: "กลับบ้าน" },
  "バス": { src: "/vocab/tokyo-train-station.jpg", caption: "รถบัส" },
  "空港": { src: "/vocab/tokyo-train-station.jpg", caption: "สนามบิน" },
  "ホテル": { src: "/vocab/tokyo-train-station.jpg", caption: "ที่พัก & ท่องเที่ยว" },
  "สถานที่ & การเดินทาง": { src: "/vocab/tokyo-train-station.jpg", caption: "เดินทางในญี่ปุ่น" },

  // Study, Books, Cat & Desk
  "日本語": { src: "/vocab/japanese-study-cat.jpg", caption: "เรียนภาษาญี่ปุ่น" },
  "勉強する": { src: "/vocab/japanese-study-cat.jpg", caption: "ตั้งใจเรียน" },
  "本": { src: "/vocab/japanese-study-cat.jpg", caption: "หนังสือ" },
  "読む": { src: "/vocab/japanese-study-cat.jpg", caption: "อ่านหนังสือ" },
  "読": { src: "/vocab/japanese-study-cat.jpg", caption: "อ่าน" },
  "書く": { src: "/vocab/japanese-study-cat.jpg", caption: "เขียนบันทึก" },
  "書": { src: "/vocab/japanese-study-cat.jpg", caption: "เขียน" },
  "学": { src: "/vocab/japanese-study-cat.jpg", caption: "การเรียนรู้" },
  "語": { src: "/vocab/japanese-study-cat.jpg", caption: "ภาษา" },
  "猫": { src: "/vocab/japanese-study-cat.jpg", caption: "น้องแมวข้างโต๊ะเรียน" },
  "覚える": { src: "/vocab/japanese-study-cat.jpg", caption: "จดจำศัพท์" },
  "教える": { src: "/vocab/japanese-study-cat.jpg", caption: "สอน & อธิบาย" },
  "分かる": { src: "/vocab/japanese-study-cat.jpg", caption: "เข้าใจแล้ว" },
  "ชีวิตประจำวัน & บันเทิง": { src: "/vocab/japanese-study-cat.jpg", caption: "ชีวิตประจำวัน" },

  // Japan, Friends & Casual Talk
  "日本": { src: "/vocab/japan-friends-street.jpg", caption: "ถนนญี่ปุ่น & เพื่อน" },
  "友達": { src: "/vocab/japan-friends-street.jpg", caption: "เพื่อนสนิท" },
  "友": { src: "/vocab/japan-friends-street.jpg", caption: "มิตรภาพ" },
  "人": { src: "/vocab/japan-friends-street.jpg", caption: "ผู้คน" },
  "会う": { src: "/vocab/japan-friends-street.jpg", caption: "นัดเจอเพื่อน" },
  "遊ぶ": { src: "/vocab/japan-friends-street.jpg", caption: "เที่ยวเล่น" },
  "話す": { src: "/vocab/japan-friends-street.jpg", caption: "คุยเล่น" },
  "話": { src: "/vocab/japan-friends-street.jpg", caption: "การสนทนา" },
  "好き": { src: "/vocab/japan-friends-street.jpg", caption: "ชอบเลย!" },
  "好": { src: "/vocab/japan-friends-street.jpg", caption: "ความชอบ" },
  "久しぶり": { src: "/vocab/japan-friends-street.jpg", caption: "ไม่เจอกันนานเลย!" },
  "ชีวิตจริง & อนิเมะ": { src: "/vocab/japan-friends-street.jpg", caption: "ภาษาพูด & เพื่อนญี่ปุ่น" },

  // Weather, Rain & Umbrella
  "雨": { src: "/vocab/rainy-umbrella.jpg", caption: "สายฝนในโตเกียว" },
  "傘": { src: "/vocab/rainy-umbrella.jpg", caption: "ร่มใสสไตล์ญี่ปุ่น" },
  "天気": { src: "/vocab/rainy-umbrella.jpg", caption: "สภาพอากาศ" },
  "天": { src: "/vocab/rainy-umbrella.jpg", caption: "ท้องฟ้า" },
  "気": { src: "/vocab/rainy-umbrella.jpg", caption: "บรรยากาศ / พลังใจ" },
  "寒い": { src: "/vocab/rainy-umbrella.jpg", caption: "อากาศหนาว" },
  "暑い": { src: "/vocab/rainy-umbrella.jpg", caption: "อากาศร้อน" },

  // Nature, Kanji & Mountains
  "山": { src: "/vocab/fuji-mountain-river.jpg", caption: "ภูเขาไฟฟูจิ" },
  "川": { src: "/vocab/fuji-mountain-river.jpg", caption: "แม่น้ำใส" },
  "木": { src: "/vocab/fuji-mountain-river.jpg", caption: "ต้นไม้ & ธรรมชาติ" },
  "日": { src: "/vocab/fuji-mountain-river.jpg", caption: "ดวงอาทิตย์ / วัน" },
  "月": { src: "/vocab/fuji-mountain-river.jpg", caption: "พระจันทร์ / เดือน" },
  "大": { src: "/vocab/fuji-mountain-river.jpg", caption: "ยิ่งใหญ่ (ภูเขาฟูจิ)" },
  "自然": { src: "/vocab/fuji-mountain-river.jpg", caption: "ธรรมชาติ" },

  // Conbini & Shopping
  "コンビニ": { src: "/vocab/conbini-shopping.jpg", caption: "ร้านสะดวกซื้อญี่ปุ่น" },
  "買う": { src: "/vocab/conbini-shopping.jpg", caption: "ซื้อของ" },
  "買": { src: "/vocab/conbini-shopping.jpg", caption: "จับจ่าย" },
  "お金": { src: "/vocab/conbini-shopping.jpg", caption: "เงิน & เหรียญเยน" },
  "金": { src: "/vocab/conbini-shopping.jpg", caption: "เงินทอง" },
  "お会計": { src: "/vocab/conbini-shopping.jpg", caption: "เช็คบิล" },
  "パン": { src: "/vocab/conbini-shopping.jpg", caption: "ขนมปัง & แซนด์วิช" },
  "店": { src: "/vocab/conbini-shopping.jpg", caption: "ร้านค้า" },
  "高い": { src: "/vocab/conbini-shopping.jpg", caption: "ราคาแพง" },
  "安い": { src: "/vocab/conbini-shopping.jpg", caption: "ราคาถูก" },

  // Anime, Movies & Music
  "映画": { src: "/vocab/cinema-anime-music.jpg", caption: "โรงหนัง & ภาพยนตร์" },
  "アニメ": { src: "/vocab/cinema-anime-music.jpg", caption: "อนิเมะ" },
  "音楽": { src: "/vocab/cinema-anime-music.jpg", caption: "เพลง & ดนตรี" },
  "漫画": { src: "/vocab/cinema-anime-music.jpg", caption: "มังงะ" },
  "見る": { src: "/vocab/cinema-anime-music.jpg", caption: "ดู / ชม" },
  "見": { src: "/vocab/cinema-anime-music.jpg", caption: "มองดู" },
  "聞く": { src: "/vocab/cinema-anime-music.jpg", caption: "ฟังเสียงเพลง" },
  "聞": { src: "/vocab/cinema-anime-music.jpg", caption: "ฟัง / ถาม" },
  "楽しい": { src: "/vocab/cinema-anime-music.jpg", caption: "สนุกสนาน" },
};

function resolveBuiltInAsset(
  word: string,
  visualKey?: string,
  tags?: string[]
): ArtAssetSpec | null {
  const candidates = [visualKey, word, ...(tags ?? [])].filter(
    (s): s is string => Boolean(s)
  );
  for (const cand of candidates) {
    if (ART_ASSET_MAP[cand]) return ART_ASSET_MAP[cand];
    const aliased = WORD_ALIAS[cand];
    if (aliased && ART_ASSET_MAP[aliased]) return ART_ASSET_MAP[aliased];
  }
  return null;
}

export function hasBuiltInVisual(wordOrKey?: string, tags?: string[]): boolean {
  if (!wordOrKey && (!tags || tags.length === 0)) return false;
  if (resolveBuiltInAsset(wordOrKey ?? "", wordOrKey, tags)) return true;
  if (!wordOrKey) return false;
  const resolved = WORD_ALIAS[wordOrKey] ?? wordOrKey;
  return Boolean(VISUAL_MAP[resolved]);
}

export function VocabVisualCard({
  word,
  visualKey,
  imageDataUrl,
  tags,
  compact = false,
}: {
  word: string;
  visualKey?: string;
  imageDataUrl?: string;
  tags?: string[];
  compact?: boolean;
}) {
  if (imageDataUrl) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-border bg-surface-muted flex items-center justify-center ${
          compact ? "w-24 h-24" : "max-w-xs mx-auto"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageDataUrl}
          alt={word}
          className={`object-cover ${
            compact ? "w-full h-full" : "max-h-48 w-auto rounded-xl"
          }`}
        />
      </div>
    );
  }

  const asset = resolveBuiltInAsset(word, visualKey, tags);
  if (asset) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-border bg-surface-muted/60 flex flex-col items-center ${
          compact ? "w-28" : "max-w-[220px] mx-auto"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.src}
          alt={word}
          className={`object-cover w-full ${compact ? "h-24" : "h-44"}`}
        />
        <div className="px-2 py-1 text-[11px] font-medium text-foreground/75 text-center truncate w-full bg-surface/90 border-t border-border/60">
          {asset.caption}
        </div>
      </div>
    );
  }

  const key = WORD_ALIAS[visualKey ?? word] ?? WORD_ALIAS[word] ?? visualKey ?? word;
  const spec = VISUAL_MAP[key];
  if (!spec) return null;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-gradient-to-br ${spec.bg} ${
        compact ? "px-3 py-2" : "px-5 py-3"
      }`}
    >
      {spec.svg}
      <span className="text-[11px] font-medium text-foreground/75 mt-1">
        {spec.caption}
      </span>
    </div>
  );
}
