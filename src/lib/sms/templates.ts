/**
 * قوالب رسائل موثّقة لكل بنك — مستوحاة من سجل القوالب في تطبيق Mezanetak
 * (`SmsTemplateRegistry` + `SmsConfidence=VERIFIED`).
 *
 * كل قالب Regex بمجموعات مسماة: amount · last4 · merchant · date · balance · currency
 * ولو طابق القالب الرسالة بنعتبر النتيجة **موثّقة** (VERIFIED) مش مجرد تخمين عام.
 *
 * المعرّف بصيغة `<bank>.<kind>.v<n>` — زيادة الرقم عند تغيير الصيغة تسمح برفض نتائج
 * محلل قديم (نفس فكرة `minParserVersion`).
 */

import type { Direction, TxType } from "./types";

/** إصدار المحلل — يزيد عند أي تغيير جوهري في القوالب */
export const PARSER_VERSION = 2;

export interface SmsTemplate {
  id: string;
  bankKey: string;
  nameAr: string;
  kind: TxType;
  direction: Direction;
  /** Regex بمجموعات مسماة — يُجرَّب على النص المطبَّع ثم على النص المطوي (foldArabic) */
  pattern: string;
}

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const DATE = String.raw`\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?`;
const CUR = String.raw`(?:egp|le|l\.e\.?|ج\.?م\.?|جنيه[اًا]?|usd|\$|دولار[اًا]?|eur|€|يورو|sar|ريال|aed|درهم|gbp|£)`;
const LAST4_PFX = String.raw`(?:\*{2,}|x{2,}|#{2,}|#)?\s*`;
/** تاء مربوطة أو هاء — عشان نفس القالب يشتغل على النص الأصلي وعلى النص المطوي */
const T = String.raw`[\u0629\u0647]`;
/** ياء أو ألف مقصورة (إلى/علي) */
const Y = String.raw`[\u064A\u0649]`;
/** ألف/همزة بأشكالها */
const A = String.raw`[\u0627\u0623\u0625\u0622]`;
/**
 * نهاية اسم التاجر: كلمة حدّ (on/at/بتاريخ/يوم/عبر) أو وقت أو فاصل أو نهاية السطر.
 * بدونه المطابقة الكسولة بتقطف أول حرفين بس.
 */
const M_END = String.raw`(?=\s+(?:on|at|via|بتاريخ|يوم|عبر|في|from)\s|\s+\d{1,2}:\d{2}|[,;،]\s|\.\s|\s*$)`;
const MERCHANT = String.raw`(?<merchant>[^\n]{2,60}?)${M_END}`;
const ON_DATE = String.raw`(?:\s+on\s+(?<date>${DATE}))?`;
const AR_DATE = String.raw`(?:\s+بتاريخ\s+(?<date>${DATE}))?`;

