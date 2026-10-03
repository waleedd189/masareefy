import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { apiTokens, cards, categories, messages, parserRules, settings, transactions } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { listCards, listTransactions } from "@/lib/services/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** تصدير العمليات: /api/export?format=csv|json */
export async function GET(request: NextRequest) {
  await runMigrations();
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const date = new Date().toISOString().slice(0, 10);

  if (format === "backup") {
    const [cardRows, transactionRows, messageRows, categoryRows, ruleRows, settingRows, tokenRows] = await Promise.all([
      db.select().from(cards),
      db.select().from(transactions),
      db.select().from(messages),
      db.select().from(categories),
      db.select().from(parserRules),
      db.select().from(settings),
      db.select().from(apiTokens),
    ]);
    const backup = {
      application: "masareefy",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        cards: cardRows,
        transactions: transactionRows,
        messages: messageRows,
        categories: categoryRows,
        parserRules: ruleRows,
        settings: settingRows,
        apiTokens: tokenRows,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="masareefy-backup-${date}.json"`,
        "cache-control": "no-store",
      },
    });
  }

  const transactionRows = await listTransactions({ limit: 10000 });

  if (format === "json") {
    const cardRows = await listCards(true);
    return NextResponse.json(
      { exportedAt: new Date().toISOString(), cards: cardRows, transactions: transactionRows },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const header = ["التاريخ", "البطاقة", "آخر4", "النوع", "الاتجاه", "المبلغ", "العملة", "التاجر", "الفئة", "المصدر", "ملاحظة"];
  const lines = [header.join(",")];
  for (const tx of transactionRows) {
    lines.push(
      [
        new Date(tx.occurredAt).toISOString(),
        tx.card?.name ?? "",
        tx.card?.last4 ?? "",
        tx.type,
        tx.direction,
        tx.amount,
        tx.currency,
        tx.merchant ?? "",
        tx.category?.name ?? "",
        tx.source,
        tx.note ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return new NextResponse(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="masareefy-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
