export const CARD_BRANDS = [
  { value: "VISA", label: "Visa" },
  { value: "MASTERCARD", label: "Mastercard" },
  { value: "MEEZA", label: "ميزة" },
  { value: "AMEX", label: "American Express" },
] as const;

export const CARD_TYPES = [
  { value: "CREDIT", label: "بطاقة ائتمان" },
  { value: "DEBIT", label: "بطاقة خصم مباشر" },
  { value: "PREPAID", label: "بطاقة مسبقة الدفع" },
] as const;

export const CARD_TYPE_LABELS: Record<string, string> = {
  CREDIT: "ائتمان",
  DEBIT: "خصم مباشر",
  PREPAID: "مسبقة الدفع",
};

export const CARD_COLORS = [
  { value: "emerald", label: "أخضر", from: "#059669", to: "#065f46" },
  { value: "indigo", label: "بنفسجي", from: "#4f46e5", to: "#312e81" },
  { value: "rose", label: "وردي", from: "#e11d48", to: "#881337" },
  { value: "amber", label: "ذهبي", from: "#d97706", to: "#78350f" },
  { value: "sky", label: "أزرق", from: "#0284c7", to: "#0c4a6e" },
  { value: "slate", label: "رمادي", from: "#475569", to: "#1e293b" },
] as const;

export function cardGradient(color: string): string {
  const found = CARD_COLORS.find((c) => c.value === color) ?? CARD_COLORS[0];
  return `linear-gradient(135deg, ${found.from} 0%, ${found.to} 100%)`;
}

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  PARSED: "تم التحليل",
  NEEDS_REVIEW: "تحتاج مراجعة",
  UNMATCHED: "بطاقة غير معروفة",
  IGNORED: "متجاهلة",
  DUPLICATE: "مكررة",
  FAILED: "فشل التحليل",
};

export const MESSAGE_STATUS_STYLES: Record<string, string> = {
  PARSED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  NEEDS_REVIEW: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  UNMATCHED: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  IGNORED: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  DUPLICATE: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  FAILED: "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

/**
 * أنواع الحسابات (19 نوع في Mezanetak — بنغطي الأنسب للاستخدام المصري).
 * الحقل `cards.accountType` بيحل محل `cards.type` تدريجيًا (بطاقة/محفظة/كاش/حساب).
 */
export const ACCOUNT_TYPES = [
  { value: "CREDIT_CARD", label: "بطاقة ائتمان", emoji: "💳", kind: "CARD" },
  { value: "DEBIT_CARD", label: "بطاقة خصم مباشر", emoji: "💳", kind: "CARD" },
  { value: "PREPAID_CARD", label: "بطاقة مسبقة الدفع", emoji: "💳", kind: "CARD" },
  { value: "MEEZA", label: "بطاقة ميزة", emoji: "🟦", kind: "CARD" },
  { value: "WALLET", label: "محفظة موبايل", emoji: "📱", kind: "WALLET" },
  { value: "VODAFONE_CASH", label: "فودافون كاش", emoji: "🔴", kind: "WALLET" },
  { value: "ORANGE_CASH", label: "أورانج كاش", emoji: "🟠", kind: "WALLET" },
  { value: "ETISALAT_CASH", label: "اتصالات كاش", emoji: "🟢", kind: "WALLET" },
  { value: "WE_PAY", label: "وي باي", emoji: "🟣", kind: "WALLET" },
  { value: "INSTAPAY", label: "انستاباي", emoji: "⚡", kind: "WALLET" },
  { value: "CURRENT_ACCOUNT", label: "حساب جاري", emoji: "🏦", kind: "BANK" },
  { value: "SAVINGS_ACCOUNT", label: "حساب توفير", emoji: "🏦", kind: "BANK" },
  { value: "CERTIFICATE", label: "شهادة/وديعة", emoji: "📜", kind: "BANK" },
  { value: "CASH", label: "كاش", emoji: "💵", kind: "CASH" },
  { value: "FAMILY", label: "مصروف العائلة", emoji: "👨‍👩‍👧", kind: "CASH" },
  { value: "GIFT_CARD", label: "بطاقة هدايا", emoji: "🎁", kind: "OTHER" },
  { value: "LOAN", label: "قرض", emoji: "🧮", kind: "OTHER" },
  { value: "INVESTMENT", label: "استثمار", emoji: "📈", kind: "OTHER" },
  { value: "OTHER", label: "أخرى", emoji: "📦", kind: "OTHER" },
] as const;

export const ACCOUNT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.value, t.label]),
);

export function accountTypeEmoji(value: string | null | undefined): string {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.emoji ?? "💳";
}

/** خلفيات البطاقات — مقابل 26 background في Mezanetak (بنقدّم 12) */
export const CARD_DESIGNS = [
  { value: "emerald", label: "أخضر", from: "#059669", to: "#065f46" },
  { value: "indigo", label: "بنفسجي", from: "#4f46e5", to: "#312e81" },
  { value: "rose", label: "وردي", from: "#e11d48", to: "#881337" },
  { value: "amber", label: "ذهبي", from: "#d97706", to: "#78350f" },
  { value: "sky", label: "أزرق", from: "#0284c7", to: "#0c4a6e" },
  { value: "slate", label: "رمادي", from: "#475569", to: "#1e293b" },
  { value: "midnight", label: "ليلي", from: "#1e293b", to: "#020617" },
  { value: "sunset", label: "غروب", from: "#f97316", to: "#7f1d1d" },
  { value: "teal", label: "تركواز", from: "#14b8a6", to: "#134e4a" },
  { value: "plum", label: "برقوقي", from: "#a21caf", to: "#3b0764" },
  { value: "sand", label: "رملي", from: "#ca8a04", to: "#3f3f46" },
  { value: "steel", label: "فولاذي", from: "#64748b", to: "#0f172a" },
] as const;

export function designGradient(design: string | null | undefined): string | null {
  if (!design) return null;
  const found = CARD_DESIGNS.find((d) => d.value === design);
  return found ? `linear-gradient(135deg, ${found.from} 0%, ${found.to} 100%)` : null;
}
