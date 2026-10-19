/** اختبار التحويل بين الحسابات: تنفيذ ← تحقق ← إلغاء ← تحقق */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, transactions } from "@/db/schema";
import { cancelTransfer, listTransfers, performTransfer } from "@/lib/services/transfers";

async function main() {
  const all = await db.select().from(cards);
  if (all.length < 2) {
    console.log("لازم حسابين على الأقل — شغّل npm run db:seed");
    return;
  }
  const [a, b] = all;
  const before = { a: a.currentBalance, b: b.currentBalance };
  console.log(`قبل: ${a.name} = ${before.a} ${a.currency} · ${b.name} = ${before.b} ${b.currency}`);

  const amount = 250.5;
  const res = await performTransfer({ fromId: a.id, toId: b.id, amount, note: "اختبار تحويل" });
  console.log("التحويل:", res.ok ? "نجح" : "فشل", "|", res.message);

  const after = await db.select().from(cards);
  const aAfter = after.find((c) => c.id === a.id)!;
  const bAfter = after.find((c) => c.id === b.id)!;
  console.log(`بعد: ${aAfter.name} = ${aAfter.currentBalance} · ${bAfter.name} = ${bAfter.currentBalance}`);

  const legs = await db.select().from(transactions).where(eq(transactions.transferId, res.transferId!));
  console.log(
    `الرجلين: ${legs.length} →`,
    legs.map((l) => `${l.type}/${l.direction}/${l.amount}${l.currency}`).join(" , "),
  );
  console.log("آخر التحويلات:", (await listTransfers(3)).map((t) => `${t.fromName}→${t.toName} ${t.amount}`).join(" | "));

  // حالات خطأ متوقعة
  console.log("نفس الحساب:", (await performTransfer({ fromId: a.id, toId: a.id, amount: 10 })).message);
  console.log("مبلغ صفر:", (await performTransfer({ fromId: a.id, toId: b.id, amount: 0 })).message);
  console.log("رصيد مش كفاية:", (await performTransfer({ fromId: b.id, toId: a.id, amount: 9_999_999 })).message);

  const cancel = await cancelTransfer(res.transferId!);
  console.log("الإلغاء:", cancel.ok ? "نجح" : "فشل", "|", cancel.message);
  const restored = await db.select().from(cards);
  const aRestored = restored.find((c) => c.id === a.id)!;
  const bRestored = restored.find((c) => c.id === b.id)!;
  console.log(
    `بعد الإلغاء: ${aRestored.name} = ${aRestored.currentBalance} (كان ${before.a}) · ${bRestored.name} = ${bRestored.currentBalance} (كان ${before.b})`,
  );
  const ok = Math.abs(aRestored.currentBalance - before.a) < 0.01 && Math.abs(bRestored.currentBalance - before.b) < 0.01;
  console.log(ok ? "✅ الأرصدة رجعت زي ما كانت" : "❌ فيه فرق في الأرصدة");
}

main();
