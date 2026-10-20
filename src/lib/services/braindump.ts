import { foldArabic, normalizeMessage, parseAmount } from "@/lib/sms/normalize";
import { matchWord, type UserWord } from "@/lib/sms/vocabulary";
import { extractDate } from "@/lib/sms/parse";
import type { TxType } from "@/lib/sms/types";

/**
 * التفريغ السريع (Brain dump) — مقابل ودجت/شاشة "اكتب اليوم كله ونحن نقسّمه" في Mezanetak.
 * بتاخد نص حر بالعربي المصري وتقسّمه لمسودات عمليات (مبلغ + تاجر + فئة + تاريخ).
 *
 * القاعدة: أي مبلغ في النص يبدأ "بند" جديد، والفواصل/حروف العطف (و، ثم، وبعدين) بتفصل البنود.
 */

export interface BrainDumpDraft {
  raw: string;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  type: TxType;
  occurredAt: Date | null;
  categoryId: string | null;
  matchedWord: string | null;
}

export interface BrainDumpCategory {
  id: string;
  name: string;
  emoji: string;
  keywords: string;
}

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const CURRENCY = String.raw`(?:ج\.?م\.?|جنيه[اًا]?|egp|le|l\.e\.?|دولار[اًا]?|usd|\$|ريال|sar|درهم|aed|يورو|eur)`;
const AMOUNT_RE = new RegExp(`(?<![\\d.,])(${NUM})\\s*(${CURRENCY})?|(${CURRENCY})\\s*(${NUM})`, "giu");

const SPLIT_WORDS = ["ثم", "وبعدين", "وبعدها", "كمان", "ايضا", "أيضًا", "بالإضافة", "بالاضافه", "plus", "then"];

function suggestCategory(text: string, categories: BrainDumpCategory[]): string | null {
  const folded = foldArabic(text);
  let best: { id: string; score: number } | null = null;
  for (const category of categories) {
    for (const raw of category.keywords.split(",")) {
      const keyword = foldArabic(raw);
      if (keyword.length < 2 || !folded.includes(keyword)) continue;
      if (!best || keyword.length > best.score) best = { id: category.id, score: keyword.length };
    }
    if (folded.includes(category.name.slice(0, 4))) {
      if (!best) best = { id: category.id, score: 3 };
    }
  }
  return best?.id ?? null;
}

/** تقطيع النص لبنود: كل بند فيه مبلغ واحد */
export function splitBrainDump(input: string): string[] {
  const text = normalizeMessage(input);
  const chunks: string[] = [];

  for (const line of text.split(/\n+/)) {
    if (!line.trim()) continue;
    // فصل عند حروف الربط الصريحة
    let parts = [line];
    for (const word of SPLIT_WORDS) {
      parts = parts.flatMap((part) => part.split(new RegExp(`(?:^|\\s)${word}\\s*[:,-]?\\s+`, "iu")));
    }
    // فصل عند الفواصل العربية/الإنجليزية لو بعدها مبلغ
    parts = parts.flatMap((part) => part.split(/[,;،]+(?=\s*[^\s]*\d)/u));
    chunks.push(...parts.map((p) => p.trim()).filter(Boolean));
  }

  // لو بند فيه أكتر من مبلغ → قسّمه عند كل مبلغ
  const out: string[] = [];
  for (const chunk of chunks) {
    const hits = [...chunk.matchAll(AMOUNT_RE)];
    if (hits.length <= 1) {
      out.push(chunk);
      continue;
    }
    for (let i = 0; i < hits.length; i++) {
      const start = hits[i].index ?? 0;
      const end = i + 1 < hits.length ? (hits[i + 1].index ?? chunk.length) : chunk.length;
      const piece = chunk.slice(Math.max(0, start - 25), end).trim();
      if (piece) out.push(piece);
    }
  }
  return out.filter((c) => c.length > 1);
}

export function parseBrainDump(
  input: string,
  categories: BrainDumpCategory[],
  userWords: UserWord[] = [],
  fallbackDate: Date | null = null,
): BrainDumpDraft[] {
  const chunks = splitBrainDump(input);
  const drafts: BrainDumpDraft[] = [];

  for (const chunk of chunks) {
    const hits = [...chunk.matchAll(AMOUNT_RE)];
    const amounts = hits
      .map((m) => ({ value: parseAmount(m[1] ?? m[4] ?? ""), currency: m[2] ?? m[3] ?? null, index: m.index ?? 0 }))
      .filter((h) => h.value !== null && h.value > 0);

    const folded = foldArabic(chunk);
    const wordHit = matchWord(folded, userWords);
    const date = extractDate(chunk, fallbackDate);

    if (!amounts.length) {
      drafts.push({
        raw: chunk,
        amount: null,
        currency: null,
        merchant: cleanMerchant(chunk),
        type: (wordHit?.kind as TxType) ?? "UNKNOWN",
        occurredAt: date,
        categoryId: wordHit?.categoryId ?? suggestCategory(chunk, categories),
        matchedWord: wordHit?.word ?? null,
      });
      continue;
    }

    const amount = amounts[0];
    // التاجر: النص قبل المبلغ (أو بعده لو مفيش قبل)
    const before = chunk.slice(0, amount.index).trim();
    const after = chunk.slice(amount.index).replace(new RegExp(`^(${AMOUNT_RE.source})`, "iu"), "").trim();
    const merchantSource = before.length >= 2 ? before : after;

    drafts.push({
      raw: chunk,
      amount: amount.value,
      currency: amount.currency ? amount.currency.toUpperCase().replace(/[^A-Z]/g, "") || "EGP" : "EGP",
      merchant: cleanMerchant(merchantSource),
      type: wordHit && wordHit.kind !== "IGNORE" ? (wordHit.kind as TxType) : "PURCHASE",
      occurredAt: date,
      categoryId: wordHit?.categoryId ?? suggestCategory(chunk, categories),
      matchedWord: wordHit?.word ?? null,
    });
  }

  return drafts;
}

const NOISE = /^(?:و|ف|ثم|في|من|على|علي|الي|إلى|الى|بـ?|مصروف|صرفت|دفع[ت]?|اشتريت|شريت|قيمة|مبلغ|حساب|فاتوره|فاتورة|عشان|لـ?|at|for|paid|spent)\s+/iu;

function cleanMerchant(text: string): string | null {
  if (!text) return null;
  let value = text.replace(NOISE, "").trim();
  value = value.replace(/^[-–—:•*]+|[-–—:•*]+$/g, "").trim();
  value = value.replace(/\s{2,}/g, " ");
  if (value.length < 2 || /^\d+$/.test(value)) return null;
  return value.slice(0, 60);
}
