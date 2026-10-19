/**
 * اختبار استيراد الكشوف: بنولّد ملف PDF صناعي (بـstream مضغوط وغير مضغوط)
 * وبنجرّب عليه استخراج النص ← تحليل الصفوف.
 */
import { deflateSync } from "node:zlib";
import { extractPdfText } from "../src/lib/import/pdf";
import { parseStatementLines, summarizeStatement } from "../src/lib/import/statement";

const STATEMENT_LINES = [
  "Statement of Account - CIB - Oct 2026",
  "Date        Description                 Amount      Balance",
  "Opening Balance                                        10,000.00",
  "01/10/2026  POS PURCHASE CARREFOUR MAADI   1,250.00 DR   8,750.00",
  "03/10/2026  ATM WITHDRAWAL NASR CITY       2,000.00 DR   6,750.00",
  "05/10/2026  SALARY CREDIT PAYROLL         12,000.00 CR  18,750.00",
  "07/10/2026  BILL PAYMENT VODAFONE            320.50 DR  18,429.50",
  "09/10/2026  TRANSFER OUT TO INSTAPAY       1,500.00 DR  16,929.50",
  "12/10/2026  REFUND AMAZON.COM              1,215.00 CR  18,144.50",
  "15/10/2026  CARD FEE ANNUAL                  450.00 DR  17,694.50",
  "2026-10-20  شراء من طلبات مصر                320.75 DR  17,373.75",
  "Closing Balance                                        17,373.75",
  "Total 8 transactions                                   Page 1",
];

function contentStream(lines: string[]): string {
  // كل سطر بيترسم بمشغّل Tj مع نقل سطر بـTd
  let out = "BT /F1 11 Tf 40 760 Td 14 TL\n";
  for (const line of lines) {
    const escaped = line.replace(/([\\()])/g, "\\$1");
    out += `(${escaped}) Tj T*\n`;
  }
  out += "ET";
  return out;
}

function buildPdf(lines: string[], compress: boolean): Buffer {
  const stream = contentStream(lines);
  const streamBytes = compress ? deflateSync(Buffer.from(stream, "latin1")) : Buffer.from(stream, "latin1");
  const filter = compress ? "/Filter /FlateDecode " : "";

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  objects.push(`<< ${filter}/Length ${streamBytes.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let position = 0;

  const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
  chunks.push(header);
  position += header.length;

  objects.forEach((obj, index) => {
    offsets.push(position);
    const prefix = Buffer.from(`${index + 1} 0 obj\n${obj}\n`, "latin1");
    chunks.push(prefix);
    position += prefix.length;
    if (index === 3) {
      const s = Buffer.from("stream\n", "latin1");
      chunks.push(s, streamBytes);
      const e = Buffer.from("\nendstream\n", "latin1");
      chunks.push(e);
      position += s.length + streamBytes.length + e.length;
    }
    const suffix = Buffer.from("endobj\n", "latin1");
    chunks.push(suffix);
    position += suffix.length;
  });

  const xrefStart = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  chunks.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(chunks);
}

/** سطور كشف عربي/مختلط مباشرةً (بدون PDF) — بتختبر المحلل نفسه */
const TEXT_STATEMENT = [
  "كشف حساب - بنك مصر - أكتوبر 2026",
  "التاريخ      البيان                        المبلغ        الرصيد",
  "الرصيد السابق                                          5,000.00",
  "05/10/2026  شراء من كارفور المعادي        1,250.00 مدين   3,750.00",
  "08/10/2026  سحب من ATM                    2,000.00 مدين   1,750.00",
  "10/10/2026  ايداع راتب                   12,000.00 دائن  13,750.00",
  "12/10/2026  سداد فاتورة فودافون             320.50 مدين  13,429.50",
  "15/10/2026  استرداد من امازون             1,215.00 دائن  14,644.50",
  "الإجمالي                                              14,644.50",
];

function main() {
  console.log("=== نص كشف عربي مباشر (بدون PDF) ===");
  const textResult = parseStatementLines(TEXT_STATEMENT, { defaultYear: 2026 });
  console.log("التحليل:", summarizeStatement(textResult));
  for (const row of textResult.rows) {
    console.log(
      `  ${row.date ? row.date.toISOString().slice(0, 10) : "بدون تاريخ"} | ${row.type.padEnd(12)} | ${row.direction} | ${String(row.amount).padStart(8)} ${row.currency} | ثقة ${row.confidence} | ${row.description.slice(0, 30)}`,
    );
  }

  for (const compress of [false, true]) {
    const pdf = buildPdf(STATEMENT_LINES, compress);
    const extracted = extractPdfText(pdf);
    console.log(`\n=== PDF ${compress ? "مضغوط (FlateDecode)" : "غير مضغوط"} · ${pdf.length} بايت ===`);
    console.log("صفحات:", extracted.pages, "· سطور:", extracted.lines.length, "· تحذيرات:", extracted.warnings.join(" | ") || "لا شيء");
    console.log("أول سطر:", extracted.lines[0]);

    const result = parseStatementLines(extracted.lines, { defaultYear: 2026 });
    console.log("التحليل:", summarizeStatement(result), "· أسباب التخطي:", result.reasons.join("، ") || "—");
    for (const row of result.rows) {
      console.log(
        `  ${row.date ? row.date.toISOString().slice(0, 10) : "بدون تاريخ"} | ${row.type.padEnd(12)} | ${row.direction} | ${String(row.amount).padStart(8)} ${row.currency} | ثقة ${row.confidence} | ${row.description.slice(0, 34)}`,
      );
    }
  }
}

main();
