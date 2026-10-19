"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { extractPdfText } from "@/lib/import/pdf";
import { parseStatementLines, type StatementRow } from "@/lib/import/statement";
import { db } from "@/db/client";
import { cards, messages, transactions } from "@/db/schema";
import { parseAmount } from "@/lib/sms/normalize";
import { recomputeCard } from "@/lib/services/balances";
import { suggestCategoryId } from "@/lib/services/categorize";
import { DEFAULT_DIRECTION, type TxType } from "@/lib/sms/types";

/**
 * استيراد عمليات/كشف حساب من CSV — مقابل `hub/import-expenses` في Mezanetak.
 *
 * الأعمدة المدعومة (بأي ترتيب، والعناوين عربية أو إنجليزية):
 * date/التاريخ · amount/المبلغ · merchant/التاجر · type/النوع · card/البطاقة (اسم أو آخر 4)
 * category/الفئة · currency/العملة · note/ملاحظة
 */

export interface ImportState {
  ok: boolean;
  message?: string;
  imported?: number;
  skipped?: number;
}

const ALIASES: Record<string, string[]> = {
  date: ["date", "التاريخ", "تاريخ", "occurred", "occurredat", "day"],
  amount: ["amount", "المبلغ", "مبلغ", "value", "القيمه", "القيمة"],
  merchant: ["merchant", "التاجر", "تاجر", "description", "الوصف", "بيان", "details"],
  type: ["type", "النوع", "نوع", "kind"],
  card: ["card", "البطاقه", "البطاقة", "account", "الحساب", "last4", "آخر 4"],
  category: ["category", "الفئه", "الفئة"],
  currency: ["currency", "العمله", "العملة"],
  note: ["note", "ملاحظه", "ملاحظة", "notes"],
};

const TYPE_WORDS: { type: TxType; words: string[] }[] = [
  { type: "WITHDRAWAL", words: ["سحب", "withdrawal", "atm"] },
  { type: "REFUND", words: ["استرداد", "refund", "مرتجع"] },
  { type: "PAYMENT", words: ["سداد", "payment"] },
  { type: "DEPOSIT", words: ["ايداع", "إيداع", "deposit", "راتب", "salary"] },
  { type: "TRANSFER_IN", words: ["تحويل وارد", "transfer in", "وارد"] },
  { type: "TRANSFER_OUT", words: ["تحويل", "transfer", "صادر"] },
  { type: "FEE", words: ["رسوم", "fee", "عموله"] },
  { type: "PURCHASE", words: ["شراء", "purchase", "مشتريات"] },
];

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((cell) => cell.trim());
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(value.trim());
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function detectType(value: string): TxType {
  const folded = normalizeHeader(value);
  for (const entry of TYPE_WORDS) {
    if (entry.words.some((word) => folded.includes(normalizeHeader(word)))) return entry.type;
  }
  return "PURCHASE";
}

