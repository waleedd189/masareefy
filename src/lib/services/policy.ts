import type { Card } from "@/db/schema";
import type { PolicySettings } from "@/lib/settings-store";
import { PARSER_VERSION } from "@/lib/sms/templates";
import type { ParsedSms } from "@/lib/sms/types";
import type { SenderLink } from "@/db/schema";

/**
 * محرّك سياسة القرار — مقابل `SmsPostingPolicy` + `SmsDecision` + `SmsDecisionReason`
 * في تطبيق Mezanetak: المحلل بيطلع حقائق، والسياسة بتقرر (تسجيل آلي / مراجعة / تجاهل)
 * بأسباب صريحة تظهر للمستخدم.
 */

export type Decision = "AUTO_POST" | "REVIEW" | "DROP";

export type DecisionReason =
  | "TRACKING_OFF"
  | "AUTO_POST_OFF"
  | "AUTO_POST_PAUSED"
  | "PARSER_OUTDATED"
  | "NON_FINANCIAL"
  | "OTP"
  | "PROMO"
  | "PERSONAL_SENDER"
  | "NO_AMOUNT"
  | "NO_TRANSACTION"
  | "LOW_CONFIDENCE"
  | "UNVERIFIED_FORMAT"
  | "FOREIGN_CURRENCY"
  | "KIND_NEEDS_REVIEW"
  | "LARGE_AMOUNT"
  | "UNLINKED_SOURCE"
  | "AMBIGUOUS_CARD"
  | "NO_ACCOUNT"
  | "DUPLICATE";

export const DECISION_LABELS: Record<Decision, string> = {
  AUTO_POST: "تسجيل آلي",
  REVIEW: "مراجعة",
  DROP: "تجاهل",
};

export const REASON_LABELS: Record<DecisionReason, string> = {
  TRACKING_OFF: "تتبّع الرسائل موقوف",
  AUTO_POST_OFF: "التسجيل الآلي مقفول",
  AUTO_POST_PAUSED: "التسجيل الآلي متوقف مؤقتًا",
  PARSER_OUTDATED: "نتيجة من إصدار محلل أقدم",
  NON_FINANCIAL: "رسالة غير مالية",
  OTP: "كود تحقق (OTP)",
  PROMO: "إعلان أو عرض",
  PERSONAL_SENDER: "المرسل رقم شخصي",
  NO_AMOUNT: "مفيش مبلغ في الرسالة",
  NO_TRANSACTION: "نوع العملية غير واضح",
  LOW_CONFIDENCE: "درجة الثقة منخفضة",
  UNVERIFIED_FORMAT: "صيغة غير موثّقة (محرّك عام)",
  FOREIGN_CURRENCY: "عملية بعملة أجنبية",
  KIND_NEEDS_REVIEW: "نوع العملية يتطلب مراجعة",
  LARGE_AMOUNT: "مبلغ أكبر من حد التسجيل الآلي",
  UNLINKED_SOURCE: "المرسل مش مربوط بحساب",
  AMBIGUOUS_CARD: "أكتر من بطاقة بنفس آخر 4 أرقام",
  NO_ACCOUNT: "مفيش حساب مطابق",
  DUPLICATE: "رسالة مكررة",
};

export const REASON_TONES: Partial<Record<DecisionReason, "bad" | "warn" | "info">> = {
  OTP: "info",
  PROMO: "info",
  DUPLICATE: "info",
  NON_FINANCIAL: "info",
  PERSONAL_SENDER: "info",
  TRACKING_OFF: "warn",
  AUTO_POST_OFF: "warn",
  AUTO_POST_PAUSED: "warn",
  PARSER_OUTDATED: "warn",
  LOW_CONFIDENCE: "warn",
  UNVERIFIED_FORMAT: "warn",
  FOREIGN_CURRENCY: "warn",
  KIND_NEEDS_REVIEW: "warn",
  LARGE_AMOUNT: "warn",
  UNLINKED_SOURCE: "bad",
  AMBIGUOUS_CARD: "bad",
  NO_ACCOUNT: "bad",
  NO_AMOUNT: "bad",
  NO_TRANSACTION: "warn",
};

