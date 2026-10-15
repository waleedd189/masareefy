import { toEnglishDigits } from "@/lib/sms/normalize";
import type { TxType } from "@/lib/sms/types";

export type VoiceCard = {
  id: string;
  name: string;
  last4: string;
  bankKey: string;
};

export type VoiceExpenseDraft = {
  transcript: string;
  amount: number | null;
  cardId: string;
  type: TxType;
  merchant: string;
};

const NUMBER_WORDS: Record<string, number> = {
  صفر: 0,
  واحد: 1,
  واحده: 1,
  اتنين: 2,
  اثنين: 2,
  اثنان: 2,
  تلاته: 3,
  ثلاثه: 3,
  اربعه: 4,
  خمسه: 5,
  سته: 6,
  سبعه: 7,
  تمانيه: 8,
  ثمانيه: 8,
  تسعه: 9,
  عشره: 10,
  حداشر: 11,
  احداشر: 11,
  اتناشر: 12,
  اثناشر: 12,
  تلتاشر: 13,
  تلاتاشر: 13,
  اربعتاشر: 14,
  خمستاشر: 15,
  ستاشر: 16,
  سبعتاشر: 17,
  تمنتاشر: 18,
  تسعتاشر: 19,
  عشرين: 20,
  تلاتين: 30,
  ثلاثين: 30,
  اربعين: 40,
  خمسين: 50,
  ستين: 60,
  سبعين: 70,
  تمانين: 80,
  ثمانين: 80,
  تسعين: 90,
  ميه: 100,
  مائه: 100,
  ميتين: 200,
  مئتين: 200,
  تلتميه: 300,
  ثلاثميه: 300,
  ربعمية: 400,
  اربعمية: 400,
  خمسمية: 500,
  ستمية: 600,
  سبعمية: 700,
  تمنمية: 800,
  ثمانمية: 800,
  تسعمية: 900,
};

function fold(input: string): string {
  return toEnglishDigits(input)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064b-\u0652]/g, "")
    .toLowerCase()
    .trim();
}

function wordValue(rawWord: string): number | null {
  const word = fold(rawWord).replace(/^[,،.]+|[,،.]+$/g, "");
  if (NUMBER_WORDS[word] !== undefined) return NUMBER_WORDS[word];
  if (word.startsWith("و") && NUMBER_WORDS[word.slice(1)] !== undefined) return NUMBER_WORDS[word.slice(1)];
  return null;
}

/** يحوّل الصياغات المصرية الشائعة مثل «ميتين وخمسين» و«ألف وتلتمية». */
export function parseSpokenArabicNumber(input: string): number | null {
  const words = fold(input).split(/\s+/).filter(Boolean);
  let total = 0;
  let group = 0;
  let found = false;

  for (const rawWord of words) {
    const word = rawWord.replace(/^[,،.]+|[,،.]+$/g, "");
    if (["الف", "الاف", "الفين"].includes(word) || ["والف", "والاف", "والفين"].includes(word)) {
      const base = word.replace(/^و/, "");
      group = group || (base === "الفين" ? 2 : 1);
      total += group * 1000;
      group = 0;
      found = true;
      continue;
    }
    const value = wordValue(word);
    if (value !== null) {
      group += value;
      found = true;
    }
  }

  return found ? total + group : null;
}

function extractAmount(text: string, card: VoiceCard | undefined): number | null {
  const normalized = fold(text).replace(/٬/g, ",").replace(/٫/g, ".");
  const withCurrency = /(?:^|\s)(\d+(?:[,.]\d{1,2})?)\s*(?:جنيه|جنية|جنيهات|ج\.?\s?م|egp|دولار|usd|ريال|sar)(?:\s|$)/i.exec(normalized);
  if (withCurrency) return Number(withCurrency[1].replace(",", "."));

  const currencyIndex = normalized.search(/(?:جنيه|جنية|جنيهات|دولار|ريال)/i);
  if (currencyIndex > 0) {
    const beforeCurrency = normalized.slice(0, currencyIndex).split(/\s+/).slice(-8).join(" ");
    const spoken = parseSpokenArabicNumber(beforeCurrency);
    if (spoken !== null && spoken > 0) return spoken;
  }

  const numbers = [...normalized.matchAll(/(?:^|\s)(\d+(?:[,.]\d{1,2})?)(?=\s|$)/g)]
    .map((match) => match[1])
    .filter((value) => value !== card?.last4);
  const raw = numbers[0];
  return raw ? Number(raw.replace(",", ".")) : null;
}

function detectType(text: string): TxType {
  const value = fold(text);
  if (/استرداد|مرتجع|رجعلي|ريفاند|refund/.test(value)) return "REFUND";
  if (/سحب|atm|ماكينه/.test(value)) return "WITHDRAWAL";
  if (/سداد|سددت|دفعت الكارت/.test(value)) return "PAYMENT";
  if (/رسوم|عموله|مصاريف اداريه/.test(value)) return "FEE";
  if (/مرتب|راتب|ايداع/.test(value)) return "DEPOSIT";
  if (/تحويل.*(?:لي|وارد)|استلمت تحويل/.test(value)) return "TRANSFER_IN";
  if (/حولت|تحويل.*(?:لـ|الي)|انستاباي/.test(value)) return "TRANSFER_OUT";
  return "PURCHASE";
}

function matchCard(text: string, cards: VoiceCard[]): VoiceCard | undefined {
  const value = fold(text);
  const byLast4 = cards.find((card) => value.includes(card.last4));
  if (byLast4) return byLast4;

  const byName = [...cards]
    .sort((a, b) => b.name.length - a.name.length)
    .find((card) => value.includes(fold(card.name)));
  if (byName) return byName;

  const bankMatches = cards.filter((card) => card.bankKey !== "generic" && value.includes(fold(card.bankKey)));
  return bankMatches.length === 1 ? bankMatches[0] : undefined;
}

function extractMerchant(text: string): string {
  const normalized = toEnglishDigits(text).trim();
  const match = /(?:\s|^)(?:في|عند|لدى|من عند)\s+(.+?)(?=\s+(?:على|بكارت|ببطاقه|ببطاقة|من كارت|من بطاقه|من بطاقة)(?:\s|$)|$)/iu.exec(normalized);
  const merchant = match?.[1]?.replace(/[،,.]+$/g, "").trim() ?? "";
  return /^(?:كارت|بطاق|فيزا|ماستر)/iu.test(merchant) ? "" : merchant.slice(0, 120);
}

export function parseVoiceExpense(transcript: string, cards: VoiceCard[]): VoiceExpenseDraft {
  const card = matchCard(transcript, cards);
  return {
    transcript: transcript.trim(),
    amount: extractAmount(transcript, card),
    cardId: card?.id ?? (cards.length === 1 ? cards[0].id : ""),
    type: detectType(transcript),
    merchant: extractMerchant(transcript),
  };
}
