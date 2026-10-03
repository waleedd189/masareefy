import { NextResponse, type NextRequest } from "next/server";
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
  const transactions = await listTransactions({ limit: 10000 });

  if (format === "json") {
    const cards = await listCards(true);
    return NextResponse.json({ exportedAt: new Date().toISOString(), cards, transactions });
  }

  const header = ["التاريخ", "البطاقة", "آخر4", "النوع", "الاتجاه", "المبلغ", "العملة", "التاجر", "الفئة", "المصدر", "ملاحظة"];
  const lines = [header.join(",")];
  for (const tx of transactions) {
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
