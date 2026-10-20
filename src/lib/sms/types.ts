export const TX_TYPES = [
  "PURCHASE",
  "REFUND",
  "PAYMENT",
  "WITHDRAWAL",
  "DEPOSIT",
  "FEE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "UNKNOWN",
] as const;

export type TxType = (typeof TX_TYPES)[number];
export type Direction = "OUT" | "IN";

export const TX_TYPE_LABELS: Record<TxType, string> = {
  PURCHASE: "شراء",
  REFUND: "استرداد",
  PAYMENT: "سداد",
  WITHDRAWAL: "سحب نقدي",
  DEPOSIT: "إيداع",
  FEE: "رسوم",
  TRANSFER_IN: "تحويل وارد",
  TRANSFER_OUT: "تحويل صادر",
  UNKNOWN: "غير محدد",
};

/** الاتجاه الافتراضي لكل نوع عملية (OUT = فلوس خرجت) */
export const DEFAULT_DIRECTION: Record<TxType, Direction> = {
  PURCHASE: "OUT",
  REFUND: "IN",
  PAYMENT: "IN",
  WITHDRAWAL: "OUT",
  DEPOSIT: "IN",
  FEE: "OUT",
  TRANSFER_IN: "IN",
  TRANSFER_OUT: "OUT",
  UNKNOWN: "OUT",
};

/** مستوى الثقة: قالب موثّق، قاعدة مستخدم، أو المحرّك العام */
export type ConfidenceLevel = "VERIFIED" | "CUSTOM" | "GENERIC";

/** سبب استبعاد رسالة غير قابلة للتسجيل */
export type ExclusionReason = "OTP" | "NO_AMOUNT" | "NO_TRANSACTION" | "PROMO" | "PERSONAL_SENDER" | null;

export interface ParsedSms {
  /** هل الرسالة مالية أصلاً (مش OTP أو إعلان) */
  isFinancial: boolean;
  bankKey: string | null;
  bankName: string | null;
  amount: number | null;
  currency: string | null;
  /** المبلغ بالعملة الأجنبية لو العملية خارجية */
  fxAmount: number | null;
  fxCurrency: string | null;
  last4: string | null;
  type: TxType;
  direction: Direction;
  merchant: string | null;
  availableBalance: number | null;
  occurredAt: Date | null;
  /** درجة ثقة من 0 إلى 1 */
  confidence: number;
  matchedRule: string | null;
  normalizedText: string;
  warnings: string[];
  /** معرّف القالب الموثّق اللي طابق الرسالة (لو فيه) */
  templateId?: string | null;
  /** VERIFIED = قالب موثّق · CUSTOM = قاعدة مستخدم · GENERIC = المحرّك العام */
  confidenceLevel?: ConfidenceLevel;
  /** الكلمة اللي حدّدت نوع العملية */
  matchedWord?: string | null;
  /** سبب الاستبعاد لو الرسالة مش مالية */
  exclusion?: ExclusionReason;
}

/** كلمة يتعلّمها المستخدم وتُمرَّر للمحلل */
export interface WordRule {
  wordKey: string;
  display: string;
  kind: string;
  categoryId?: string | null;
}

export interface CustomRule {
  id?: string;
  name: string;
  bankKey?: string;
  /** Regex بمجموعات مسماة: amount, last4, merchant, balance, date, currency */
  pattern: string;
  typeHint?: TxType | null;
  priority?: number;
}
