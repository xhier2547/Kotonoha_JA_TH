export type WordClass = "ichidan" | "godan" | "irregular" | "i-adj" | "na-adj";

export type ConjugationForm =
  | "masu"
  | "nai"
  | "te"
  | "ta"
  | "tai"
  | "potential"
  | "volitional"
  | "ba";

export interface ConjugationItem {
  id: string;
  dictForm: string;
  reading: string;
  wordClass: WordClass;
  meaningTh: string;
  jlpt: "N5" | "N4";
}

export const CONJUGATION_FORM_INFO: Record<
  ConjugationForm,
  { label: string; labelJp: string; hintTh: string; usageTh: string }
> = {
  masu: {
    label: "Polite (ます形)",
    labelJp: "丁寧形",
    hintTh: "รูปสุภาพปัจจุบัน/อนาคต",
    usageTh: "ใช้พูดคุยสุภาพทั่วไป เช่น 食べます / です",
  },
  nai: {
    label: "Negative (ない形)",
    labelJp: "否定形",
    hintTh: "รูปปฏิเสธ (กันเอง)",
    usageTh: "แปลว่า 'ไม่...' ใช้ต่อกับ ください (อย่า) หรือ なければならない (ต้อง)",
  },
  te: {
    label: "Te-form (て形)",
    labelJp: "て形",
    hintTh: "รูปเชื่อมประโยค / ขอร้อง",
    usageTh: "ใช้เชื่อมกริยา, ～てください (กรุณา), ～ている (กำลังทำ)",
  },
  ta: {
    label: "Past Plain (た形)",
    labelJp: "過去形",
    hintTh: "รูปอดีต (กันเอง)",
    usageTh: "แปลว่า '...แล้ว' ใช้ต่อกับ ～ことがある (เคย) หรือ ～ほうがいい (ควร)",
  },
  tai: {
    label: "Want to (たい形)",
    labelJp: "願望",
    hintTh: "อยากจะ...",
    usageTh: "ตัด ます เติม たい เพื่อบอกความต้องการของผู้พูด",
  },
  potential: {
    label: "Potential (可能形)",
    labelJp: "可能形",
    hintTh: "สามารถ...ได้",
    usageTh: "Ichidan เติม られる / Godan เปลี่ยนเสียง u→e + る",
  },
  volitional: {
    label: "Volitional (意向形)",
    labelJp: "意向形",
    hintTh: "ชวนทำ / ตั้งใจจะ...",
    usageTh: "แปลว่า 'กันเถอะ / ว่าจะ...' เช่น 食べよう, 行こう",
  },
  ba: {
    label: "Conditional (ば形)",
    labelJp: "仮定形",
    hintTh: "ถ้า...",
    usageTh: "แสดงเงื่อนไข 'ถ้าทำสิ่งนี้ ก็จะ...'",
  },
};

const GODAN_A: Record<string, string> = {
  う: "わ",
  く: "か",
  ぐ: "が",
  す: "さ",
  つ: "た",
  ぬ: "な",
  ぶ: "ば",
  む: "ま",
  る: "ら",
};

const GODAN_I: Record<string, string> = {
  う: "い",
  く: "き",
  ぐ: "ぎ",
  す: "し",
  つ: "ち",
  ぬ: "に",
  ぶ: "び",
  む: "み",
  る: "り",
};

const GODAN_E: Record<string, string> = {
  う: "え",
  く: "け",
  ぐ: "げ",
  す: "せ",
  つ: "て",
  ぬ: "ね",
  ぶ: "べ",
  む: "め",
  る: "れ",
};

const GODAN_O: Record<string, string> = {
  う: "お",
  く: "こ",
  ぐ: "ご",
  す: "そ",
  つ: "と",
  ぬ: "の",
  ぶ: "ぼ",
  む: "も",
  る: "ろ",
};

function conjugateGodanTeTa(stem: string, last: string, isTa: boolean, dict: string): string {
  const t = isTa ? "た" : "て";
  const d = isTa ? "だ" : "で";

  // Exception 行く / いく
  if (dict === "行く" || dict === "いく") {
    return stem + "っ" + t;
  }
  if (last === "う" || last === "つ" || last === "る") return stem + "っ" + t;
  if (last === "む" || last === "ぶ" || last === "ぬ") return stem + "ん" + d;
  if (last === "く") return stem + "い" + t;
  if (last === "ぐ") return stem + "い" + d;
  if (last === "す") return stem + "し" + t;
  return dict;
}

