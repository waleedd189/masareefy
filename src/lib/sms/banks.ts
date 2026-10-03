import { foldArabic } from "./normalize";

export interface BankProfile {
  key: string;
  nameAr: string;
  nameEn: string;
  country: "EG" | "SA" | "AE" | "KW" | "QA" | "JO" | "XX";
  currency: string;
  /** أسماء المرسل كما تظهر في الـ SMS */
  senders: string[];
  /** كلمات تدل على البنك داخل نص الرسالة */
  keywords: string[];
}

export const BANKS: BankProfile[] = [
  {
    key: "cib",
    nameAr: "البنك التجاري الدولي CIB",
    nameEn: "Commercial International Bank",
    country: "EG",
    currency: "EGP",
    senders: ["CIB", "CIBEGYPT", "CIB-Egypt", "CIB Egypt"],
    keywords: ["cib", "البنك التجاري الدولي", "commercial international"],
  },
  {
    key: "nbe",
    nameAr: "البنك الأهلي المصري",
    nameEn: "National Bank of Egypt",
    country: "EG",
    currency: "EGP",
    senders: ["NBE", "NBE Alahly", "AlAhly NBE", "NBEgypt"],
    keywords: ["nbe", "national bank of egypt", "البنك الاهلي المصري", "الاهلي المصري"],
  },
  {
    key: "qnb",
    nameAr: "QNB الأهلي",
    nameEn: "QNB Alahli",
    country: "EG",
    currency: "EGP",
    senders: ["QNB", "QNBALAHLI", "QNB Alahli"],
    keywords: ["qnb", "كيو ان بي", "قطر الوطني"],
  },
  {
    key: "misr",
    nameAr: "بنك مصر",
    nameEn: "Banque Misr",
    country: "EG",
    currency: "EGP",
    senders: ["BanqueMisr", "BM", "Banque Misr", "BMisr"],
    keywords: ["banque misr", "بنك مصر", "بنك مصر الرقمي"],
  },
  {
    key: "alexbank",
    nameAr: "بنك الإسكندرية",
    nameEn: "AlexBank",
    country: "EG",
    currency: "EGP",
    senders: ["AlexBank", "ALEXBANK", "Alex Bank"],
    keywords: ["alexbank", "بنك الاسكندريه", "بنك الاسكندرية"],
  },
  {
    key: "banque_du_caire",
    nameAr: "بنك القاهرة",
    nameEn: "Banque du Caire",
    country: "EG",
    currency: "EGP",
    senders: ["BanqueDuCaire", "BDC", "Cairo Bank"],
    keywords: ["banque du caire", "بنك القاهره", "بنك القاهرة"],
  },
  {
    key: "aaib",
    nameAr: "البنك العربي الأفريقي",
    nameEn: "AAIB",
    country: "EG",
    currency: "EGP",
    senders: ["AAIB", "ArabAfrican"],
    keywords: ["aaib", "العربي الافريقي", "arab african"],
  },
  {
    key: "hsbc_eg",
    nameAr: "HSBC مصر",
    nameEn: "HSBC Egypt",
    country: "EG",
    currency: "EGP",
    senders: ["HSBC", "HSBCEgypt"],
    keywords: ["hsbc"],
  },
  {
    key: "adib_eg",
    nameAr: "مصرف أبوظبي الإسلامي",
    nameEn: "ADIB",
    country: "EG",
    currency: "EGP",
    senders: ["ADIB", "ADIBEgypt"],
    keywords: ["adib", "ابوظبي الاسلامي"],
  },
  {
    key: "instapay",
    nameAr: "إنستاباي",
    nameEn: "InstaPay",
    country: "EG",
    currency: "EGP",
    senders: ["InstaPay", "INSTAPAY", "IPN"],
    keywords: ["instapay", "انستاباي", "انستا باي"],
  },
  {
    key: "vodafone_cash",
    nameAr: "فودافون كاش",
    nameEn: "Vodafone Cash",
    country: "EG",
    currency: "EGP",
    senders: ["VodafoneCash", "Vodafone", "VFCash"],
    keywords: ["vodafone cash", "فودافون كاش"],
  },
  {
    key: "rajhi",
    nameAr: "مصرف الراجحي",
    nameEn: "Al Rajhi Bank",
    country: "SA",
    currency: "SAR",
    senders: ["AlRajhiBank", "Al Rajhi", "ALRAJHIBANK"],
    keywords: ["الراجحي", "rajhi"],
  },
  {
    key: "snb",
    nameAr: "البنك الأهلي السعودي",
    nameEn: "Saudi National Bank",
    country: "SA",
    currency: "SAR",
    senders: ["SNB", "AlAhli", "SNBAlAhli"],
    keywords: ["الاهلي السعودي", "snb", "saudi national bank"],
  },
  {
    key: "enbd",
    nameAr: "بنك الإمارات دبي الوطني",
    nameEn: "Emirates NBD",
    country: "AE",
    currency: "AED",
    senders: ["EmiratesNBD", "ENBD"],
    keywords: ["emirates nbd", "الامارات دبي الوطني"],
  },
];

const OTHER = {
  key: "generic",
  nameAr: "بنك غير معروف",
  nameEn: "Unknown bank",
  country: "XX" as const,
  currency: "EGP",
  senders: [],
  keywords: [],
};

export function getBank(key: string | null | undefined): BankProfile {
  if (!key) return OTHER;
  return BANKS.find((b) => b.key === key) ?? OTHER;
}

export function bankName(key: string | null | undefined): string {
  return getBank(key).nameAr;
}

/** التعرّف على البنك من اسم المرسل أو نص الرسالة */
export function detectBank(text: string, sender?: string | null): BankProfile | null {
  const foldedSender = sender ? foldArabic(sender) : "";
  if (foldedSender) {
    for (const bank of BANKS) {
      if (bank.senders.some((s) => foldArabic(s) === foldedSender)) return bank;
    }
    for (const bank of BANKS) {
      if (bank.senders.some((s) => foldedSender.includes(foldArabic(s)))) return bank;
    }
  }
  const folded = foldArabic(text);
  let best: { bank: BankProfile; score: number } | null = null;
  for (const bank of BANKS) {
    for (const kw of bank.keywords) {
      const needle = foldArabic(kw);
      if (!needle) continue;
      const hit = needle.length <= 4 ? new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`).test(folded) : folded.includes(needle);
      if (hit) {
        const score = needle.length;
        if (!best || score > best.score) best = { bank, score };
      }
    }
  }
  return best?.bank ?? null;
}

export const BANK_OPTIONS = [
  ...BANKS.map((b) => ({ value: b.key, label: b.nameAr, currency: b.currency })),
  { value: "generic", label: "أخرى", currency: "EGP" },
];
