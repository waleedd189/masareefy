/**
 * مفردات تصنيف نوع العملية — عربي/إنجليزي.
 *
 * القائمة مبنية على نفس المنهج في تطبيق Mezanetak (`SmsVocabulary` + `SmsWordKind`)
 * مع دعم **كلمات يتعلّمها المستخدم** (`parser_words`) تتقدّم على المفردات المدمجة.
 */

import { foldArabic } from "./normalize";
import type { TxType } from "./types";

/** أنواع الكلمات: نوع عملية أو تجاهل */
export type WordKind = TxType | "IGNORE";

export const WORD_KIND_LABELS: Record<WordKind, string> = {
  PURCHASE: "شراء",
  WITHDRAWAL: "سحب نقدي",
  TRANSFER_OUT: "تحويل صادر",
  TRANSFER_IN: "تحويل وارد",
  REFUND: "استرداد",
  PAYMENT: "سداد",
  DEPOSIT: "إيداع/دخل",
  FEE: "رسوم",
  UNKNOWN: "غير محدد",
  IGNORE: "تجاهل الرسالة",
};

/** مفردات مدمجة (built-in) — مرتبة بالأولوية: الأول في القائمة له أسبقية */
export const BUILTIN_WORDS: { kind: WordKind; words: string[] }[] = [
  {
    kind: "IGNORE",
    words: [
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
      "للمزيد",
      "اتصل ب",
    ],
  },
  {
    kind: "REFUND",
    words: [
      "refund",
      "refunded",
      "reversal",
      "reversed",
      "canceled",
      "cancelled",
      "استرداد",
      "استرجاع",
      "ارتجاع",
      "رد مبلغ",
      "مرتجع",
      "الغاء",
      "عكس عمليه",
      "عكس قيد",
      "اعاده مبلغ",
    ],
  },
  {
    kind: "WITHDRAWAL",
    words: [
      "cash withdrawal",
      "atm withdrawal",
      "withdrawal",
      "withdrawn",
      "atm",
      "pos cash",
      "سحب نقدي",
      "سحب نقدى",
      "سحب",
      "صراف",
      "صراف الي",
      "ماكينه الصراف",
    ],
  },
  {
    kind: "FEE",
    words: [
      "annual fee",
      "service charge",
      "late fee",
      "fee",
      "fees",
      "رسوم",
      "عموله",
      "مصاريف اداريه",
      "رسم",
      "دمغه",
    ],
  },
  {
    kind: "PAYMENT",
    words: [
      "payment received",
      "card payment",
      "thank you for your payment",
      "bill payment",
      "سداد",
      "تم السداد",
      "تسديد",
      "دفعه مستحقه",
      "سداد بطاقه",
      "تحصيل",
      "تم تحصيل",
      "قسط",
      "سداد قسط",
      "فاتوره",
    ],
  },
  {
    kind: "DEPOSIT",
    words: [
      "deposit",
      "deposited",
      "salary",
      "payroll",
      "ايداع",
      "تم ايداع",
      "راتب",
      "مرتب",
      "اضيف الي حسابك",
      "تمت اضافه",
    ],
  },
  {
    kind: "TRANSFER_IN",
    words: [
      "transfer received",
      "incoming transfer",
      "received from",
      "credited with",
      "تحويل وارد",
      "حواله وارده",
      "تم استلام تحويل",
      "محول اليك",
      "وارد",
      "استلمت",
    ],
  },
  {
    kind: "TRANSFER_OUT",
    words: [
      "transfer to",
      "outgoing transfer",
      "sent to",
      "you sent",
      "transfer sent",
      "تحويل الي",
      "حواله صادره",
      "تم تحويل مبلغ",
      "تحويل",
      "ارسلت",
      "حولت",
      "ارسال",
      "instapay",
      "انستاباي",
    ],
  },
  {
    kind: "PURCHASE",
    words: [
      "purchase",
      "purchased",
      "pos",
      "point of sale",
      "online transaction",
      "e-commerce",
      "spent",
      "debited",
      "deducted",
      "charged",
      "شراء",
      "عمليه شراء",
      "مشتريات",
      "نقاط بيع",
      "تم خصم",
      "خصم",
      "دفع",
      "مدفوعات",
      "مدين",
    ],
  },
];

/** خريطة كلمة مطويّة ← نوع (مدمجة) */
export const BUILTIN_WORD_MAP: Map<string, WordKind> = (() => {
  const map = new Map<string, WordKind>();
  for (const group of BUILTIN_WORDS) {
    for (const word of group.words) {
      const key = foldArabic(word);
      if (key && !map.has(key)) map.set(key, group.kind);
    }
  }
  return map;
})();

export interface UserWord {
  wordKey: string;
  display: string;
  kind: WordKind;
  categoryId?: string | null;
}

/**
 * مطابقة أطول كلمة من المفردات في نص مطوي.
 * كلمات المستخدم لها أولوية، وبعدها المدمجة.
 */
export function matchWord(
  folded: string,
  userWords: UserWord[] = [],
): { kind: WordKind; word: string; categoryId?: string | null; origin: "USER" | "BUILTIN" } | null {
  const visible = userWords.filter((w) => w.wordKey && w.wordKey.length >= 2);
  const sortedUser = [...visible].sort((a, b) => b.wordKey.length - a.wordKey.length);

  for (const word of sortedUser) {
    if (folded.includes(word.wordKey)) {
      return { kind: word.kind, word: word.display || word.wordKey, categoryId: word.categoryId ?? null, origin: "USER" };
    }
  }

  // المدمجة: الأطول أولًا لتفادي مطابقة كلمة جزئية
  let best: { kind: WordKind; word: string; origin: "BUILTIN" } | null = null;
  for (const [key, kind] of BUILTIN_WORD_MAP) {
    if (key.length < 2) continue;
    if (!folded.includes(key)) continue;
    // الكلمات القصيرة جدًا لازم تكون كلمة كاملة
    if (key.length <= 3 && !new RegExp(`(^|[^\\p{L}\\p{N}])${key}([^\\p{L}\\p{N}]|$)`, "u").test(folded)) continue;
    if (!best || key.length > best.word.length) best = { kind, word: key, origin: "BUILTIN" };
  }
  return best;
}

/** تطبيع كلمة يكتبها المستخدم لمفتاح مطابقة */
export function wordKey(input: string): string {
  return foldArabic(input).replace(/\s+/g, " ").trim();
}
