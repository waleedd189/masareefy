/**
 * اختبار استيراد النسخة الاحتياطية (restore).
 *
 * بيشتغل على **قاعدة مؤقتة منفصلة** (`data/restore-test.db`) عشان ما يلمسش
 * قاعدة المعاينة: بنعبّيها بالـseed الحقيقي، نصدّر نسخة، نمسح القاعدة،
 * وبعدين نرجّع النسخة ونتأكد إن كل حاجة رجعت بالظبط (بما فيها الأرصدة).
 *
 * الحالات المغطّاة:
 *  1. تصدير نسخة ← مسح كامل ← استيراد بالدمج ⇒ الأعداد والأرصدة ترجع زي ما كانت
 *  2. إعادة نفس الاستيراد ⇒ صفر صفوف جديدة (idempotent)
 *  3. إضافة حساب+عملية جديدين للنسخة ← دمج ⇒ الصفوف الجديدة بس هي اللي تدخل
 *  4. حذف حساب من القاعدة ← استبدال كامل ⇒ النسخة ترجع بالكامل
 *  5. الأسرار (مفاتيح بتبدأ بـmsr_) ما بتستوردش
 *  6. نسخة إصدار قديم (v2) ⇒ تحذير واضح وبرضه بتترجع
 *  7. ملف بايظ / مش نسخة احتياطية ⇒ رسالة خطأ مفهومة من غير ما نلمس القاعدة
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const TEMP_DB = path.join(process.cwd(), "data", "restore-test.db");
const TEMP_URL = `file:${TEMP_DB}`;
const TSX = path.join(process.cwd(), "node_modules", ".bin", "tsx");

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  console.log(`${condition ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

function run(script: string) {
  execSync(`${TSX} ${script}`, {
    env: { ...process.env, DATABASE_URL: TEMP_URL },
    stdio: ["ignore", "ignore", "pipe"],
  });
}

async function main() {
  // ── تجهيز القاعدة المؤقتة ────────────────────────────────────────────────
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = TEMP_DB + suffix;
    if (existsSync(file)) rmSync(file);
  }
  console.log("=== تجهيز قاعدة اختبار مؤقتة ===");
  run("scripts/migrate.ts");
  run("scripts/seed.ts");
  console.log("✅ القاعدة المؤقتة اتعبّت بالـseed");

  // المتغير لازم يتضبط قبل أي import لقاعدة البيانات
  process.env.DATABASE_URL = TEMP_URL;

  const { db } = await import("../src/db/client");
  const schema = await import("../src/db/schema");
  const { backupJson, parseRange } = await import("../src/lib/export/data");
  const { eq } = await import("drizzle-orm");
  const { applyRestore, previewRestore } = await import("../src/lib/import/restore");

  const {
    cards,
    categories,
    debts,
    goals,
    messages,
    parserRules,
    parserWords,
    recurringRules,
    senderLinks,
    settings,
    statements,
    transactions,
  } = schema;

  const TABLES = [
    { key: "transactions", label: "العمليات", table: transactions },
    { key: "messages", label: "الرسائل", table: messages },
    { key: "debts", label: "الديون", table: debts },
    { key: "recurringRules", label: "المتكررات", table: recurringRules },
    { key: "goals", label: "الأهداف", table: goals },
    { key: "senderLinks", label: "روابط المرسلين", table: senderLinks },
    { key: "parserWords", label: "المفردات", table: parserWords },
    { key: "parserRules", label: "القواعد", table: parserRules },
    { key: "statements", label: "أرشيف الكشوف", table: statements },
    { key: "cards", label: "الحسابات", table: cards },
    { key: "categories", label: "الفئات", table: categories },
    { key: "settings", label: "الإعدادات", table: settings },
  ] as const;

  async function snapshot() {
    const counts: Record<string, number> = {};
    for (const entry of TABLES) counts[entry.key] = ((await db.select().from(entry.table)) as unknown[]).length;
    const balances = new Map(
      ((await db.select().from(cards)) as { id: string; currentBalance: number }[]).map((card) => [
        card.id,
        Math.round(card.currentBalance * 100) / 100,
      ]),
    );
    return { counts, balances };
  }

  // سر مزيف عشان نتأكد إنه ما بيستوردش
  await db.insert(settings).values({ key: "msr_fake_api_token", value: "super-secret-value" });

  const before = await snapshot();
  console.log(
    `\n=== الحالة الأصلية: ${before.counts.transactions} عملية · ${before.counts.cards} حساب · ${before.counts.messages} رسالة · ${before.counts.categories} فئة ===`,
  );

  // ── 1) تصدير نسخة ← مسح ← دمج ────────────────────────────────────────────
  const range = parseRange(new Date(Date.now() - 400 * 86_400_000).toISOString(), new Date().toISOString());
  const backup = await backupJson(range);
  const json = JSON.stringify(backup);
  console.log(`\n=== النسخة الاحتياطية: ${(json.length / 1024).toFixed(1)}KB · إصدار ${backup.version} ===`);

  for (const entry of TABLES) await db.delete(entry.table);
  const wiped = await snapshot();
  check(
    "المسح الكامل صفّر القاعدة",
    Object.values(wiped.counts).every((count) => count === 0),
    `العمليات=${wiped.counts.transactions} الحسابات=${wiped.counts.cards}`,
  );

  const preview = await previewRestore(json);
  check("المعاينة قرأت النسخة", preview.ok === true, preview.message ?? "");
  check(
    "المعاينة بتقول إن القاعدة فاضية والنسخة فيها بيانات",
    (preview.counts ?? []).some((row) => row.key === "transactions" && row.inBackup > 0 && row.current === 0),
    `عمليات في النسخة: ${preview.counts?.find((r) => r.key === "transactions")?.inBackup ?? 0}`,
  );

  const merged = await applyRestore(json, "merge");
  check("الدمج نجح", merged.ok === true, merged.message ?? "");
  const afterMerge = await snapshot();
  check(
    "العمليات رجعت بنفس العدد",
    afterMerge.counts.transactions === before.counts.transactions,
    `${afterMerge.counts.transactions} / ${before.counts.transactions}`,
  );
  check(
    "الحسابات والفئات والرسائل رجعت",
    afterMerge.counts.cards === before.counts.cards &&
      afterMerge.counts.categories === before.counts.categories &&
      afterMerge.counts.messages === before.counts.messages,
    `حسابات ${afterMerge.counts.cards} · فئات ${afterMerge.counts.categories} · رسائل ${afterMerge.counts.messages}`,
  );
  check(
    "الأرصدة اتحسبت من جديد ورجعت زي ما كانت",
    [...before.balances].every(([id, value]) => afterMerge.balances.get(id) === value),
    [...afterMerge.balances].map(([id, value]) => `${id.slice(0, 6)}=${value}`).join(" · "),
  );

  // ── 2) إعادة نفس الاستيراد (idempotent) ──────────────────────────────────
  const again = await applyRestore(json, "merge");
  const insertedAgain = (again.counts ?? []).reduce((sum, row) => sum + (row.inserted ?? 0), 0);
  check(
    "إعادة نفس النسخة ما كرّرتش حاجة (idempotent)",
    again.ok === true && again.noChanges === true && insertedAgain === 0,
    `صفوف جديدة: ${insertedAgain} · noChanges=${String(again.noChanges)}`,
  );

  // ── 3) دمج زيادة: حساب + عملية جداد ─────────────────────────────────────
  const edited = JSON.parse(json) as Record<string, unknown>;
  const newCardId = "card-test-restore-001";
  const newCard = {
    id: newCardId,
    name: "حساب الاختبار الجديد",
    bankKey: "custom",
    bankName: "بنك الاختبار",
    brand: "VISA",
    last4: "9090",
    type: "DEBIT",
    accountType: "CHECKING",
    design: "midnight",
    currency: "EGP",
    creditLimit: 0,
    openingBalance: 500,
    currentBalance: 500,
    color: "emerald",
    isArchived: false,
  };
  (edited.cards as unknown[]).push(newCard);
  (edited.transactions as unknown[]).push({
    id: "tx-test-restore-001",
    cardId: newCardId,
    type: "PURCHASE",
    direction: "OUT",
    amount: 120.5,
    currency: "EGP",
    merchant: "متجر الاختبار",
    occurredAt: new Date().toISOString(),
    source: "MANUAL",
    isPending: false,
  });
  const editedJson = JSON.stringify(edited);

  const incremental = await applyRestore(editedJson, "merge");
  const newCardRows = (await db.select().from(cards)) as { id: string }[];
  const newTxRows = (await db.select().from(transactions)) as { id: string }[];
  check(
    "الدمج ضاف الجديد بس (حساب + عملية)",
    incremental.ok &&
      newCardRows.some((card) => card.id === newCardId) &&
      newTxRows.some((tx) => tx.id === "tx-test-restore-001") &&
      newTxRows.length === before.counts.transactions + 1,
    `العمليات بقت ${newTxRows.length} (كانت ${before.counts.transactions})`,
  );

  // ── 4) الاستبدال الكامل ───────────────────────────────────────────────────
  await db.delete(cards).where(eq(cards.id, newCardId));
  const replaced = await applyRestore(editedJson, "replace");
  const afterReplace = await snapshot();
  check(
    "الاستبدال رجّع النسخة كاملة (بما فيها الحساب اللي اتحذف)",
    replaced.ok === true && afterReplace.counts.transactions === before.counts.transactions + 1,
    `${replaced.message ?? ""} · العمليات ${afterReplace.counts.transactions}`,
  );

  // ── 5) الأسرار ما بتستوردش ───────────────────────────────────────────────
  const secretRows = (await db.select().from(settings)) as { key: string }[];
  check(
    "المفتاح السري (msr_*) ما رجعش",
    !secretRows.some((row) => row.key === "msr_fake_api_token"),
    `الإعدادات: ${secretRows.length} صف`,
  );

  // ── 6) نسخة إصدار قديم (v2) ──────────────────────────────────────────────
  const legacy = JSON.parse(editedJson) as Record<string, unknown>;
  legacy.version = 2;
  delete legacy.statements;
  delete legacy.parserWords;
  delete legacy.senderLinks;
  delete legacy.parserRules;
  const legacyPreview = await previewRestore(JSON.stringify(legacy));
  check(
    "النسخة القديمة (v2) بتدي تحذير واضح وبتترجع",
    legacyPreview.ok === true && (legacyPreview.warnings ?? []).some((w) => w.includes("قديم")),
    (legacyPreview.warnings ?? [])[0] ?? "",
  );
  const legacyRestore = await applyRestore(JSON.stringify(legacy), "merge");
  check(
    "النسخة القديمة اتدمجت من غير كسر",
    legacyRestore.ok === true && legacyRestore.noChanges === true,
    legacyRestore.message ?? "",
  );

  // ── 7) ملفات بايظة ───────────────────────────────────────────────────────
  const broken = await applyRestore("ده مش جيسون خالص", "merge");
  check("ملف بايظ ⇒ رفض برسالة مفهومة", broken.ok === false && !!broken.message, broken.message ?? "");

  const notBackup = await applyRestore(JSON.stringify({ hello: "world" }), "merge");
  check(
    "جيسون مش نسخة احتياطية ⇒ رفض من غير لمس القاعدة",
    notBackup.ok === false && !!notBackup.message,
    notBackup.message ?? "",
  );
  const stillThere = await snapshot();
  check("القاعدة لسه سليمة بعد المحاولات البايظة", stillThere.counts.transactions === before.counts.transactions + 1);

  // ── تنظيف ────────────────────────────────────────────────────────────────
  process.exitCode = failures ? 1 : 0;
  console.log(`\n${failures ? `❌ ${failures} حالة فشلت` : "✅ كل حالات الاستيراد عدّت"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ فشل الاختبار:", error);
  process.exit(1);
});
