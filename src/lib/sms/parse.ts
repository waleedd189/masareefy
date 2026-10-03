import { detectBank } from "./banks";
import { CURRENCY_PATTERN, resolveCurrency } from "./currency";
import { foldArabic, normalizeMessage, parseAmount } from "./normalize";
import { DEFAULT_DIRECTION, type CustomRule, type Direction, type ParsedSms, type TxType } from "./types";

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const WORD_EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const WORD_EDGE_AFTER = String.raw`(?![\p{L}\p{N}])`;

const MONEY_RE = new RegExp(
  `${WORD_EDGE_BEFORE}(?:(?<cur1>${CURRENCY_PATTERN})\\s*(?<num1>${NUM})|(?<num2>${NUM})\\s*(?<cur2>${CURRENCY_PATTERN}))${WORD_EDGE_AFTER}`,
  "giu",
);

const BALANCE_HINTS = [
  "available balance",
  "avail bal",
  "avl bal",
  "avbl",
  "available limit",
  "remaining",
  "balance is",
  "balance:",
  "your balance",
  "new balance",
  "current balance",
  "الرصيد المتاح",
  "الرصيد الحالي",
  "الرصيد بعد",
  "رصيدك",
  "الرصيد",
  "المتاح",
  "المتبقي",
  "المبلغ المتاح",
  "الحد المتاح",
];

const LIMIT_HINTS = ["credit limit", "الحد الائتماني", "حد البطاقه", "total limit"];

const AMOUNT_HINTS = [
  "amount of",
  "amount",
  "purchase of",
  "payment of",
  "transaction of",
  "debited with",
  "credited with",
  "debited by",
  "charged",
  "spent",
  "withdrawn",
  "transfer of",
  "for",
  "of",
  "by",
  "بمبلغ",
  "مبلغ",
  "بقيمه",
  "قيمه",
  "بمقدار",
  "تم خصم",
  "تم سحب",
  "تم دفع",
  "تم اضافه",
  "تم تحويل",
  "تم شراء",
  "خصم",
  "سحب",
];

type Rule = { type: TxType; direction?: Direction; words: string[] };

const TYPE_RULES: Rule[] = [
  {
    type: "REFUND",
    words: ["refund", "refunded", "reversal", "reversed", "استرداد", "ارتجاع", "استرجاع", "عكس عمليه", "عكس قيد", "اعاده مبلغ"],
  },
  {
    type: "WITHDRAWAL",
    words: ["cash withdrawal", "atm withdrawal", "withdrawal", "withdrawn", "atm", "سحب نقدي", "سحب نقدى", "ماكينه الصراف", "صراف الي"],
  },
  {
    type: "FEE",
    words: ["fee", "fees", "service charge", "annual fee", "رسوم", "عموله", "مصاريف اداريه", "رسم"],
  },
  {
    type: "PAYMENT",
    words: ["payment received", "card payment", "thank you for your payment", "سداد", "تم السداد", "دفعه مستحقه", "تسديد"],
  },
  {
    type: "DEPOSIT",
    words: ["deposit", "deposited", "salary", "ايداع", "تم ايداع", "راتب", "اضيف الي حسابك", "تمت اضافه"],
  },
  {
    type: "TRANSFER_IN",
    words: ["transfer received", "received from", "incoming transfer", "تحويل وارد", "حواله وارده", "تم استلام تحويل", "محول اليك"],
  },
  {
    type: "TRANSFER_OUT",
    words: ["transfer to", "outgoing transfer", "sent to", "تحويل الي", "حواله صادره", "تم تحويل مبلغ", "instapay"],
  },
  {
    type: "PURCHASE",
    words: ["purchase", "pos", "point of sale", "online transaction", "e-commerce", "spent", "debited", "شراء", "عمليه شراء", "مشتريات", "نقاط بيع", "تم خصم"],
  },
];

const IN_WORDS = ["credited", "credit of", "has been credited", "received", "added to", "تم اضافه", "تمت اضافه", "اضيف", "وارد", "دائن", "استلمت"];
const OUT_WORDS = ["debited", "debit of", "has been debited", "deducted", "charged", "withdrawn", "تم خصم", "خصم من", "صادر", "مدين", "تم سحب"];