export interface DecisionInput {
  parsed: ParsedSms;
  card: Card | null;
  ambiguous?: boolean;
  link?: SenderLink | null;
  policy: PolicySettings;
  duplicate?: boolean;
  /** إصدار المحلل اللي أنتج النتيجة (للرسائل المخزّنة سابقًا) */
  parserVersion?: number;
  homeCurrency?: string;
}

export interface DecisionResult {
  decision: Decision;
  reasons: DecisionReason[];
  /** الحالة المخزّنة في جدول messages (متوافقة مع الـAPI الحالي) */
  status: "PARSED" | "NEEDS_REVIEW" | "UNMATCHED" | "IGNORED" | "DUPLICATE";
  /** نص مختصر يظهر كسبب رئيسي */
  message?: string;
}

export function decideMessage(input: DecisionInput): DecisionResult {
  const { parsed, card, ambiguous, link, policy, duplicate } = input;
  const reasons: DecisionReason[] = [];

  if (duplicate) {
    return { decision: "DROP", reasons: ["DUPLICATE"], status: "DUPLICATE", message: "الرسالة دي مسجلة قبل كده" };
  }

  if (!policy.trackingEnabled) {
    return { decision: "DROP", reasons: ["TRACKING_OFF"], status: "IGNORED", message: REASON_LABELS.TRACKING_OFF };
  }

  // 1) استبعادات قاطعة
  if (!parsed.isFinancial) {
    const reason: DecisionReason =
      parsed.exclusion === "OTP" ? "OTP" : parsed.exclusion === "PERSONAL_SENDER" ? "PERSONAL_SENDER" : parsed.exclusion === "PROMO" ? "PROMO" : "NON_FINANCIAL";
    return { decision: "DROP", reasons: [reason], status: "IGNORED", message: REASON_LABELS[reason] };
  }
  if (parsed.amount === null) {
    return { decision: "DROP", reasons: ["NO_AMOUNT"], status: "IGNORED", message: REASON_LABELS.NO_AMOUNT };
  }

  // 2) مشاكل الربط بالحساب
  if (!card) {
    reasons.push(ambiguous ? "AMBIGUOUS_CARD" : "UNLINKED_SOURCE");
    if (!parsed.last4) reasons.push("NO_ACCOUNT");
    return {
      decision: "REVIEW",
      reasons,
      status: "UNMATCHED",
      message: ambiguous
        ? REASON_LABELS.AMBIGUOUS_CARD
        : parsed.last4
          ? `${REASON_LABELS.UNLINKED_SOURCE} (••${parsed.last4})`
          : REASON_LABELS.NO_ACCOUNT,
    };
  }

  // 3) قيود السياسة
  if (policy.paused) reasons.push("AUTO_POST_PAUSED");
  else if (!policy.autoPost) reasons.push("AUTO_POST_OFF");

  const version = input.parserVersion ?? PARSER_VERSION;
  if (version < policy.minParserVersion) reasons.push("PARSER_OUTDATED");

  if (parsed.confidence < policy.minConfidence) reasons.push("LOW_CONFIDENCE");
  if (policy.requireVerified && parsed.confidenceLevel !== "VERIFIED" && !parsed.matchedRule) {
    reasons.push("UNVERIFIED_FORMAT");
  }

  const home = input.homeCurrency ?? card.currency ?? "EGP";
  if (policy.reviewForeignCurrency && parsed.currency && parsed.currency !== home) {
    reasons.push("FOREIGN_CURRENCY");
  }

  if (policy.reviewKinds.includes(parsed.type)) reasons.push("KIND_NEEDS_REVIEW");

  if (policy.maxAutoAmount && parsed.amount > policy.maxAutoAmount) reasons.push("LARGE_AMOUNT");

  if (link && link.autoFile === false) reasons.push("UNLINKED_SOURCE");

  if (parsed.type === "UNKNOWN" && !reasons.includes("NO_TRANSACTION")) reasons.push("NO_TRANSACTION");

  if (reasons.length === 0) {
    return { decision: "AUTO_POST", reasons: [], status: "PARSED" };
  }

  const primary = reasons[0];
  return {
    decision: "REVIEW",
    reasons: [...new Set(reasons)],
    status: "NEEDS_REVIEW",
    message: REASON_LABELS[primary],
  };
}
