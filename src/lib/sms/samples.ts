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
  {
    sender: "BanqueMisr",
    text: "بطاقه بنك مصر ****4321، تم الان خصم 275.50 egp عند ZOOP MAADI يوم 05/10/2026",
    note: "قالب موثّق: banque-misr.purchase.v1",
  },
  {
    sender: "VodafoneCash",
    text: "تم تحويل 500 ج.م إلى أحمد سمير من محفظه فودافون كاش رقم 01001234567",
  },
  {
    sender: "Fawry",
    text: "فوري: تم تحصيل مبلغ 320.00 جنيه لصالح شركة الكهرباء - كارت عداد 1234567890",
  },
  {
    sender: "SAIB",
    text: "SAIB: تم خصم 1,150.00 ج.م من بطاقتك المنتهية بـ 8899 لدى JUMIA ONLINE بتاريخ 07/10/2026",
  },
  {
    sender: "CreditAgricole",
    text: "Crédit Agricole: A purchase of EGP 640.00 was made on your card ending 2211 at SEoudi MARKET on 08/10/2026 18:04. Available balance EGP 9,210.00",
  },
  {
    sender: "OrangeCash",
    text: "أورنج كاش: تم سحب 200 جنيه من محفظتك. الرصيد المتاح 1,050 جنيه",
  },
  {
    sender: "WEPay",
    text: "وي باي: تم إيداع مبلغ 3,000.00 ج.م في محفظتك بنجاح. الرصيد 3,450.00 ج.م",
  },
  {
    sender: "EtisalatCash",
    text: "اتصالات كاش: تم تحويل مبلغ 750 ج.م إلى 01123456789 بنجاح",
  },
  {
    sender: "valU",
    text: "ڤاليو: تم سداد قسط بقيمة 1,250.00 جنيه من بطاقتك المنتهية بـ 5566 بتاريخ 10/10/2026",
  },
  {
    sender: "Meeza",
    text: "ميزة: عملية شراء بمبلغ 89.90 جنيه على البطاقة ****3344 لدى صيدليه العزبي",
  },
  {
    sender: "NBK",
    text: "NBK Egypt: Cash withdrawal of EGP 1,500.00 from ATM using card ending 6677 on 11/10/2026",
  },
  {
    sender: "ABK",
    text: "البنك الأهلي الكويتي: تم خصم مبلغ 430.00 ج.م من حسابك المنتهي بـ 9900 لدى TALABATS بتاريخ 12/10/2026",
  },
  {
    sender: "Mashreq",
    text: "Mashreq: Your card ending 1122 was charged AED 210.00 at CARREFOUR DUBAI on 13/10/2026",
  },
  {
    sender: "Faisal",
    text: "بنك فيصل: تم إضافة مبلغ 12,000.00 ج.م إلى حساب رقم ****7788 (راتب شهر أكتوبر)",
  },
  {
    sender: "EGBANK",
    text: "EGBANK: تم خصم 95.00 ج.م من بطاقتك المنتهية بـ 4455 لدى Uber Egypt بتاريخ 14/10/2026",
  },
  {
    sender: "UBank",
    text: "المصرف المتحد: عملية شراء بمبلغ 2,300.00 جنيه ببطاقة ****2233 لدى B.TECH بتاريخ 15/10/2026",
  },
  {
    sender: "CIB",
    text: "CIB: عرض خاص! احصل على 20% كاش باك عند استخدام بطاقتك في المطاعم. للمزيد اتصل بـ 19xxx",
    note: "إعلان – المفروض يتستبعد (PROMO)",
  },
  {
    sender: "01001234567",
    text: "ابعتلي 500 جنيه ضروري على فودافون كاش",
    note: "مرسل شخصي – يتستبعد (PERSONAL_SENDER)",
  },
  {
    sender: "QNB",
    text: "QNB: Your credit card statement of EGP 8,450.00 is due on 25/10/2026. Minimum payment EGP 425.00",
    note: "كشف حساب/مستحق – من غير خصم فعلي",
  },
];
