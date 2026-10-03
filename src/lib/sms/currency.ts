/** رموز العملات المدعومة + مرادفاتها في رسائل البنوك */

export interface CurrencyDef {
  code: string;
  ar: string;
  symbol: string;
  aliases: string[];
}

export const CURRENCIES: CurrencyDef[] = [
  {
    code: "EGP",
    ar: "جنيه مصري",
    symbol: "ج.م",
    aliases: ["EGP", "LE", "L.E", "L.E.", "EG P", "ج.م", "جم", "جنيه", "جنيها", "جنيهاً", "جنيهات"],
  },
  { code: "SAR", ar: "ريال سعودي", symbol: "ر.س", aliases: ["SAR", "SR", "ر.س", "رس", "ريال", "ريالا", "ريالاً"] },
  { code: "AED", ar: "درهم إماراتي", symbol: "د.إ", aliases: ["AED", "DHS", "د.إ", "درهم", "دراهم"] },
  { code: "USD", ar: "دولار", symbol: "$", aliases: ["USD", "US$", "$", "دولار", "دولارا", "دولاراً"] },
  { code: "EUR", ar: "يورو", symbol: "€", aliases: ["EUR", "€", "يورو"] },
  { code: "GBP", ar: "جنيه إسترليني", symbol: "£", aliases: ["GBP", "£", "استرليني", "إسترليني"] },
  { code: "KWD", ar: "دينار كويتي", symbol: "د.ك", aliases: ["KWD", "KD", "د.ك"] },
  { code: "QAR", ar: "ريال قطري", symbol: "ر.ق", aliases: ["QAR", "QR", "ر.ق"] },
  { code: "BHD", ar: "دينار بحريني", symbol: "د.ب", aliases: ["BHD", "BD", "د.ب"] },
  { code: "OMR", ar: "ريال عماني", symbol: "ر.ع", aliases: ["OMR", "ر.ع"] },
  { code: "JOD", ar: "دينار أردني", symbol: "د.أ", aliases: ["JOD", "JD", "د.أ"] },
  { code: "TRY", ar: "ليرة تركية", symbol: "₺", aliases: ["TRY", "₺", "ليرة"] },
];

const ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const c of CURRENCIES) {
    map[c.code.toLowerCase()] = c.code;
    for (const a of c.aliases) map[a.toLowerCase()] = c.code;
  }
  return map;
})();

export function resolveCurrency(token: string | null | undefined): string | null {
  if (!token) return null;
  const key = token.trim().toLowerCase().replace(/\s+/g, "");
  return ALIAS_MAP[key] ?? ALIAS_MAP[token.trim().toLowerCase()] ?? null;
}

/** تعبير نمطي يطابق أي رمز عملة */
export const CURRENCY_PATTERN = CURRENCIES.flatMap((c) => [c.code, ...c.aliases])
  .sort((a, b) => b.length - a.length)
  .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

export function currencyLabel(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.ar ?? code;
}

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
