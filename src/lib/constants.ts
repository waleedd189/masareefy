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
