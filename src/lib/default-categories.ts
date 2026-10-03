/** الفئات الافتراضية + الكلمات المفتاحية للتصنيف التلقائي (قابلة للتعديل من الإعدادات) */
export interface DefaultCategory {
  name: string;
  emoji: string;
  color: string;
  keywords: string;
  monthlyBudget?: number;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "مطاعم وكافيهات",
    emoji: "🍔",
    color: "rose",
    keywords:
      "مطعم,كافيه,قهوه,starbucks,ستاربكس,costa,كوستا,mcdonald,ماكدونالدز,kfc,بيتزا,pizza,burger,برجر,cilantro,talabat,طلبات,elmenus,buffalo,restaurant,cafe,bakery,مخبز,عصير",
    monthlyBudget: 4000,
  },
  {
    name: "سوبر ماركت",
    emoji: "🛒",
    color: "emerald",
    keywords:
      "carrefour,كارفور,spinneys,سبينس,seoudi,السعودي,metro market,هايبر,hyper,gourmet,بقاله,فتح الله,اولاد رجب,kazyon,كازيون,supermarket,grocery",
    monthlyBudget: 6000,
  },
  {
    name: "مواصلات وبنزين",
    emoji: "⛽",
    color: "amber",
    keywords: "uber,اوبر,careem,كريم,indrive,بنزين,petrol,fuel,wataniya,الوطنيه,chillout,مصر للبترول,taxi,تاكسي,swvl,مترو,قطار",
    monthlyBudget: 2500,
  },
  {
    name: "فواتير واشتراكات",
    emoji: "📱",
    color: "sky",
    keywords:
      "vodafone,فودافون,orange,اورنج,etisalat,اتصالات,we ,كهرباء,مياه,غاز,netflix,spotify,shahid,osn,anghami,icloud,google,apple.com,openai,chatgpt,microsoft,اشتراك",
    monthlyBudget: 1500,
  },
  {
    name: "تسوق أونلاين",
    emoji: "🛍️",
    color: "indigo",
    keywords: "amazon,امازون,noon,نون,jumia,جوميا,aliexpress,shein,namshi,btech,بي تك,2b,ebay,online",
  },
  {
    name: "صحة وأدوية",
    emoji: "💊",
    color: "rose",
    keywords: "صيدليه,pharmacy,العزبي,ezaby,سيف,seif,19011,مستشفي,hospital,clinic,عياده,معمل,lab,البرج,alborg,طبيب",
  },
  { name: "ملابس", emoji: "👕", color: "indigo", keywords: "zara,h&m,lc waikiki,defacto,american eagle,bershka,mango,concrete,town team,ملابس,حذاء,shoes" },
  { name: "سفر وفنادق", emoji: "✈️", color: "sky", keywords: "booking,airbnb,egyptair,مصر للطيران,flynas,turkish,hotel,فندق,wizz,almosafer,تذكره" },
  { name: "ترفيه", emoji: "🎬", color: "amber", keywords: "cinema,سينما,vox,imax,playstation,steam,game,لعبه,ملاهي,جيم,gym,نادي" },
  { name: "تعليم", emoji: "📚", color: "emerald", keywords: "udemy,coursera,مدرسه,جامعه,كورس,دوره,كتب,جرير,مكتبه" },
  { name: "سحب نقدي", emoji: "🏧", color: "slate", keywords: "atm,صراف,سحب نقدي" },
  { name: "رسوم بنكية", emoji: "🏦", color: "slate", keywords: "رسوم,عموله,fee,charge,دمغه,stamp" },
  { name: "سداد بطاقة", emoji: "💳", color: "emerald", keywords: "سداد,تسديد,payment received,card payment" },
  { name: "تحويلات", emoji: "🔁", color: "sky", keywords: "instapay,انستاباي,تحويل,حواله,transfer,فوري,fawry" },
  { name: "دخل", emoji: "💰", color: "emerald", keywords: "راتب,مرتب,salary,ايداع,deposit" },
  { name: "أخرى", emoji: "🧾", color: "slate", keywords: "" },
];
