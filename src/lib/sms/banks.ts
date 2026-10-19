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
  {
    key: "saib",
    nameAr: "بنك سايب",
    nameEn: "SAIB",
    country: "EG",
    currency: "EGP",
    senders: ["SAIB", "SAIBBank", "saib"],
    keywords: ["saib", "بنك سايب"],
  },
  {
    key: "faisal",
    nameAr: "بنك فيصل الإسلامي",
    nameEn: "Faisal Islamic Bank",
    country: "EG",
    currency: "EGP",
    senders: ["Faisal", "FaisalBank", "FAISAL"],
    keywords: ["faisal", "بنك فيصل", "فيصل الاسلامي"],
  },
  {
    key: "abk",
    nameAr: "البنك الأهلي الكويتي",
    nameEn: "Alahli Bank of Kuwait",
    country: "EG",
    currency: "EGP",
    senders: ["ABK", "AlAhliKuwait", "ABKEgypt"],
    keywords: ["abk", "الاهلي الكويتي", "alahli bank of kuwait"],
  },
  {
    key: "nbk",
    nameAr: "بنك الكويت الوطني",
    nameEn: "National Bank of Kuwait",
    country: "EG",
    currency: "EGP",
    senders: ["NBK", "NBKEgypt"],
    keywords: ["nbk", "الكويت الوطني", "national bank of kuwait"],
  },
  {
    key: "aib",
    nameAr: "بنك الاستثمار العربي",
    nameEn: "Arab Investment Bank",
    country: "EG",
    currency: "EGP",
    senders: ["AIB", "ArabInvestment", "AIBank"],
    keywords: ["الاستثمار العربي", "arab investment bank"],
  },
  {
    key: "mashreq",
    nameAr: "بنك المشرق",
    nameEn: "Mashreq Bank",
    country: "EG",
    currency: "EGP",
    senders: ["Mashreq", "MashreqBank"],
    keywords: ["mashreq", "المشرق"],
  },
  {
    key: "credit_agricole",
    nameAr: "كريدي أجريكول",
    nameEn: "Crédit Agricole Egypt",
    country: "EG",
    currency: "EGP",
    senders: ["CreditAgricole", "CACIB", "CAEgypt"],
    keywords: ["credit agricole", "كريدي اجريكول"],
  },
  {
    key: "egbank",
    nameAr: "البنك المصري لتنمية الصادرات",
    nameEn: "EGBANK",
    country: "EG",
    currency: "EGP",
    senders: ["EGBANK", "EGBank"],
    keywords: ["egbank", "المصري لتنميه الصادرات"],
  },
  {
    key: "ube",
    nameAr: "المصرف المتحد",
    nameEn: "United Bank of Egypt",
    country: "EG",
    currency: "EGP",
    senders: ["UBank", "UnitedBank", "UB"],
    keywords: ["المصرف المتحد", "united bank"],
  },
  {
    key: "meeza",
    nameAr: "شبكة ميزة",
    nameEn: "Meeza",
    country: "EG",
    currency: "EGP",
    senders: ["Meeza", "MEEZA"],
    keywords: ["meeza", "ميزه", "شركه ميزه"],
  },
  {
    key: "fawry",
    nameAr: "فوري",
    nameEn: "Fawry",
    country: "EG",
    currency: "EGP",
    senders: ["Fawry", "FAWRY", "MyFawry"],
    keywords: ["fawry", "فوري", "ماي فوري"],
  },
  {
    key: "orange_cash",
    nameAr: "أورنج كاش",
    nameEn: "Orange Cash",
    country: "EG",
    currency: "EGP",
    senders: ["OrangeCash", "Orange"],
    keywords: ["orange cash", "اورنج كاش"],
  },
  {
    key: "we_pay",
    nameAr: "وي باي",
    nameEn: "WE Pay",
    country: "EG",
    currency: "EGP",
    senders: ["WEPay", "WE", "TelecomPay"],
    keywords: ["we pay", "وي باي"],
  },
  {
    key: "etisalat_cash",
    nameAr: "اتصالات كاش",
    nameEn: "e& Cash",
    country: "EG",
    currency: "EGP",
    senders: ["EtisalatCash", "Etisalat", "e& cash"],
    keywords: ["etisalat cash", "اتصالات كاش", "e& cash"],
  },
  {
    key: "valu",
    nameAr: "ڤاليو",
    nameEn: "valU",
    country: "EG",
    currency: "EGP",
    senders: ["valU", "valu", "VALUE"],
    keywords: ["valu", "ڤاليو", "فاليو"],
  },
  {
    key: "poste_pay",
    nameAr: "بوسته باي / البريد المصري",
    nameEn: "Egypt Post",
    country: "EG",
    currency: "EGP",
    senders: ["EgyptPost", "PostaPay"],
    keywords: ["البريد المصري", "egypt post"],
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