export function conjugateWord(
  word: string,
  wordClass: WordClass,
  form: ConjugationForm
): { answer: string; ruleTh: string } {
  if (wordClass === "irregular") {
    const isSuru = word.endsWith("する");
    const prefix = word.slice(0, -2);
    if (isSuru) {
      const map: Record<ConjugationForm, [string, string]> = {
        masu: [prefix + "します", "する → します"],
        nai: [prefix + "しない", "する → しない"],
        te: [prefix + "して", "する → して"],
        ta: [prefix + "した", "する → した"],
        tai: [prefix + "したい", "する → したい"],
        potential: [prefix + "できる", "する → できる (ข้อยกเว้น)"],
        volitional: [prefix + "しよう", "する → しよう"],
        ba: [prefix + "すれば", "する → すれば"],
      };
      return { answer: map[form][0], ruleTh: map[form][1] };
    }
    // くる / 来る
    const isKanjiKuru = word.endsWith("来る");
    const kStem = word.slice(0, -2);
    const kuruForms: Record<ConjugationForm, [string, string]> = {
      masu: [isKanjiKuru ? kStem + "来ます" : kStem + "きます", "くる → きます"],
      nai: [isKanjiKuru ? kStem + "来ない" : kStem + "こない", "くる → こない (ออกเสียง โค๊ะ-ไน)"],
      te: [isKanjiKuru ? kStem + "来て" : kStem + "きて", "くる → きて"],
      ta: [isKanjiKuru ? kStem + "来た" : kStem + "きた", "くる → きた"],
      tai: [isKanjiKuru ? kStem + "来たい" : kStem + "きたい", "くる → きたい"],
      potential: [isKanjiKuru ? kStem + "来られる" : kStem + "こられる", "くる → こられる"],
      volitional: [isKanjiKuru ? kStem + "来よう" : kStem + "こよう", "くる → こよう"],
      ba: [isKanjiKuru ? kStem + "来れば" : kStem + "くれば", "くる → くれば"],
    };
    return { answer: kuruForms[form][0], ruleTh: kuruForms[form][1] };
  }

  if (wordClass === "ichidan") {
    const stem = word.slice(0, -1);
    const map: Record<ConjugationForm, [string, string]> = {
      masu: [stem + "ます", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม ます"],
      nai: [stem + "ない", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม ない"],
      te: [stem + "て", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม て"],
      ta: [stem + "た", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม た"],
      tai: [stem + "たい", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม たい"],
      potential: [stem + "られる", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม られる"],
      volitional: [stem + "よう", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม よう"],
      ba: [stem + "れば", "กริยากลุ่ม 2 (Ichidan): ตัด る เติม れば"],
    };
    return { answer: map[form][0], ruleTh: map[form][1] };
  }

  if (wordClass === "godan") {
    const stem = word.slice(0, -1);
    const last = word.slice(-1);

    switch (form) {
      case "masu":
        return {
          answer: stem + (GODAN_I[last] ?? last) + "ます",
          ruleTh: `กริยากลุ่ม 1 (Godan): เปลี่ยน ${last} เป็นแถว i (${GODAN_I[last]}) + ます`,
        };
      case "nai":
        if (word === "ある") return { answer: "ない", ruleTh: "ある เป็นข้อยกเว้น → ない" };
        return {
          answer: stem + (GODAN_A[last] ?? last) + "ない",
          ruleTh: `กริยากลุ่ม 1 (Godan): เปลี่ยน ${last} เป็นแถว a (${GODAN_A[last]}) + ない`,
        };
      case "te":
        return {
          answer: conjugateGodanTeTa(stem, last, false, word),
          ruleTh: `กริยากลุ่ม 1 (Godan): ผันเสียง て ตามตัวลงท้าย ${last}`,
        };
      case "ta":
        return {
          answer: conjugateGodanTeTa(stem, last, true, word),
          ruleTh: `กริยากลุ่ม 1 (Godan): ผันเสียง た ตามตัวลงท้าย ${last}`,
        };
      case "tai":
        return {
          answer: stem + (GODAN_I[last] ?? last) + "たい",
          ruleTh: `กริยากลุ่ม 1 (Godan): เปลี่ยน ${last} เป็นแถว i (${GODAN_I[last]}) + たい`,
        };
      case "potential":
        return {
          answer: stem + (GODAN_E[last] ?? last) + "る",
          ruleTh: `กริยากลุ่ม 1 (Godan): เปลี่ยน ${last} เป็นแถว e (${GODAN_E[last]}) + る`,
        };
      case "volitional":
        return {
          answer: stem + (GODAN_O[last] ?? last) + "う",
          ruleTh: `กริยากลุ่ม 1 (Godan): เปลี่ยน ${last} เป็นแถว o (${GODAN_O[last]}) + う`,
        };
      case "ba":
        return {
          answer: stem + (GODAN_E[last] ?? last) + "ば",
          ruleTh: `กริยากลุ่ม 1 (Godan): เปลี่ยน ${last} เป็นแถว e (${GODAN_E[last]}) + ば`,
        };
    }
  }

  if (wordClass === "i-adj") {
    const isIi = word === "いい" || word === "良い";
    const stem = isIi ? (word === "いい" ? "よ" : "良") : word.slice(0, -1);
    const map: Partial<Record<ConjugationForm, [string, string]>> = {
      masu: [word + "です", "คำคุณศัพท์ い: คงรูปเดิม + です"],
      nai: [stem + "くない", "คำคุณศัพท์ い: ตัด い เติม くない"],
      te: [stem + "くて", "คำคุณศัพท์ い: ตัด い เติม くて"],
      ta: [stem + "かった", "คำคุณศัพท์ い: ตัด い เติม かった"],
      ba: [stem + "ければ", "คำคุณศัพท์ い: ตัด い เติม ければ"],
    };
    const found = map[form];
    return found
      ? { answer: found[0], ruleTh: found[1] }
      : { answer: word + "です", ruleTh: "ใช้รูปสุภาพพื้นฐาน + です" };
  }

  // na-adj
  const mapNa: Partial<Record<ConjugationForm, [string, string]>> = {
    masu: [word + "です", "คำคุณศัพท์ な: เติม です"],
    nai: [word + "じゃない", "คำคุณศัพท์ な: เติม じゃない (สุภาพ: じゃありません)"],
    te: [word + "で", "คำคุณศัพท์ な: เติม で"],
    ta: [word + "だった", "คำคุณศัพท์ な: เติม だった (สุภาพ: でした)"],
    ba: [word + "なら", "คำคุณศัพท์ な: เติม なら"],
  };
  const foundNa = mapNa[form];
  return foundNa
    ? { answer: foundNa[0], ruleTh: foundNa[1] }
    : { answer: word + "です", ruleTh: "เติม です" };
}
