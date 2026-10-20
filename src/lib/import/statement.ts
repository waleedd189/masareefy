import { parseAmount, foldArabic } from "@/lib/sms/normalize";
import { DEFAULT_DIRECTION, type TxType } from "@/lib/sms/types";

/**
 * تحليل سطور كشف الحساب (من PDF أو نص منسوخ) إلى صفوف عمليات.
 *
 * الكشوف بتيجي بأشكال مختلفة، فالقاعدة: أي سطر فيه **مبلغ** + (تاريخ أو وصف)
 * يبقى صف مرشّح، وبنستثني سطور الأرصدة والإجماليات والترويسات.
 */

export interface StatementRow {
  date: Date | null;
  amount: number;
  currency: string;
  merchant: string | null;
  description: string;
  type: TxType;
  direction: "OUT" | "IN";
  /** السطر الخام (للمعاينة والتتبع) */
  raw: string;
  /** درجة ثقة بسيطة 0—1 */
  confidence: number;
}

export interface StatementParseResult {
  rows: StatementRow[];
  skipped: number;
  reasons: string[];
}

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`;
const AMOUNT_RE = new RegExp(`(?<![\\d.,/-])(${NUM})`, "g");

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, يناير: 0, فبراير: 1, feb: 1, february: 1, مارس: 2, mar: 2, march: 2,
  ابريل: 3, أبريل: 3, apr: 3, april: 3, مايو: 4, may: 4, يونيو: 5, jun: 5, june: 5,
  يوليو: 6, jul: 6, july: 6, اغسطس: 7, أغسطس: 7, aug: 7, august: 7, سبتمبر: 8, sep: 8, sept: 8, september: 8,
  اكتوبر: 9, أكتوبر: 9, oct: 9, october: 9, نوفمبر: 10, nov: 10, november: 10, ديسمبر: 11, dec: 11, december: 11,
};

const CURRENCY_HINTS: { code: string; pattern: RegExp }[] = [
  { code: "USD", pattern: /\b(usd|\$|دولار)/i },
  { code: "EUR", pattern: /\b(eur|€|يورو)/i },
  { code: "GBP", pattern: /\b(gbp|£|استرليني)/i },
  { code: "SAR", pattern: /\b(sar|ريال)/i },
  { code: "AED", pattern: /\b(aed|درهم)/i },
  { code: "EGP", pattern: /\b(egp|ج\.?م\.?|جنيه)/i },
];

/** سطور الأرصدة والإجماليات — مش عمليات */
const SKIP_RE =
  /(opening balance|closing balance|previous balance|available balance|current balance|total\s|sub\s?total|grand total|الرصيد (السابق|الحالي|المتاح|الافتتاحي|الختامي)|رصيد اول|رصيد اخر|الاجمالي|الإجمالي|مجموع|بيان|تاريخ|value date|transaction date|page \d|statement of account|كشف حساب)/i;

const TYPE_RULES: { type: TxType; words: string[] }[] = [
  { type: "FEE", words: ["رسوم", "عموله", "عمولة", "fee", "charges", "charge", "مصروفات اداريه"] },
  { type: "REFUND", words: ["استرداد", "مرتجع", "refund", "reversal", "credit adjustment"] },
  { type: "WITHDRAWAL", words: ["سحب", "atm", "withdrawal", "cash withdrawal", "سحب نقدي"] },
  { type: "DEPOSIT", words: ["ايداع", "إيداع", "deposit", "salary", "راتب", "payroll", "credit interest", "فائده"] },
  { type: "TRANSFER_OUT", words: ["تحويل صادر", "transfer out", "outgoing transfer", "تحويل الي", "wire transfer"] },
  { type: "TRANSFER_IN", words: ["تحويل وارد", "transfer in", "incoming transfer", "instapay", "انستاباي"] },
  { type: "PAYMENT", words: ["سداد", "قسط", "فاتوره", "فاتورة", "payment", "bill", "تحصيل"] },
  { type: "PURCHASE", words: ["شراء", "مشتريات", "purchase", "pos", "sale", "debit card", "بطاقه"] },
];

function parseDateFrom(text: string, fallbackYear: number): Date | null {
  const cleaned = text.trim();

  // 2026-10-05 أو 2026/10/05
  const iso = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(cleaned);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // 05/10/2026 أو 05-10-26 (يوم/شهر/سنة)
  const dmy = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(cleaned);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    // لو الشهر أكبر من 12 يبقى الترتيب شهر/يوم
    if (month > 12 && day <= 12) {
      const date = new Date(year, day - 1, month);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  // 05 Oct 2026 / 5 أكتوبر
  const named = /\b(\d{1,2})\s+([A-Za-z\u0600-\u06FF]{3,10})\s*(\d{2,4})?/.exec(cleaned);
  if (named) {
    const monthKey = foldArabic(named[2].toLowerCase());
    const month = MONTHS[monthKey] ?? MONTHS[named[2].toLowerCase()];
    if (month !== undefined) {
      let year = named[3] ? Number(named[3]) : fallbackYear;
      if (year < 100) year += 2000;
      const date = new Date(year, month, Number(named[1]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  // 05/10 (يوم/شهر بس)
  const short = /\b(\d{1,2})[/.](\d{1,2})\b/.exec(cleaned);
  if (short) {
    const day = Number(short[1]);
    const month = Number(short[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(fallbackYear, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

interface Candidate {
  value: number;
  raw: string;
}

function amountCandidates(line: string): Candidate[] {
  const out: Candidate[] = [];
  for (const match of line.matchAll(AMOUNT_RE)) {
    const value = parseAmount(match[1]);
    if (value !== null && value > 0) out.push({ value, raw: match[1] });
  }
  return out;
}

/**
 * اختيار مبلغ العملية من بين أرقام السطر.
 *
 * الكشوف عادةً فيها عمودين: المبلغ ثم الرصيد الجاري، فأخذ "آخر رقم" بيطلع الرصيد.
 * الحل: **اختبار استمرارية الرصيد** — الرصيد السابق ± المبلغ = الرصيد في آخر السطر.
 * لو الاختبار نجح بنرجّع المبلغ الصحيح وثقة أعلى، وإلا بناخد الرقم قبل الأخير.
 */
function pickAmount(
  candidates: Candidate[],
  prevBalance: number | null,
): { amount: number; balance: number | null; continuity: boolean } {
  if (candidates.length === 1) return { amount: candidates[0].value, balance: null, continuity: false };

  const last = candidates[candidates.length - 1].value;
  if (prevBalance !== null) {
    for (let i = candidates.length - 2; i >= 0; i--) {
      const value = candidates[i].value;
      if (Math.abs(prevBalance - value - last) < 0.02 || Math.abs(prevBalance + value - last) < 0.02) {
        return { amount: value, balance: last, continuity: true };
      }
    }
  }
  return { amount: candidates[candidates.length - 2].value, balance: last, continuity: false };
}

function detectCurrency(text: string): string {
  for (const hint of CURRENCY_HINTS) if (hint.pattern.test(text)) return hint.code;
  return "EGP";
}

/**
 * نوع العملية واتجاهها.
 *
 * ملاحظة: في الكشوف علامات **DR/CR (مدين/دائن) هي المرجع الأساسي للاتجاه**،
 * لأنها أوضح من الكلمات (مثال: "سداد فاتورة" في كشف = فلوس خارجة = DR،
 * بينما `DEFAULT_DIRECTION.PAYMENT` مبنية على سياق رسائل البنك).
 */
function detectType(text: string, hasCreditMarker: boolean, hasDebitMarker: boolean): { type: TxType; direction: "OUT" | "IN" } {
  const folded = foldArabic(text.toLowerCase());
  for (const rule of TYPE_RULES) {
    if (rule.words.some((word) => folded.includes(foldArabic(word.toLowerCase())))) {
      const direction = hasDebitMarker ? "OUT" : hasCreditMarker ? "IN" : DEFAULT_DIRECTION[rule.type];
      return { type: rule.type, direction };
    }
  }
  if (hasCreditMarker) return { type: "DEPOSIT", direction: "IN" };
  if (hasDebitMarker) return { type: "PURCHASE", direction: "OUT" };
  return { type: "PURCHASE", direction: "OUT" };
}

/** إزالة التاريخ والأرقام من السطر عشان يفضل الوصف/التاجر */
function extractDescription(line: string, date: Date | null, amounts: string[]): string {
  let text = line;
  if (date) {
    text = text
      .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, " ")
      .replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, " ");
  }
  for (const amount of amounts) text = text.replace(amount, " ");
  text = text
    // علامات مدين/دائن والاختصارات مش جزء من الوصف
    .replace(/\b(cr|dr|dbl|deb|cred)\b/gi, " ")
    .replace(/(?:^|\s)(مدين|دائن|مدينه|دائنه)(?=\s|$)/g, " ")
    // بقايا أرقام (مراجع/أرصدة/أجزاء مبلغ اتشالت)
    .replace(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g, " ")
    .replace(/[.,:-]{2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[|\s:.,-]+|[|\s:.,-]+$/g, "")
    .trim();
  return text.slice(0, 160);
}

/**
 * تحليل سطور الكشف.
 * `defaultCurrency` و`defaultYear` بيكملوا الناقص لو السطر مش واضح.
 */
export function parseStatementLines(
  lines: string[],
  options: { defaultCurrency?: string; defaultYear?: number; maxRows?: number } = {},
): StatementParseResult {
  const defaultCurrency = options.defaultCurrency ?? "EGP";
  const defaultYear = options.defaultYear ?? new Date().getFullYear();
  const maxRows = options.maxRows ?? 500;
  const reasons = new Set<string>();
  const rows: StatementRow[] = [];
  let skipped = 0;
  /** الرصيد الجاري من السطر اللي فات (لاختبار استمرارية الرصيد) */
  let prevBalance: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (rows.length >= maxRows) break;

    if (SKIP_RE.test(line)) {
      skipped++;
      reasons.add("سطر رصيد/إجمالي/ترويسة");
      continue;
    }

    const candidates = amountCandidates(line);
    if (!candidates.length) {
      skipped++;
      reasons.add("مفيش مبلغ صالح في السطر");
      continue;
    }

    const picked = pickAmount(candidates, prevBalance);
    const amount = picked.amount;
    const amountMatches = candidates.map((c) => c.raw);

    const date = parseDateFrom(line, defaultYear);
    const currency = detectCurrency(line);
    const hasCredit = /\b(cr|credit)\b/i.test(line) || /دائن/.test(line);
    const hasDebit = /\b(dr|debit|dbl|deb)\b/i.test(line) || /مدين/.test(line);
    const { type, direction } = detectType(line, hasCredit, hasDebit);
    const description = extractDescription(line, date, amountMatches);

    if (!date && !description) {
      skipped++;
      reasons.add("مفيش تاريخ ولا وصف");
      continue;
    }

    let confidence = 0.55;
    if (date) confidence += 0.2;
    if (picked.continuity) confidence += 0.15;
    else if (candidates.length === 1) confidence += 0.05;
    if (description.length >= 3) confidence += 0.1;
    if (hasCredit || hasDebit) confidence += 0.1;
    if (currency !== defaultCurrency && CURRENCY_HINTS.some((h) => h.code === currency && h.pattern.test(line))) confidence += 0.05;

    if (picked.balance !== null) prevBalance = picked.balance;

    rows.push({
      date,
      amount,
      currency: currency === "EGP" ? defaultCurrency : currency,
      merchant: description.length >= 2 && description.length <= 40 ? description : null,
      description,
      type,
      direction,
      raw: line,
      confidence: Math.min(1, Math.round(confidence * 100) / 100),
    });
  }

  return { rows, skipped, reasons: [...reasons] };
}

/** معاينة سريعة: أول صفوف + عدد المتخطّى (للعرض قبل الحفظ) */
export function summarizeStatement(result: StatementParseResult): string {
  const total = result.rows.reduce((sum, row) => sum + row.amount, 0);
  return `${result.rows.length} صف · إجمالي ${Math.round(total).toLocaleString("en-US")} · اتخطّى ${result.skipped}`;
}
