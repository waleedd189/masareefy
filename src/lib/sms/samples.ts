/** رسائل بنوك حقيقية الشكل – تُستخدم للتجربة وللـ seed وللاختبار */
export interface SampleMessage {
  sender: string;
  text: string;
  note?: string;
}

export const SAMPLE_MESSAGES: SampleMessage[] = [
  {
    sender: "CIB",
    text: "Dear Customer, a purchase of EGP 1,250.00 was made on your card ending 4321 at CARREFOUR MAADI on 02/10/2026 14:35. Available balance is EGP 18,400.50",
  },
  {
    sender: "CIB",
    text: "عميلنا العزيز، تم خصم مبلغ 320.75 ج.م من بطاقتك المنتهية بـ 4321 لدى طلبات مصر بتاريخ 03/10/2026. الرصيد المتاح 18,079.75 ج.م",
  },
  {
    sender: "NBE",
    text: "البنك الأهلي المصري: تم إجراء عملية شراء بمبلغ ٨٥٠.٠٠ جنيه على البطاقة ****7788 لدى SPINNEYS NASR CITY بتاريخ ٠١/١٠/٢٠٢٦ الساعة ١٩:٢٠. الرصيد المتاح: ٤٢٬٣٠٠.٠٠ جنيه",
  },
  {
    sender: "QNB",
    text: "QNB Alahli: Cash withdrawal of EGP 2,000.00 from ATM using card ending 9012 on 28-09-2026 10:12. Avl Bal: EGP 9,540.00",
  },
  {
    sender: "BanqueMisr",
    text: "بنك مصر: تم سداد مبلغ 5,000.00 جنيه لبطاقتك الائتمانية المنتهية بـ 4321 بتاريخ 25/09/2026. شكراً لتعاملكم معنا",
  },
  {
    sender: "CIB",
    text: "A refund of USD 25.00 (EGP 1,215.00) has been credited to your card ending 4321 from AMAZON.COM on 20/09/2026",
  },
  {
    sender: "CIB",
    text: "Annual fee of EGP 450.00 has been charged to your credit card ending 4321. Available balance EGP 17,629.75",
  },
  {
    sender: "InstaPay",
    text: "تم تحويل مبلغ 1,500 ج.م من حسابك المنتهي بـ 7788 إلى محمد علي عبر إنستاباي بتاريخ 30/09/2026",
  },
  {
    sender: "CIB",
    text: "Your OTP is 884213. Do not share this code with anyone.",
    note: "رسالة غير مالية – المفروض تتجاهل",
  },
];
