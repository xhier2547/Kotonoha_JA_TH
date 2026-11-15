export interface KanaChar {
  id: string;
  hiragana: string;
  katakana: string;
  romaji: string;
  thaiSound: string;
  row: string;
  group: "seion" | "dakuten" | "yoon";
  mnemonicHira: string;
  mnemonicKata: string;
}

export const KANA_DATA: KanaChar[] = [
  // あ行
  { id: "a", hiragana: "あ", katakana: "ア", romaji: "a", thaiSound: "อะ", row: "あ", group: "seion", mnemonicHira: "รูปคนกางแขนร้อง 'อ๊ะ!' (เหมือน ตัว A ที่มีห่วง)", mnemonicKata: "หัวขวานโค้งชี้ขวา เสียง 'อะ'" },
  { id: "i", hiragana: "い", katakana: "イ", romaji: "i", thaiSound: "อิ", row: "あ", group: "seion", mnemonicHira: "สองขีดคู่ เหมือนปลาไหล 2 ตัว (eel -> อิ)", mnemonicKata: "เหมือนตัว i กลับหัว หรือคนยืนตรง 'อิ'" },
  { id: "u", hiragana: "う", katakana: "ウ", romaji: "u", thaiSound: "อุ", row: "あ", group: "seion", mnemonicHira: "คนโดนต่อยท้องร้อง 'อุ๊!' หลังงอ", mnemonicKata: "กรอบบนมีขีดตั้งเหมือนมงกุฎ 'อุ'" },
  { id: "e", hiragana: "え", katakana: "エ", romaji: "e", thaiSound: "เอะ", row: "あ", group: "seion", mnemonicHira: "นกฟลามิงโก้เต้น 'เอ๊ะ!'", mnemonicKata: "ตัวอักษร I พิมพ์ใหญ่แบบกางปีก (Elevator -> เอะ)" },
  { id: "o", hiragana: "お", katakana: "オ", romaji: "o", thaiSound: "โอะ", row: "あ", group: "seion", mnemonicHira: "ไม้กอล์ฟตีลูกกลมๆ ปลิวไปข้างบน 'โอ้!'", mnemonicKata: "เหมือนเครื่องหมายบวกมีหางเตะ 'โอ้!'" },

  // か行
  { id: "ka", hiragana: "か", katakana: "カ", romaji: "ka", thaiSound: "คะ", row: "か", group: "seion", mnemonicHira: "ใบมีดตัด (Cut -> คะ) มีสะเก็ดกระเด็นข้างขวา", mnemonicKata: "เหมือน か แต่ตัดจุดเล็กๆ ออก เหลือใบมีดคม" },
  { id: "ki", hiragana: "き", katakana: "キ", romaji: "ki", thaiSound: "คิ", row: "か", group: "seion", mnemonicHira: "ลูกกุญแจ (Key -> คิ) มีฟันสองซี่", mnemonicKata: "กุญแจแบบเหลี่ยม (Key)" },
  { id: "ku", hiragana: "く", katakana: "ク", romaji: "ku", thaiSound: "คุ", row: "か", group: "seion", mnemonicHira: "จะงอยปากนกร้อง 'คุกคู'", mnemonicKata: "เหมือนเลข 7 มีหมวกเอียง" },
  { id: "ke", hiragana: "け", katakana: "ケ", romaji: "ke", thaiSound: "เคะ", row: "か", group: "seion", mnemonicHira: "ถังเบียร์ (Keg -> เคะ) ตั้งตรง", mnemonicKata: "เหมือนตัว K หันข้าง" },
  { id: "ko", hiragana: "こ", katakana: "コ", romaji: "ko", thaiSound: "โคะ", row: "か", group: "seion", mnemonicHira: "เส้นโค้งบนล่างประกบเหมือนเหรียญ (Coin -> โคะ)", mnemonicKata: "มุมฉากสองด้าน (Corner -> โคะ)" },

  // さ行
  { id: "sa", hiragana: "さ", katakana: "サ", romaji: "sa", thaiSound: "ซะ", row: "さ", group: "seion", mnemonicHira: "คล้าย き แต่มีแขนเดียว เหมือนคนกำลังเดินแซะ (ซะ)", mnemonicKata: "รั้วไม้ 3 ซี่ (Saddle -> ซะ)" },
  { id: "shi", hiragana: "し", katakana: "シ", romaji: "shi", thaiSound: "ชิ", row: "さ", group: "seion", mnemonicHira: "เบ็ดตกปลาหงาย (Fishing -> ชิ)", mnemonicKata: "หน้ายิ้มมองขึ้น (ขีดไล่จากล่างขึ้นบน!)" },
  { id: "su", hiragana: "す", katakana: "ス", romaji: "su", thaiSound: "ซึ", row: "さ", group: "seion", mnemonicHira: "ม้วนหางเหมือนลูกอ๊อดว่ายน้ำ 'ซึบ'", mnemonicKata: "นักสกีพุ่งลงเนิน (Ski -> ซึ)" },
  { id: "se", hiragana: "せ", katakana: "セ", romaji: "se", thaiSound: "เซะ", row: "さ", group: "seion", mnemonicHira: "ปากกำลังพูด 'Say' (เซะ)", mnemonicKata: "เวอร์ชันเหลี่ยมของ せ" },
  { id: "so", hiragana: "そ", katakana: "ソ", romaji: "so", thaiSound: "โซะ", row: "さ", group: "seion", mnemonicHira: "เข็มเย็บผ้า (Sew -> โซะ) ร้อยเป็นซิกแซ็ก", mnemonicKata: "จุดบน 1 ขีดแล้วลากลง (ระวังสลับกับ ン)" },

  // た行
  { id: "ta", hiragana: "た", katakana: "タ", romaji: "ta", thaiSound: "ทะ", row: "た", group: "seion", mnemonicHira: "มองเป็นตัว 't' และ 'a' รวมกัน = ta", mnemonicKata: "แท็บเล็ตวางเอียง (Tablet -> ทะ)" },
  { id: "chi", hiragana: "ち", katakana: "チ", romaji: "chi", thaiSound: "ชิ (จิ)", row: "た", group: "seion", mnemonicHira: "เหมือนเลข 5 หรือคนเชียร์ (Cheer -> ชิ)", mnemonicKata: "เชียร์ลีดเดอร์กางแขนยกขา" },
  { id: "tsu", hiragana: "つ", katakana: "ツ", romaji: "tsu", thaiSound: "ทซึ", row: "た", group: "seion", mnemonicHira: "คลื่นสึนามิ (Tsunami) โค้งซัดมา", mnemonicKata: "ขีดสองอันตกลงมาจากด้านบน เหมือนฝนตกใส่สึนามิ" },
  { id: "te", hiragana: "て", katakana: "テ", romaji: "te", thaiSound: "เทะ", row: "た", group: "seion", mnemonicHira: "หางสุนัขโค้ง (Tail -> เทะ)", mnemonicKata: "ตัว T ที่มีหลังคา 2 ชั้น" },
  { id: "to", hiragana: "と", katakana: "ト", romaji: "to", thaiSound: "โทะ", row: "た", group: "seion", mnemonicHira: "นิ้วเท้ามีหนามตำ (Toe -> โทะ)", mnemonicKata: "เสาโทเทม (Totem -> โทะ)" },

  // な行
  { id: "na", hiragana: "な", katakana: "ナ", romaji: "na", thaiSound: "นะ", row: "な", group: "seion", mnemonicHira: "ไม้กางเขนกับคนคุกเข่า 'นะโม'", mnemonicKata: "มีดสั้นไขว้ (Knife -> นะ)" },
  { id: "ni", hiragana: "に", katakana: "ニ", romaji: "ni", thaiSound: "นิ", row: "な", group: "seion", mnemonicHira: "หัวเข่า (Knee -> นิ) งอข้างขีดตั้ง", mnemonicKata: "เลข 2 ในภาษาญี่ปุ่น (Ni = 2)" },
  { id: "nu", hiragana: "ぬ", katakana: "ヌ", romaji: "nu", thaiSound: "นุ", row: "な", group: "seion", mnemonicHira: "เส้นบะหมี่ (Noodle -> นุ) พันกันเป็นปม", mnemonicKata: "ตะเกียบคีบเส้นบะหมี่ 1 เส้น" },
  { id: "ne", hiragana: "ね", katakana: "ネ", romaji: "ne", thaiSound: "เนะ", row: "な", group: "seion", mnemonicHira: "แมว (Neko) ม้วนหางขดเป็นวงกลม", mnemonicKata: "เสารังนก (Nest -> เนะ)" },
  { id: "no", hiragana: "の", katakana: "ノ", romaji: "no", thaiSound: "โนะ", row: "な", group: "seion", mnemonicHira: "ป้ายห้าม 'No' ม้วนวงกลม", mnemonicKata: "ขีดเฉียงขีดเดียว (SLASH) ง่ายที่สุด!" },

  // は行
  { id: "ha", hiragana: "は", katakana: "ハ", romaji: "ha", thaiSound: "ฮะ", row: "は", group: "seion", mnemonicHira: "รูปตัว H และ a รวมกัน = ha (หัวเราะ ฮ่าๆ)", mnemonicKata: "หลังคาบ้าน หรือตัวอักษร 'ฮะ' 2 ขีด" },
  { id: "hi", hiragana: "ひ", katakana: "ヒ", romaji: "hi", thaiSound: "ฮิ", row: "は", group: "seion", mnemonicHira: "ปากยิ้มกว้างหัวเราะ 'ฮิฮิ'", mnemonicKata: "คนที่ยื่นแขนทักทาย 'Hi!'" },
  { id: "fu", hiragana: "ふ", katakana: "フ", romaji: "fu", thaiSound: "ฟุ (ฮึ)", row: "は", group: "seion", mnemonicHira: "ภูเขาไฟฟูจิ (Mt. Fuji) มีหิมะบนยอด", mnemonicKata: "ปากพ่นลมเบาๆ เป่าลม 'ฟู่' (ออกเสียงกึ่ง ฟ-ฮ)" },
  { id: "he", hiragana: "へ", katakana: "ヘ", romaji: "he", thaiSound: "เฮะ", row: "は", group: "seion", mnemonicHira: "ยอดเขาชี้ขึ้นฟ้า (Heaven) หน้าตาเหมือนกันทั้งคู่!", mnemonicKata: "เหมือน へ ในฮิรางานะเป๊ะ!" },
  { id: "ho", hiragana: "ほ", katakana: "ホ", romaji: "ho", thaiSound: "โฮะ", row: "は", group: "seion", mnemonicHira: "เหมือน は แต่มีขีดหลังคาเพิ่ม เป็นซานต้า 'โฮ่ๆ'", mnemonicKata: "ต้นคริสต์มาสศักดิ์สิทธิ์ (Holy -> โฮะ)" },

  // ま行
  { id: "ma", hiragana: "ま", katakana: "マ", romaji: "ma", thaiSound: "มะ", row: "ま", group: "seion", mnemonicHira: "เสาเรือมีใบเรือ 2 ชั้น (Mast -> มะ)", mnemonicKata: "รูปเรขาคณิตเหมือนปากอ้า (Mouth -> มะ)" },
  { id: "mi", hiragana: "み", katakana: "ミ", romaji: "mi", thaiSound: "มิ", row: "ま", group: "seion", mnemonicHira: "เลข 21 โค้งๆ (อายุ 21 ของฉัน 'Me')", mnemonicKata: "ขีดสามขีด (Three -> มิสึ) หรือหนวดแมว 3 เส้น" },
  { id: "mu", hiragana: "む", katakana: "ム", romaji: "mu", thaiSound: "มุ", row: "ま", group: "seion", mnemonicHira: "หน้าวัวร้อง 'มู๊!' (Moo)", mnemonicKata: "หัววัวแบบสามเหลี่ยมเหลี่ยม" },
  { id: "me", hiragana: "め", katakana: "メ", romaji: "me", thaiSound: "เมะ", row: "ま", group: "seion", mnemonicHira: "คล้าย ぬ แต่ไม่มีห่วงม้วน (Me = ตา)", mnemonicKata: "กากบาทไขว้ (X) เหมือนรอยแผลเป็นตรงตา" },
  { id: "mo", hiragana: "も", katakana: "モ", romaji: "mo", thaiSound: "โมะ", row: "ま", group: "seion", mnemonicHira: "เบ็ดตกปลาได้เหยื่อ 'More' (โมะ)", mnemonicKata: "เบ็ดเหลี่ยมขีดขวางสองเส้น" },

  // や行
  { id: "ya", hiragana: "や", katakana: "ヤ", romaji: "ya", thaiSound: "ยะ", row: "や", group: "seion", mnemonicHira: "ตัวจามรี (Yak -> ยะ) มีเขา", mnemonicKata: "เหมือน や แต่ตัดขีดจุดออก" },
  { id: "yu", hiragana: "ゆ", katakana: "ユ", romaji: "yu", thaiSound: "ยุ", row: "や", group: "seion", mnemonicHira: "ปลาว่ายเป็นวงกลมในน้ำพุร้อน (Yu = น้ำร้อน)", mnemonicKata: "กล้องส่องเรือดำน้ำ (U-boat -> ยุ)" },
  { id: "yo", hiragana: "よ", katakana: "ヨ", romaji: "yo", thaiSound: "โยะ", row: "や", group: "seion", mnemonicHira: "โยโย่ (Yo-yo) ห้อยเชือกลงมา", mnemonicKata: "ตัว E กลับด้าน (โยะ!)" },

  // ら行
  { id: "ra", hiragana: "ら", katakana: "ラ", romaji: "ra", thaiSound: "ระ", row: "ら", group: "seion", mnemonicHira: "กระต่าย (Rabbit -> ระ) นั่งห้อยหู", mnemonicKata: "หัวกระต่ายสวมหมวกเอียง" },
  { id: "ri", hiragana: "り", katakana: "リ", romaji: "ri", thaiSound: "ริ", row: "ら", group: "seion", mnemonicHira: "ต้นกก (Reed -> ริ) 2 ต้นริมน้ำ", mnemonicKata: "เหมือน り แต่เส้นตรงคมกว่า" },
  { id: "ru", hiragana: "る", katakana: "ル", romaji: "ru", thaiSound: "รุ", row: "ら", group: "seion", mnemonicHira: "เลข 3 ม้วนหางเป็นรู (Ru)", mnemonicKata: "รากไม้ (Root -> รุ) สองแฉก" },
  { id: "re", hiragana: "れ", katakana: "レ", romaji: "re", thaiSound: "เระ", row: "ら", group: "seion", mnemonicHira: "กวางเรนเดียร์ (Reindeer) เตะขาหลัง", mnemonicKata: "เส้นหักมุมชี้ขึ้นด้านขวา (Razor -> เระ)" },
  { id: "ro", hiragana: "ろ", katakana: "ロ", romaji: "ro", thaiSound: "โระ", row: "ら", group: "seion", mnemonicHira: "เลข 3 ไม่มีห่วง (โดนขโมย 'Rob' ห่วงไป!)", mnemonicKata: "สี่เหลี่ยมปากกล่อง (Road block -> โระ)" },

  // わ・を・ん
  { id: "wa", hiragana: "わ", katakana: "ワ", romaji: "wa", thaiSound: "วะ", row: "わ", group: "seion", mnemonicHira: "คล้าย ね แต่ห้อยโค้งลงเหมือนน้ำตก (Waterfall)", mnemonicKata: "แก้วไวน์ (Wine glass -> วะ)" },
  { id: "wo", hiragana: "を", katakana: "ヲ", romaji: "wo", thaiSound: "โอะ (คำช่วย)", row: "わ", group: "seion", mnemonicHira: "คนร้อง 'ว้าว!' ขาพันกัน (ใช้เป็นคำช่วยกรรม を)", mnemonicKata: "เวอร์ชันคาตาคานะของ を (ใช้น้อย)" },
  { id: "n", hiragana: "ん", katakana: "ン", romaji: "n", thaiSound: "น / ง (ตัวสะกด)", row: "わ", group: "seion", mnemonicHira: "เหมือนตัว n พิมพ์เล็ก!", mnemonicKata: "ขีดสั้น 1 แล้วตวัดขึ้นขวา (คล้ายหน้ามองตรงข้างๆ)" },

  // Dakuten & Handakuten (25)
  { id: "ga", hiragana: "が", katakana: "ガ", romaji: "ga", thaiSound: "กะ / งะ", row: "が", group: "dakuten", mnemonicHira: "か + เต็นเต็น (゛)", mnemonicKata: "カ + ゛" },
  { id: "gi", hiragana: "ぎ", katakana: "ギ", romaji: "gi", thaiSound: "กิ", row: "が", group: "dakuten", mnemonicHira: "き + ゛", mnemonicKata: "キ + ゛" },
  { id: "gu", hiragana: "ぐ", katakana: "グ", romaji: "gu", thaiSound: "กุ", row: "が", group: "dakuten", mnemonicHira: "く + ゛", mnemonicKata: "ク + ゛" },
  { id: "ge", hiragana: "げ", katakana: "ゲ", romaji: "ge", thaiSound: "เกะ", row: "が", group: "dakuten", mnemonicHira: "け + ゛", mnemonicKata: "ケ + ゛" },
  { id: "go", hiragana: "ご", katakana: "ゴ", romaji: "go", thaiSound: "โกะ", row: "が", group: "dakuten", mnemonicHira: "こ + ゛", mnemonicKata: "コ + ゛" },

  { id: "za", hiragana: "ざ", katakana: "ザ", romaji: "za", thaiSound: "ซะ (สั่น)", row: "ざ", group: "dakuten", mnemonicHira: "さ + ゛", mnemonicKata: "サ + ゛" },
  { id: "ji", hiragana: "じ", katakana: "ジ", romaji: "ji", thaiSound: "จิ", row: "ざ", group: "dakuten", mnemonicHira: "し + ゛ (พิมพ์ ji)", mnemonicKata: "シ + ゛" },
  { id: "zu", hiragana: "ず", katakana: "ズ", romaji: "zu", thaiSound: "ซึ (สั่น)", row: "ざ", group: "dakuten", mnemonicHira: "す + ゛", mnemonicKata: "ス + ゛" },
  { id: "ze", hiragana: "ぜ", katakana: "ゼ", romaji: "ze", thaiSound: "เซะ (สั่น)", row: "ざ", group: "dakuten", mnemonicHira: "せ + ゛", mnemonicKata: "セ + ゛" },
  { id: "zo", hiragana: "ぞ", katakana: "ゾ", romaji: "zo", thaiSound: "โซะ (สั่น)", row: "ざ", group: "dakuten", mnemonicHira: "そ + ゛", mnemonicKata: "ソ + ゛" },

  { id: "da", hiragana: "だ", katakana: "ダ", romaji: "da", thaiSound: "ดะ", row: "だ", group: "dakuten", mnemonicHira: "た + ゛", mnemonicKata: "タ + ゛" },
  { id: "di", hiragana: "ぢ", katakana: "ヂ", romaji: "di", thaiSound: "จิ (di)", row: "だ", group: "dakuten", mnemonicHira: "ち + ゛ (พิมพ์ di)", mnemonicKata: "チ + ゛" },
  { id: "du", hiragana: "づ", katakana: "ヅ", romaji: "du", thaiSound: "ซึ (du)", row: "だ", group: "dakuten", mnemonicHira: "つ + ゛ (พิมพ์ du)", mnemonicKata: "ツ + ゛" },
  { id: "de", hiragana: "で", katakana: "デ", romaji: "de", thaiSound: "เดะ", row: "だ", group: "dakuten", mnemonicHira: "て + ゛", mnemonicKata: "テ + ゛" },
  { id: "do", hiragana: "ど", katakana: "ド", romaji: "do", thaiSound: "โดะ", row: "だ", group: "dakuten", mnemonicHira: "と + ゛", mnemonicKata: "ト + ゛" },

  { id: "ba", hiragana: "ば", katakana: "バ", romaji: "ba", thaiSound: "บะ", row: "ば", group: "dakuten", mnemonicHira: "は + ゛", mnemonicKata: "ハ + ゛" },
  { id: "bi", hiragana: "び", katakana: "ビ", romaji: "bi", thaiSound: "บิ", row: "ば", group: "dakuten", mnemonicHira: "ひ + ゛", mnemonicKata: "ヒ + ゛" },
  { id: "bu", hiragana: "ぶ", katakana: "ブ", romaji: "bu", thaiSound: "บุ", row: "ば", group: "dakuten", mnemonicHira: "ふ + ゛", mnemonicKata: "フ + ゛" },
  { id: "be", hiragana: "べ", katakana: "ベ", romaji: "be", thaiSound: "เบะ", row: "ば", group: "dakuten", mnemonicHira: "へ + ゛", mnemonicKata: "ヘ + ゛" },
  { id: "bo", hiragana: "ぼ", katakana: "ボ", romaji: "bo", thaiSound: "โบะ", row: "ば", group: "dakuten", mnemonicHira: "ほ + ゛", mnemonicKata: "ホ + ゛" },

  { id: "pa", hiragana: "ぱ", katakana: "パ", romaji: "pa", thaiSound: "ปะ", row: "ぱ", group: "dakuten", mnemonicHira: "は + มารุ (゜)", mnemonicKata: "ハ + ゜" },
  { id: "pi", hiragana: "ぴ", katakana: "ピ", romaji: "pi", thaiSound: "ปิ", row: "ぱ", group: "dakuten", mnemonicHira: "ひ + ゜", mnemonicKata: "ヒ + ゜" },
  { id: "pu", hiragana: "ぷ", katakana: "プ", romaji: "pu", thaiSound: "ปุ", row: "ぱ", group: "dakuten", mnemonicHira: "ふ + ゜", mnemonicKata: "フ + ゜" },
  { id: "pe", hiragana: "ぺ", katakana: "ペ", romaji: "pe", thaiSound: "เปะ", row: "ぱ", group: "dakuten", mnemonicHira: "へ + ゜", mnemonicKata: "ヘ + ゜" },
  { id: "po", hiragana: "ぽ", katakana: "ポ", romaji: "po", thaiSound: "โปะ", row: "ぱ", group: "dakuten", mnemonicHira: "ほ + ゜", mnemonicKata: "ホ + ゜" },

  // Yoon (ควบกล้ำ) - Key selection
  { id: "kya", hiragana: "きゃ", katakana: "キャ", romaji: "kya", thaiSound: "เคียะ", row: "きゃ", group: "yoon", mnemonicHira: "き + ゃ เล็ก", mnemonicKata: "キ + ャ เล็ก" },
  { id: "kyu", hiragana: "きゅ", katakana: "キュ", romaji: "kyu", thaiSound: "คิว", row: "きゃ", group: "yoon", mnemonicHira: "き + ゅ เล็ก", mnemonicKata: "キ + ュ เล็ก" },
  { id: "kyo", hiragana: "きょ", katakana: "キョ", romaji: "kyo", thaiSound: "เคียว", row: "きゃ", group: "yoon", mnemonicHira: "き + ょ เล็ก", mnemonicKata: "キ + ョ เล็ก" },
  { id: "sha", hiragana: "しゃ", katakana: "シャ", romaji: "sha", thaiSound: "ชะ", row: "しゃ", group: "yoon", mnemonicHira: "し + ゃ เล็ก", mnemonicKata: "シ + ャ เล็ก" },
  { id: "shu", hiragana: "しゅ", katakana: "シュ", romaji: "shu", thaiSound: "ชุ", row: "しゃ", group: "yoon", mnemonicHira: "し + ゅ เล็ก", mnemonicKata: "シ + ュ เล็ก" },
  { id: "sho", hiragana: "しょ", katakana: "ショ", romaji: "sho", thaiSound: "โชะ", row: "しゃ", group: "yoon", mnemonicHira: "し + ょ เล็ก", mnemonicKata: "シ + ョ เล็ก" },
  { id: "cha", hiragana: "ちゃ", katakana: "チャ", romaji: "cha", thaiSound: "ชะ", row: "ちゃ", group: "yoon", mnemonicHira: "ち + ゃ เล็ก", mnemonicKata: "チ + ャ เล็ก" },
  { id: "chu", hiragana: "ちゅ", katakana: "チュ", romaji: "chu", thaiSound: "ชุ", row: "ちゃ", group: "yoon", mnemonicHira: "ち + ゅ เล็ก", mnemonicKata: "チ + ュ เล็ก" },
  { id: "cho", hiragana: "ちょ", katakana: "チョ", romaji: "cho", thaiSound: "โชะ", row: "ちゃ", group: "yoon", mnemonicHira: "ち + ょ เล็ก", mnemonicKata: "チ + ョ เล็ก" },
  { id: "nya", hiragana: "にゃ", katakana: "ニャ", romaji: "nya", thaiSound: "เนียะ", row: "にゃ", group: "yoon", mnemonicHira: "に + ゃ เล็ก", mnemonicKata: "ニ + ャ เล็ก" },
  { id: "nyu", hiragana: "にゅ", katakana: "ニュ", romaji: "nyu", thaiSound: "นิว", row: "にゃ", group: "yoon", mnemonicHira: "に + ゅ เล็ก", mnemonicKata: "ニ + ュ เล็ก" },
  { id: "nyo", hiragana: "にょ", katakana: "ニョ", romaji: "nyo", thaiSound: "เนียว", row: "にゃ", group: "yoon", mnemonicHira: "に + ょ เล็ก", mnemonicKata: "ニ + ョ เล็ก" },
  { id: "rya", hiragana: "りゃ", katakana: "リャ", romaji: "rya", thaiSound: "เรียะ", row: "りゃ", group: "yoon", mnemonicHira: "り + ゃ เล็ก", mnemonicKata: "リ + ャ เล็ก" },
  { id: "ryu", hiragana: "りゅ", katakana: "リュ", romaji: "ryu", thaiSound: "ริว", row: "りゃ", group: "yoon", mnemonicHira: "り + ゅ เล็ก", mnemonicKata: "リ + ュ เล็ก" },
  { id: "ryo", hiragana: "りょ", katakana: "リョ", romaji: "ryo", thaiSound: "เรียว", row: "りゃ", group: "yoon", mnemonicHira: "り + ょ เล็ก", mnemonicKata: "リ + ョ เล็ก" },
  { id: "ja", hiragana: "じゃ", katakana: "ジャ", romaji: "ja", thaiSound: "จะ", row: "じゃ", group: "yoon", mnemonicHira: "じ + ゃ เล็ก", mnemonicKata: "ジ + ャ เล็ก" },
  { id: "ju", hiragana: "じゅ", katakana: "ジュ", romaji: "ju", thaiSound: "จุ", row: "じゃ", group: "yoon", mnemonicHira: "じ + ゅ เล็ก", mnemonicKata: "ジ + ュ เล็ก" },
  { id: "jo", hiragana: "じょ", katakana: "ジョ", romaji: "jo", thaiSound: "โจ๊ะ", row: "じゃ", group: "yoon", mnemonicHira: "じ + ょ เล็ก", mnemonicKata: "ジ + ョ เล็ก" },
];
