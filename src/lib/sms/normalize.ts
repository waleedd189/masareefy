/** تحويل الأرقام العربية/الفارسية لأرقام إنجليزية وتنظيف الرسالة قبل التحليل */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export function toEnglishDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a > -1) return String(a);
    const p = EXTENDED_ARABIC_INDIC.indexOf(ch);
    return p > -1 ? String(p) : ch;
  });
}

/** تطبيع الرسالة: أرقام إنجليزية، إزالة علامات الاتجاه، توحيد الفواصل والمسافات */
export function normalizeMessage(input: string): string {
  let text = input ?? "";
  text = text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u00a0]/g, " ");
  text = toEnglishDigits(text);
  text = text.replace(/\u0640/g, ""); // التطويل
  text = text.replace(/٫/g, ".").replace(/٬/g, ",").replace(/،/g, ",");
  text = text.replace(/[“”]/g, '"').replace(/[’‘]/g, "'");
  text = text.replace(/[ \t\f\v]+/g, " ");
  text = text.replace(/\r\n?/g, "\n");
  return text.trim();
}

/** تطبيع الحروف العربية للمقارنة (أ/إ/آ ← ا، ة ← ه، ى ← ي) */
export function foldArabic(input: string): string {
  return normalizeMessage(input)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064b-\u0652]/g, "")
    .toLowerCase();
}

/** تحويل "1,234.56" إلى رقم */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = toEnglishDigits(raw).replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  let value = cleaned;
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // الفاصلة الأخيرة هي العلامة العشرية
    if (lastComma > lastDot) value = value.replace(/\./g, "").replace(",", ".");
    else value = value.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = value.length - lastComma - 1;
    value = decimals === 3 ? value.replace(/,/g, "") : value.replace(",", ".");
  }
  value = value.replace(/,/g, "");
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? Math.round(Math.abs(num) * 100) / 100 : null;
}