const NON_FINANCIAL_WORDS = [
  "otp",
  "one time password",
  "verification code",
  "do not share",
  "never share",
  "رمز التحقق",
  "كود التحقق",
  "كلمه المرور",
  "لا تشارك",
  "لا تفصح",
  "عرض خاص",
  "عروض",
  "اعلان",
  "promotion",
  "promo code",
  "unsubscribe",
];

const MERCHANT_PATTERNS: RegExp[] = [
  /(?:\bat\s+)(?<m>[^\n,.;]{2,45}?)(?=\s+on\b|\s+الساعه|\s+بتاريخ|[,.;\n]|$)/iu,
  /(?:merchant|retailer)\s*[:\-]?\s*(?<m>[^\n,.;]{2,45})/iu,
  /(?:لدى|لدي|من تاجر|في محل|في متجر|لصالح|من فرع)\s+(?<m>[^\n,.;]{2,45}?)(?=\s+بتاريخ|\s+في\b|[,.;\n]|$)/u,
  /(?:to|إلى|الى)\s+(?<m>[A-Z][A-Za-z0-9&'\- ]{2,40})(?=[,.;\n]|$)/u,
];

const LAST4_PATTERNS: string[] = [
  String.raw`(?:ending(?:\s+(?:with|in))?|ends\s+with)\s*[:#]?\s*(\d{4})`,
  String.raw`(?:المنتهيه?\s*بـ?|تنتهي\s*بـ?)\s*(\d{4})`,
  String.raw`(?:[*x#•·]{2,})\s*(\d{4})`,
  String.raw`\d{6}[*x#]+(\d{4})`,
  String.raw`(?:card|بطاقه|البطاقه|كارت|الكارت|visa|فيزا|mastercard|ماستر|ميزه|meeza)\s*(?:no\.?|number|رقم|#|:)?\s*[*x#•]*\s*(\d{4})(?![\d])`,
  String.raw`(?:بطاقتك|بطاقتكم|حسابك)\D{0,20}?(\d{4})(?![\d])`,
];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

interface MoneyHit {
  index: number;
  value: number;
  currency: string | null;
  kind: "amount" | "balance" | "limit";
}

function includesAny(folded: string, words: string[]): string | null {
  for (const w of words) {
    const needle = foldArabic(w);
    if (!needle) continue;
    if (needle.length <= 3) {
      if (new RegExp(`(^|[^\\p{L}\\p{N}])${needle}([^\\p{L}\\p{N}]|$)`, "u").test(folded)) return w;
    } else if (folded.includes(needle)) return w;
  }
  return null;
}

function collectMoney(text: string): MoneyHit[] {
  const hits: MoneyHit[] = [];
  const folded = foldArabic(text);
  for (const match of text.matchAll(MONEY_RE)) {
    const groups = match.groups ?? {};
    const rawNum = groups.num1 ?? groups.num2;
    const rawCur = groups.cur1 ?? groups.cur2;
    const value = parseAmount(rawNum ?? "");
    if (value === null) continue;
    const index = match.index ?? 0;
    const before = folded.slice(Math.max(0, index - 45), index);
    let kind: MoneyHit["kind"] = "amount";
    if (includesAny(before, LIMIT_HINTS)) kind = "limit";
    else if (includesAny(before, BALANCE_HINTS)) kind = "balance";
    hits.push({ index, value, currency: resolveCurrency(rawCur), kind });
  }
  return hits;
}

/** أرقام بدون رمز عملة (لما البنك يكتب "تم خصم 150.00 من بطاقتك") */
function collectBareNumbers(text: string): MoneyHit[] {
  const hits: MoneyHit[] = [];
  const folded = foldArabic(text);
  const re = new RegExp(`${WORD_EDGE_BEFORE}(${NUM})${WORD_EDGE_AFTER}`, "gu");
  for (const match of text.matchAll(re)) {
    const raw = match[1];
    const index = match.index ?? 0;
    // تجاهل أرقام البطاقات والتواريخ والساعات
    if (/^\d{4}$/.test(raw) && /[*x#:/\-]\s*$/.test(text.slice(Math.max(0, index - 2), index))) continue;
    const after = text.slice(index + raw.length, index + raw.length + 2);
    if (/^[:/\-]\d/.test(after)) continue;
    const value = parseAmount(raw);
    if (value === null || value === 0) continue;
    const before = folded.slice(Math.max(0, index - 45), index);
    let kind: MoneyHit["kind"] = "amount";
    if (includesAny(before, LIMIT_HINTS)) kind = "limit";
    else if (includesAny(before, BALANCE_HINTS)) kind = "balance";
    else if (!includesAny(before, AMOUNT_HINTS)) continue;
    hits.push({ index, value, currency: null, kind });
  }
  return hits;
}

function extractLast4(text: string): string | null {
  const folded = foldArabic(text);
  for (const pattern of LAST4_PATTERNS) {
    const re = new RegExp(pattern, "iu");
    const direct = re.exec(text);
    if (direct?.[1]) return direct[1];
    const arabic = re.exec(folded);
    if (arabic?.[1]) return arabic[1];
  }
  return null;
}

function extractMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = pattern.exec(text);
    const value = match?.groups?.m?.trim();
    if (!value) continue;
    const cleaned = value
      .replace(/\s{2,}/g, " ")
      .replace(/^[-–:*#]+|[-–:*#]+$/g, "")
      .replace(/\b(?:on|بتاريخ|الساعه|الساعة)\b.*$/iu, "")
      .trim();
    if (cleaned.length >= 2 && !/^\d+$/.test(cleaned)) return cleaned.slice(0, 60);
  }
  return null;
}

export function extractDate(text: string, fallback?: Date | null): Date | null {
  const t = text;
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|ص|م)?/i.exec(t);
  const applyTime = (d: Date) => {
    if (time) {
      let h = Number(time[1]);
      const min = Number(time[2]);
      const mer = (time[4] ?? "").toLowerCase();
      if ((mer === "pm" || mer === "م") && h < 12) h += 12;
      if ((mer === "am" || mer === "ص") && h === 12) h = 0;
      if (h <= 23 && min <= 59) d.setHours(h, min, Number(time[3] ?? 0), 0);
    }
    return d;
  };

  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) return applyTime(d);
  }

  const dmy = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(t);
  if (dmy) {
    let day = Number(dmy[1]);
    let month = Number(dmy[2]);
    if (day <= 12 && month > 12) [day, month] = [month, day];
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    if (!Number.isNaN(d.getTime()) && month <= 12 && day <= 31) return applyTime(d);
  }

  const textual = /(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})/.exec(t);
  if (textual) {
    const month = MONTHS[textual[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      let year = Number(textual[3]);
      if (year < 100) year += 2000;
      const d = new Date(year, month, Number(textual[1]));
      if (!Number.isNaN(d.getTime())) return applyTime(d);
    }
  }

  if (fallback && time) return applyTime(new Date(fallback));
  return fallback ?? null;
}

function detectType(folded: string): { type: TxType; matched: string | null } {
  for (const rule of TYPE_RULES) {
    const hit = includesAny(folded, rule.words);
    if (hit) return { type: rule.type, matched: hit };
  }
  return { type: "UNKNOWN", matched: null };
}

function detectDirection(folded: string, type: TxType): Direction {
  if (type === "PAYMENT" || type === "REFUND" || type === "DEPOSIT" || type === "TRANSFER_IN") return "IN";
  if (includesAny(folded, OUT_WORDS)) return "OUT";
  if (includesAny(folded, IN_WORDS)) return "IN";
  return DEFAULT_DIRECTION[type];
}

export interface ParseOptions {
  sender?: string | null;
  receivedAt?: Date | null;
  customRules?: CustomRule[];
  defaultCurrency?: string;
}

/** تحليل رسالة بنك واستخراج العملية منها */
export function parseSms(rawText: string, options: ParseOptions = {}): ParsedSms {
  const text = normalizeMessage(rawText);
  const folded = foldArabic(text);
  const warnings: string[] = [];
  const bank = detectBank(text, options.sender);

  const result: ParsedSms = {
    isFinancial: true,
    bankKey: bank?.key ?? null,
    bankName: bank?.nameAr ?? null,
    amount: null,
    currency: null,
    fxAmount: null,
    fxCurrency: null,
    last4: null,
    type: "UNKNOWN",
    direction: "OUT",
    merchant: null,
    availableBalance: null,
    occurredAt: null,
    confidence: 0,
    matchedRule: null,
    normalizedText: text,
    warnings,
  };

  // 1) القواعد المخصّصة أولاً
  const rules = [...(options.customRules ?? [])].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  for (const rule of rules) {
    try {
      const re = new RegExp(rule.pattern, "iu");
      const match = re.exec(text) ?? re.exec(folded);
      if (!match) continue;
      const g = match.groups ?? {};
      result.matchedRule = rule.name;
      if (rule.bankKey && rule.bankKey !== "custom") result.bankKey = rule.bankKey;
      if (g.amount) result.amount = parseAmount(g.amount);
      if (g.currency) result.currency = resolveCurrency(g.currency);
      if (g.last4) result.last4 = g.last4;
      if (g.merchant) result.merchant = g.merchant.trim();
      if (g.balance) result.availableBalance = parseAmount(g.balance);
      if (g.date) result.occurredAt = extractDate(g.date, options.receivedAt ?? null);
      if (rule.typeHint) result.type = rule.typeHint;
      break;
    } catch {
      warnings.push(`قاعدة غير صالحة: ${rule.name}`);
    }
  }

  // 2) الاستخراج العام
  const hits = [...collectMoney(text), ...collectBareNumbers(text)].sort((a, b) => a.index - b.index);
  const amountHits = hits.filter((h) => h.kind === "amount");
  const balanceHits = hits.filter((h) => h.kind === "balance");

  if (result.amount === null && amountHits.length) {
    const withCurrency = amountHits.find((h) => h.currency);
    const chosen = withCurrency ?? amountHits[0];
    result.amount = chosen.value;
    result.currency = result.currency ?? chosen.currency;

    // عملية بعملة أجنبية: مبلغين بعملتين مختلفتين
    const foreign = amountHits.find((h) => h.currency && chosen.currency && h.currency !== chosen.currency);
    if (foreign) {
      const local = options.defaultCurrency ?? bank?.currency ?? "EGP";
      if (foreign.currency === local) {
        result.fxAmount = chosen.value;
        result.fxCurrency = chosen.currency;
        result.amount = foreign.value;
        result.currency = foreign.currency;
      } else {
        result.fxAmount = foreign.value;
        result.fxCurrency = foreign.currency;
      }
    }
  }

  if (result.availableBalance === null && balanceHits.length) {
    result.availableBalance = balanceHits[balanceHits.length - 1].value;
  }

  if (!result.currency) result.currency = options.defaultCurrency ?? bank?.currency ?? null;
  if (!result.last4) result.last4 = extractLast4(text);
  if (!result.merchant) result.merchant = extractMerchant(text);
  if (!result.occurredAt) result.occurredAt = extractDate(text, options.receivedAt ?? null);

  const typeInfo = detectType(folded);
  if (result.type === "UNKNOWN") result.type = typeInfo.type;
  result.direction = detectDirection(folded, result.type);

  // 3) رسالة غير مالية؟
  const nonFinancial = includesAny(folded, NON_FINANCIAL_WORDS);
  if (nonFinancial && (result.amount === null || /otp|رمز التحقق|كود التحقق|verification code/iu.test(folded))) {
    result.isFinancial = false;
    warnings.push("الرسالة تبدو غير مالية (كود تحقق أو إعلان)");
  }
  if (result.amount === null) {
    result.isFinancial = false;
    warnings.push("لم يتم العثور على مبلغ في الرسالة");
  }

  // 4) درجة الثقة
  let score = 0;
  if (result.amount !== null) score += 0.4;
  if (result.currency) score += 0.05;
  if (result.last4) score += 0.25;
  if (result.type !== "UNKNOWN") score += 0.15;
  if (result.bankKey) score += 0.05;
  if (result.merchant) score += 0.05;
  if (result.availableBalance !== null) score += 0.05;
  if (result.matchedRule) score = Math.max(score, 0.9);
  if (!result.isFinancial) score = Math.min(score, 0.2);
  result.confidence = Math.round(Math.min(1, score) * 100) / 100;

  if (!result.last4) warnings.push("لم يتم تحديد رقم البطاقة (آخر 4 أرقام)");

  return result;
}

/** تقسيم نص ملصوق فيه أكتر من رسالة (سطر فاضي بين كل رسالة) */
export function splitMessages(input: string): string[] {
  return normalizeMessage(input)
    .split(/\n\s*\n+|\n-{3,}\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 8);
}
