/**
 * بيانات تجريبية: فئات + 3 بطاقات + رسائل بنك حقيقية الشكل + عمليات على 6 شهور.
 * التشغيل: npm run db:seed
 */
import { db } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { apiTokens, cards, categories, messages, parserRules, transactions } from "../src/db/schema";
import { DEFAULT_CATEGORIES } from "../src/lib/default-categories";
import { recomputeAllCards } from "../src/lib/services/balances";
import { suggestCategoryId } from "../src/lib/services/categorize";
import { ingestMessage } from "../src/lib/services/ingest";
import { SAMPLE_MESSAGES } from "../src/lib/sms/samples";

const MERCHANTS: { name: string; min: number; max: number; weight: number }[] = [
  { name: "CARREFOUR MAADI", min: 300, max: 2200, weight: 5 },
  { name: "TALABAT MISR", min: 90, max: 650, weight: 6 },
  { name: "UBER TRIP", min: 45, max: 260, weight: 6 },
  { name: "STARBUCKS CAIRO", min: 70, max: 240, weight: 3 },
  { name: "SEOUDI MARKET", min: 150, max: 1400, weight: 3 },
  { name: "WATANIYA PETROL", min: 250, max: 900, weight: 3 },
  { name: "VODAFONE EGYPT", min: 120, max: 500, weight: 2 },
  { name: "NETFLIX.COM", min: 165, max: 165, weight: 1 },
  { name: "AMAZON.EG", min: 200, max: 3500, weight: 3 },
  { name: "EL EZABY PHARMACY", min: 80, max: 900, weight: 2 },
  { name: "NOON.COM", min: 250, max: 2800, weight: 2 },
  { name: "CINEMA VOX MALL", min: 150, max: 600, weight: 1 },
  { name: "ZARA EGYPT", min: 600, max: 3200, weight: 1 },
];

function pickMerchant() {
  const pool = MERCHANTS.flatMap((m) => Array<typeof m>(m.weight).fill(m));
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomAmount(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

async function main() {
  await runMigrations();

  console.log("🧹 تفريغ البيانات القديمة…");
  await db.delete(transactions);
  await db.delete(messages);
  await db.delete(cards);
  await db.delete(categories);
  await db.delete(parserRules);
  await db.delete(apiTokens);

  console.log("🏷️  إضافة الفئات…");
  await db.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, isSystem: true })));

  console.log("💳 إضافة البطاقات…");
  const inserted = await db
    .insert(cards)
    .values([
      {
        name: "فيزا CIB الأساسية",
        bankKey: "cib",
        bankName: "البنك التجاري الدولي CIB",
        brand: "VISA",
        last4: "4321",
        type: "CREDIT",
        currency: "EGP",
        creditLimit: 50000,
        openingBalance: 0,
        statementDay: 25,
        dueDay: 10,
        color: "emerald",
      },
      {
        name: "ماستر الأهلي – المرتب",
        bankKey: "nbe",
        bankName: "البنك الأهلي المصري",
        brand: "MASTERCARD",
        last4: "7788",
        type: "DEBIT",
        currency: "EGP",
        openingBalance: 48000,
        color: "indigo",
      },
      {
        name: "فيزا QNB للسفر",
        bankKey: "qnb",
        bankName: "QNB الأهلي",
        brand: "VISA",
        last4: "9012",
        type: "CREDIT",
        currency: "EGP",
        creditLimit: 30000,
        openingBalance: 0,
        statementDay: 5,
        dueDay: 20,
        color: "amber",
      },
    ])
    .returning();

  const [cib, nbe, qnb] = inserted;

  console.log("📨 تحليل رسائل البنك التجريبية…");
  for (const sample of SAMPLE_MESSAGES) {
    const result = await ingestMessage({ rawText: sample.text, sender: sample.sender, source: "PASTE" });
    console.log(`   • ${sample.sender}: ${result.status}`);
  }

  console.log("📊 توليد عمليات تاريخية…");
  const now = new Date();
  const rows: (typeof transactions.$inferInsert)[] = [];
  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const count = 8 + Math.floor(Math.random() * 7);
    for (let i = 0; i < count; i++) {
      const merchant = pickMerchant();
      const day = 1 + Math.floor(Math.random() * 27);
      const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 9 + Math.floor(Math.random() * 12), 15);
      if (date > now) continue;
      const card = Math.random() < 0.55 ? cib : Math.random() < 0.7 ? nbe : qnb;
      const amount = randomAmount(merchant.min, merchant.max);
      rows.push({
        cardId: card.id,
        type: "PURCHASE",
        direction: "OUT",
        amount,
        currency: "EGP",
        merchant: merchant.name,
        occurredAt: date,
        source: "MANUAL",
        categoryId: await suggestCategoryId({ merchant: merchant.name, type: "PURCHASE" }),
      });
    }

    // مرتب شهري على بطاقة الأهلي
    const salaryDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 28, 10, 0);
    if (salaryDate <= now) {
      rows.push({
        cardId: nbe.id,
        type: "DEPOSIT",
        direction: "IN",
        amount: 32000,
        currency: "EGP",
        merchant: "إيداع مرتب",
        occurredAt: salaryDate,
        source: "MANUAL",
        categoryId: await suggestCategoryId({ merchant: "راتب", type: "DEPOSIT" }),
      });
    }

    // سداد بطاقة CIB
    const payDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 9, 12, 0);
    if (payDate <= now) {
      rows.push({
        cardId: cib.id,
        type: "PAYMENT",
        direction: "IN",
        amount: randomAmount(4000, 9000),
        currency: "EGP",
        merchant: "سداد بطاقة",
        occurredAt: payDate,
        source: "MANUAL",
        categoryId: await suggestCategoryId({ merchant: "سداد", type: "PAYMENT" }),
      });
    }
  }

  await db.insert(transactions).values(rows);
  await recomputeAllCards();

  console.log(`✅ تم إنشاء ${rows.length} عملية + ${SAMPLE_MESSAGES.length} رسالة + ${inserted.length} بطاقات`);
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ فشل الـ seed:", error);
  process.exit(1);
});