export async function importCsvAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  const rawText = String(formData.get("text") ?? "");
  let content = rawText;

  if (file && typeof file === "object" && "text" in file) {
    try {
      content = await (file as File).text();
    } catch {
      content = rawText;
    }
  }

  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return { ok: false, message: "الملف فاضي أو مفيهوش صفوف بيانات" };

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const columnOf = (key: string): number => {
    const names = ALIASES[key].map(normalizeHeader);
    return headers.findIndex((header) => names.includes(header));
  };
  const map: Record<string, number> = {
    date: columnOf("date"),
    amount: columnOf("amount"),
    merchant: columnOf("merchant"),
    type: columnOf("type"),
    card: columnOf("card"),
    category: columnOf("category"),
    currency: columnOf("currency"),
    note: columnOf("note"),
  };

  if (map.amount < 0) return { ok: false, message: "مفيش عمود مبلغ (amount/المبلغ) في العناوين" };

  const allCards = await db.select().from(cards);
  const touched = new Set<string>();
  let imported = 0;
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const amount = parseAmount(cells[map.amount] ?? "");
    if (amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    const cardCell = map.card >= 0 ? (cells[map.card] ?? "").trim() : "";
    let card = allCards.find((c) => c.last4 === cardCell.slice(-4) && cardCell.length >= 4);
    if (!card && cardCell) card = allCards.find((c) => c.name.trim() === cardCell);
    if (!card && cardCell) card = allCards.find((c) => normalizeHeader(c.name).includes(normalizeHeader(cardCell)));

    const merchant = map.merchant >= 0 ? (cells[map.merchant] ?? "").trim() || null : null;
    const type = map.type >= 0 ? detectType(cells[map.type] ?? "") : "PURCHASE";
    const occurredAt = (map.date >= 0 ? parseDate(cells[map.date] ?? "") : null) ?? new Date();
    const currency = map.currency >= 0 ? (cells[map.currency] ?? "").trim().toUpperCase() || "EGP" : "EGP";

    // إلغاء التكرار: نفس (التاريخ + المبلغ + التاجر + الحساب)
    const hash = createHash("sha256")
      .update(`${occurredAt.toISOString().slice(0, 10)}|${amount}|${merchant ?? ""}|${card?.id ?? ""}`)
      .digest("hex");
    const [existing] = await db.select({ id: messages.id }).from(messages).where(hashKey(hash)).limit(1);
    if (existing) {
      skipped++;
      continue;
    }

    const categoryId = await suggestCategoryId({ merchant, text: cells.join(" "), type });
    const [tx] = await db
      .insert(transactions)
      .values({
        cardId: card?.id ?? null,
        type,
        direction: DEFAULT_DIRECTION[type],
        amount,
        currency,
        merchant,
        categoryId,
        occurredAt,
        note: map.note >= 0 ? (cells[map.note] ?? "").trim() || "استيراد CSV" : "استيراد CSV",
        source: "IMPORT",
      })
      .returning();

    // سجّل بصمة الصف كرسالة مصدر (للرجوع لها ومنع التكرار)
    await db.insert(messages).values({
      rawText: line.slice(0, 900),
      sender: "CSV_IMPORT",
      receivedAt: occurredAt,
      hash,
      status: "PARSED",
      decision: "AUTO_POST",
      confidence: 0.9,
      parsed: JSON.stringify({ amount, merchant, type, currency }),
      cardId: card?.id ?? null,
      source: "IMPORT",
    });

    if (tx.cardId) touched.add(tx.cardId);
    imported++;
  }

  for (const cardId of touched) await recomputeCard(cardId);

  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/settings");

  return {
    ok: imported > 0,
    message: `تم استيراد ${imported} عملية${skipped ? ` (و${skipped} اتخطّت: مكررة أو مبلغ غير صالح)` : ""}`,
    imported,
    skipped,
  };
}

/** شرط مطابقة بصمة الصف (لمنع تكرار الاستيراد) */
function hashKey(hash: string) {
  return eq(messages.hash, hash);
}

// ── استيراد كشف حساب (PDF أو نص) ────────────────────────────────────────────

export interface StatementRowDto {
  dateIso: string | null;
  amount: number;
  currency: string;
  merchant: string | null;
  description: string;
  type: string;
  direction: "OUT" | "IN";
  raw: string;
  confidence: number;
}

export interface StatementPreviewState {
  ok: boolean;
  message?: string;
  rows?: StatementRowDto[];
  skipped?: number;
  warnings?: string[];
  source?: string;
}

interface StatementSource {
  text: string;
  name: string;
  isPdf: boolean;
  pages: number;
  warnings: string[];
}

/** قراءة الملف (PDF ← استخراج نص، غيره ← نص خام) */
async function readStatementSource(formData: FormData): Promise<StatementSource> {
  const entry = formData.get("file");
  if (entry && typeof entry === "object" && "arrayBuffer" in entry) {
    const file = entry as File;
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf =
      file.type === "application/pdf" ||
      /\.pdf$/i.test(file.name) ||
      buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    if (isPdf) {
      const extracted = extractPdfText(buffer);
      return {
        text: extracted.text,
        name: file.name,
        isPdf: true,
        pages: extracted.pages,
        warnings: extracted.warnings,
      };
    }
    return { text: buffer.toString("utf8"), name: file.name, isPdf: false, pages: 0, warnings: [] };
  }

  return { text: String(formData.get("text") ?? ""), name: "نص ملصوق", isPdf: false, pages: 0, warnings: [] };
}