export const SMS_TEMPLATES: SmsTemplate[] = [
  // ── بنك مصر (صيغ مستخرجة من التطبيق المرجعي مع تسامح في الألف/التاء المربوطة) ────────
  {
    id: "banque-misr.purchase.v1",
    bankKey: "misr",
    nameAr: "بنك مصر — خصم بطاقة (شراء)",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`بطاق${T}\s+بنك\s+مصر\s*${LAST4_PFX}(?<last4>\d{4})\s*[،,]?\s*تم\s+ال${A}ن\s+خصم\s+(?<amount>${NUM})\s*${CUR}?\s*(?:عند|لدي|لدى)\s+${MERCHANT}\s*يوم\s+(?<date>${DATE})`,
  },
  {
    id: "banque-misr.transfer-in.v1",
    bankKey: "misr",
    nameAr: "بنك مصر — تحويل وارد",
    kind: "TRANSFER_IN",
    direction: "IN",
    pattern: String.raw`تم\s+${A}ضاف${T}\s+مبلغ\s+(?<amount>${NUM})\s*${CUR}?\s+${A}ل${Y}?\s+حساب\s+رقم\s*${LAST4_PFX}(?<last4>\d{4})`,
  },
  {
    id: "banque-misr.transfer-out.v1",
    bankKey: "misr",
    nameAr: "بنك مصر — تحويل صادر",
    kind: "TRANSFER_OUT",
    direction: "OUT",
    pattern: String.raw`تم\s+تحويل\s+مبلغ\s+(?<amount>${NUM})\s*${CUR}?\s+من\s+حساب\s+رقم\s*${LAST4_PFX}(?<last4>\d{4})`,
  },

  // ── CIB ─────────────────────────────────────────────────────────────────────────
  {
    id: "cib.purchase.en.v1",
    bankKey: "cib",
    nameAr: "CIB — شراء (إنجليزي)",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`(?:a|one)\s+purchase\s+of\s+(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})\s+was\s+made\s+on\s+your\s+card\s+ending\s+(?:with\s+)?${LAST4_PFX}(?<last4>\d{4})\s+at\s+${MERCHANT}${ON_DATE}`,
  },
  {
    id: "cib.purchase.ar.v1",
    bankKey: "cib",
    nameAr: "CIB — شراء (عربي)",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`تم\s+خصم\s+مبلغ\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+من\s+بطاق${T}*ت?ك?\s+المنتهي${T}?\s+بـ?\s*${LAST4_PFX}(?<last4>\d{4})\s*(?:لدي|لدى|عند|في)\s+${MERCHANT}${AR_DATE}`,
  },
  {
    id: "cib.fee.en.v1",
    bankKey: "cib",
    nameAr: "CIB — رسوم",
    kind: "FEE",
    direction: "OUT",
    pattern: String.raw`(?:annual\s+fee|service\s+charge|late\s+payment\s+fee)\s+of\s+(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})\s+has\s+been\s+charged\s+to\s+your\s+(?:credit\s+)?card\s+ending\s+(?:with\s+)?${LAST4_PFX}(?<last4>\d{4})`,
  },
  {
    id: "cib.refund.en.v1",
    bankKey: "cib",
    nameAr: "CIB — استرداد (قد يكون بعملة أجنبية)",
    kind: "REFUND",
    direction: "IN",
    pattern: String.raw`a\s+refund\s+of\s+(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})(?:\s*\((?<currency2>${CUR})\s*(?<balance>${NUM})\))?\s+has\s+been\s+credited\s+to\s+your\s+card\s+ending\s+(?:with\s+)?${LAST4_PFX}(?<last4>\d{4})(?:\s+from\s+${MERCHANT})?${ON_DATE}`,
  },
  {
    id: "cib.payment.en.v1",
    bankKey: "cib",
    nameAr: "CIB — سداد بطاقة",
    kind: "PAYMENT",
    direction: "IN",
    pattern: String.raw`(?:thank\s+you\s+for\s+your\s+)?payment\s+of\s+(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})\s+(?:has\s+been\s+)?(?:received|credited)[^\n]{0,40}?card\s+ending\s+(?:with\s+)?${LAST4_PFX}(?<last4>\d{4})`,
  },

  // ── البنك الأهلي المصري ──────────────────────────────────────────────────────────
  {
    id: "nbe.purchase.ar.v1",
    bankKey: "nbe",
    nameAr: "الأهلي المصري — شراء",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`تم\s+${A}جراء\s+عملي${T}?\s+شراء\s+بمبلغ\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+عل${Y}?\s+البطاق${T}\s*${LAST4_PFX}(?<last4>\d{4})\s*(?:لدي|لدى|عند|في)\s+${MERCHANT}${AR_DATE}`,
  },
  {
    id: "nbe.withdrawal.ar.v1",
    bankKey: "nbe",
    nameAr: "الأهلي المصري — سحب نقدي",
    kind: "WITHDRAWAL",
    direction: "OUT",
    pattern: String.raw`تم\s+سحب\s+مبلغ\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+من\s+(?:ماكين${T}|صراف)[^\n]{0,25}?البطاق${T}\s*${LAST4_PFX}(?<last4>\d{4})`,
  },

  // ── QNB ─────────────────────────────────────────────────────────────────────────
  {
    id: "qnb.withdrawal.en.v1",
    bankKey: "qnb",
    nameAr: "QNB — سحب نقدي (إنجليزي)",
    kind: "WITHDRAWAL",
    direction: "OUT",
    pattern: String.raw`cash\s+withdrawal\s+of\s+(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})\s+from\s+atm\s+using\s+card\s+ending\s+(?:with\s+)?${LAST4_PFX}(?<last4>\d{4})${ON_DATE}`,
  },
  {
    id: "qnb.purchase.en.v1",
    bankKey: "qnb",
    nameAr: "QNB — شراء (إنجليزي)",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`(?:pos|purchase)\s+(?:transaction\s+)?of\s+(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})[^\n]{0,30}?card\s+(?:no\.?|number|#)?\s*${LAST4_PFX}(?<last4>\d{4})(?:\s+(?:at|merchant)\s+${MERCHANT})?${ON_DATE}`,
  },

  // ── إنستاباي ────────────────────────────────────────────────────────────────────
  {
    id: "instapay.transfer-out.ar.v1",
    bankKey: "instapay",
    nameAr: "إنستاباي — تحويل صادر",
    kind: "TRANSFER_OUT",
    direction: "OUT",
    pattern: String.raw`تم\s+تحويل\s+مبلغ\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+من\s+حسابك\s+المنتهي?\s+بـ?\s*${LAST4_PFX}(?<last4>\d{4})\s+${A}ل${Y}?\s+${MERCHANT}(?:\s+عبر\s+${A}نستاباي)?${AR_DATE}`,
  },
  {
    id: "instapay.transfer-in.ar.v1",
    bankKey: "instapay",
    nameAr: "إنستاباي — تحويل وارد",
    kind: "TRANSFER_IN",
    direction: "IN",
    pattern: String.raw`(?:تم\s+استلام|وصلك)\s+تحويل\s+بمبلغ\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+من\s+${MERCHANT}(?:\s+${A}ل${Y}?\s+حسابك\s*${LAST4_PFX}(?<last4>\d{4}))?`,
  },

  // ── فودافون كاش ─────────────────────────────────────────────────────────────────
  {
    id: "vodafone-cash.withdrawal.ar.v1",
    bankKey: "vodafone_cash",
    nameAr: "فودافون كاش — سحب",
    kind: "WITHDRAWAL",
    direction: "OUT",
    pattern: String.raw`تم\s+سحب\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+من\s+محفظ${T}\s+فودافون\s+كاش\s*(?:رقم\s*)?${LAST4_PFX}(?<last4>\d{4})?`,
  },
  {
    id: "vodafone-cash.transfer.ar.v1",
    bankKey: "vodafone_cash",
    nameAr: "فودافون كاش — تحويل",
    kind: "TRANSFER_OUT",
    direction: "OUT",
    pattern: String.raw`تم\s+تحويل\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+${A}ل${Y}?\s+${MERCHANT}(?:\s+من\s+محفظ${T}[^\n]{0,20}?${LAST4_PFX}(?<last4>\d{4}))?`,
  },

  {
    id: "banque-misr.payment.v1",
    bankKey: "misr",
    nameAr: "بنك مصر — سداد بطاقة",
    kind: "PAYMENT",
    direction: "IN",
    pattern: String.raw`تم\s+سداد\s+مبلغ\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+ل?بطاق${T}?ك?[^\n]{0,20}?المنتهي${T}?\s+بـ?\s*${LAST4_PFX}(?<last4>\d{4})(?:\s+بتاريخ\s+(?<date>${DATE}))?`,
  },
  {
    id: "cib.withdrawal.en.v1",
    bankKey: "cib",
    nameAr: "CIB — سحب نقدي (إنجليزي)",
    kind: "WITHDRAWAL",
    direction: "OUT",
    pattern: String.raw`cash\s+withdrawal\s+of\s+(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})[^\n]{0,30}?card\s+ending\s+(?:with\s+)?${LAST4_PFX}(?<last4>\d{4})(?:\s+(?:at|from)\s+${MERCHANT})?${ON_DATE}`,
  },

  // ── صيغ عامة (مش بترفع الثقة لـVERIFIED) ──────────────────────────────────────────
  {
    id: "eg-generic.debit.ar.v1",
    bankKey: "generic",
    nameAr: "صيغة مصرية عامة — خصم",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`تم\s+خصم\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+من\s+(?:حساب|بطاق)[هةك][^\n]{0,20}?${LAST4_PFX}(?<last4>\d{4})(?:\s+(?:لدي|لدى|عند|في|بسبب)\s+${MERCHANT})?(?:\s+(?:بتاريخ|يوم)\s+(?<date>${DATE}))?`,
  },
  {
    id: "eg-generic.purchase.ar.v1",
    bankKey: "generic",
    nameAr: "صيغة مصرية عامة — عملية شراء",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`عملي${T}?\s+شراء\s+بمبلغ\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+(?:ب|علي?\s+|من\s+)?(?:البطاق|الحساب|الكارت|محفظ)${T}?ك?[^\n]{0,15}?${LAST4_PFX}(?<last4>\d{4})(?:\s+(?:لدي|لدى|عند|في)\s+${MERCHANT})?(?:\s+(?:بتاريخ|يوم)\s+(?<date>${DATE}))?`,
  },
  {
    id: "eg-generic.credit.ar.v1",
    bankKey: "generic",
    nameAr: "صيغة مصرية عامة — إضافة",
    kind: "DEPOSIT",
    direction: "IN",
    pattern: String.raw`تم\s+${A}ضاف${T}\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+${A}ل${Y}?\s+(?:حساب|بطاق)[هةك][^\n]{0,20}?${LAST4_PFX}(?<last4>\d{4})`,
  },
  {
    id: "eg-generic.payment.ar.v1",
    bankKey: "generic",
    nameAr: "صيغة مصرية عامة — سداد",
    kind: "PAYMENT",
    direction: "IN",
    pattern: String.raw`تم\s+سداد\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+ل?(?:حساب|بطاق)${T}?ك?[^\n]{0,20}?(?:المنتهي${T}?\s+بـ?\s*)?${LAST4_PFX}(?<last4>\d{4})?`,
  },
  {
    id: "eg-generic.withdrawal.ar.v1",
    bankKey: "generic",
    nameAr: "صيغة مصرية عامة — سحب نقدي",
    kind: "WITHDRAWAL",
    direction: "OUT",
    pattern: String.raw`تم\s+سحب\s+(?<amount>${NUM})\s*(?<currency>${CUR})?\s+من[^\n]{0,30}?(?:بطاق|حساب|محفظ)${T}?ك?[^\n]{0,15}?${LAST4_PFX}(?<last4>\d{4})`,
  },
  {
    id: "generic.purchase.en.v1",
    bankKey: "generic",
    nameAr: "صيغة إنجليزية عامة — شراء",
    kind: "PURCHASE",
    direction: "OUT",
    pattern: String.raw`(?:card|purchase)\s+(?:transaction\s+)?of?\s*(?:(?<currency>${CUR})\s*)?(?<amount>${NUM})[^\n]{0,40}?(?:ending|no\.?|number|#)\s*${LAST4_PFX}(?<last4>\d{4})(?:\s+(?:at|merchant)\s+${MERCHANT})?${ON_DATE}`,
  },
];

/** كل القوالب المرتبطة ببنك معيّن */
export function templatesForBank(bankKey: string | null | undefined): SmsTemplate[] {
  if (!bankKey || bankKey === "generic") return [];
  return SMS_TEMPLATES.filter((t) => t.bankKey === bankKey);
}

/** القوالب العامة (تُجرَّب بعد قوالب البنك) */
export function genericTemplates(): SmsTemplate[] {
  return SMS_TEMPLATES.filter((t) => t.bankKey === "generic");
}

export function getTemplate(id: string | null | undefined): SmsTemplate | null {
  if (!id) return null;
  return SMS_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** اسم القالب بالعربي للعرض في الواجهة */
export function templateLabel(id: string | null | undefined): string | null {
  return getTemplate(id)?.nameAr ?? null;
}
