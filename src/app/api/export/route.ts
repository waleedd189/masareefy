import { NextResponse, type NextRequest } from "next/server";
import { comparePeriods, comparisonSheet } from "@/lib/services/compare";
import {
  backupJson,
  buildReportWorkbook,
  fullCsv,
  messagesCsv,
  parseRange,
  transactionsCsv,
  transactionsJson,
} from "@/lib/export/data";

export const runtime = "nodejs";

/**
 * تصدير البيانات — مقابل `hub/reports` + ودجت "PDF and Excel reports" في Mezanetak.
 *
 * GET /api/export?format=json|csv|xlsx|backup&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = (params.get("format") ?? "json").toLowerCase();
  const explicitFrom = params.get("from");
  const explicitTo = params.get("to");
  const range = parseRange(explicitFrom, explicitTo);
  /**
   * النسخة الاحتياطية لازم تكون **كاملة** مش محدودة بالشهر الحالي.
   * من غير كده المستخدم ينزّل نسخة فاكر إنها كل بياناته وهي شهر بس،
   * ولو رجّعها بـ«استبدال كامل» هيخسر الباقي. فلو المستخدم مش محدّد فترة،
   * النسخة بتاخد كل التاريخ (من 1970 لبكرة).
   */
  const backupRange =
    explicitFrom || explicitTo
      ? range
      : parseRange("1970-01-01", new Date(Date.now() + 86_400_000).toISOString());
  const cmpFrom = params.get("cmpFrom");
  const cmpTo = params.get("cmpTo");
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    if (format === "csv") {
      const csv = await fullCsv(range);
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="masareefy-${stamp}.csv"`,
        },
      });
    }

    if (format === "transactions-csv") {
      const csv = await transactionsCsv(range);
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="transactions-${stamp}.csv"`,
        },
      });
    }

    if (format === "messages-csv") {
      const csv = await messagesCsv(range);
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="messages-${stamp}.csv"`,
        },
      });
    }

    // ملف Excel بعدة أوراق (ملخص/عمليات/حسابات/أهداف/التزامات/رسائل)
    if (format === "xlsx" || format === "excel") {
      const comparison = await comparePeriods(range, cmpFrom, cmpTo);
      const buffer = await buildReportWorkbook(range, [comparisonSheet(comparison)]);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="masareefy-report-${stamp}.xlsx"`,
        },
      });
    }

    // نسخة احتياطية كاملة (كل الجداول + الإعدادات غير الحساسة)
    if (format === "backup") {
      const data = await backupJson(backupRange);
      return NextResponse.json(data, {
        headers: { "content-disposition": `attachment; filename="masareefy-backup-${stamp}.json"` },
      });
    }

    const data = await transactionsJson(range);
    return NextResponse.json(data, {
      headers: { "content-disposition": `attachment; filename="transactions-${stamp}.json"` },
    });
  } catch (error) {
    console.error("export failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "export failed" }, { status: 500 });
  }
}