function toDto(rows: StatementRow[]): StatementRowDto[] {
  return rows.map((row) => ({
    dateIso: row.date ? row.date.toISOString() : null,
    amount: row.amount,
    currency: row.currency,
    merchant: row.merchant,
    description: row.description,
    type: row.type,
    direction: row.direction,
    raw: row.raw,
    confidence: row.confidence,
  }));
}

/** معاينة كشف (PDF/CSV/نص) من غير حفظ — المستخدم يراجع الأول */
export async function previewStatementAction(
  _prev: StatementPreviewState,
  formData: FormData,
): Promise<StatementPreviewState> {
  void _prev; // الشكل المطلوب من useActionState
  const source = await readStatementSource(formData);
  if (!source.text.trim()) return { ok: false, message: "مفيش محتوى في الملف", warnings: source.warnings };

  const result = parseStatementLines(source.text.split(/\r?\n/), {
    defaultYear: new Date().getFullYear(),
    maxRows: 400,
  });

  if (!result.rows.length) {
    return {
      ok: false,
      message: `مقدرناش نستخرج عمليات من «${source.name}» (${result.reasons.join("، ") || "مفيش صفوف صالحة"})`,
      warnings: source.warnings,
      skipped: result.skipped,
      source: source.name,
    };
  }

  const pageNote = source.isPdf && source.pages ? ` · ${source.pages} صفحة` : "";
  return {
    ok: true,
    message: `استخرجنا ${result.rows.length} صف من «${source.name}»${pageNote} (اتخطّى ${result.skipped})`,
    rows: toDto(result.rows),
    skipped: result.skipped,
    warnings: source.warnings,
    source: source.name,
  };
}

/** حفظ الصفوف المختارة كعمليات (مع إلغاء التكرار) */
export async function importStatementAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  void _prev;
  const raw = String(formData.get("rows") ?? "");
  const cardId = String(formData.get("cardId") ?? "").trim() || null;
  if (!raw) return { ok: false, message: "مفيش صفوف مختارة للحفظ" };

  let rows: StatementRowDto[];
  try {
    rows = JSON.parse(raw) as StatementRowDto[];
  } catch {
    return { ok: false, message: "الصفوف مش بصيغة صحيحة" };
  }

  const touched = new Set<string>();
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped++;
      continue;
    }
    const occurredAt = row.dateIso ? new Date(row.dateIso) : new Date();
    const type = (row.type || "PURCHASE") as TxType;
    const hash = createHash("sha256")
      .update(`${occurredAt.toISOString().slice(0, 10)}|${amount}|${row.merchant ?? row.description ?? ""}|${cardId ?? ""}|STATEMENT`)
      .digest("hex");

    const [existing] = await db.select({ id: messages.id }).from(messages).where(eq(messages.hash, hash)).limit(1);
    if (existing) {
      skipped++;
      continue;
    }

    const categoryId = await suggestCategoryId({ merchant: row.merchant, text: row.description, type });
    await db.insert(transactions).values({
      cardId,
      type,
      direction: row.direction === "IN" ? "IN" : DEFAULT_DIRECTION[type] ?? "OUT",
      amount,
      currency: row.currency || "EGP",
      merchant: row.merchant,
      description: row.description || null,
      categoryId,
      occurredAt,
      note: "استيراد كشف حساب",
      source: "IMPORT",
    });
    await db.insert(messages).values({
      rawText: (row.raw ?? "").slice(0, 900),
      sender: "STATEMENT_IMPORT",
      receivedAt: occurredAt,
      hash,
      status: "PARSED",
      decision: "AUTO_POST",
      confidence: row.confidence ?? 0.7,
      parsed: JSON.stringify({ amount, merchant: row.merchant, type, currency: row.currency }),
      cardId,
      source: "IMPORT",
    });

    if (cardId) touched.add(cardId);
    imported++;
  }

  for (const id of touched) await recomputeCard(id);

  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/settings");

  return {
    ok: imported > 0,
    message: `تم استيراد ${imported} عملية${skipped ? ` (و${skipped} اتخطّت: مكررة أو غير صالحة)` : ""}`,
    imported,
    skipped,
  };
}
