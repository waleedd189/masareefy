import { z } from "zod";
import { getTableColumns, type Column } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import {
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
} from "@/db/schema";
import { recomputeAllCards } from "@/lib/services/balances";

/**
 * استيراد نسخة احتياطية (restore).
 *
 * التصميم **عام (generic)** مش مكتوب يدوي لكل جدول: بناخد أعمدة الجدول من
 * `getTableColumns` وبنحوّل قيمة كل عمود حسب نوعه (تاريخ/رقم/منطقي/نص).
 * الفائدة: نفس الكود يفهم نسخة إصدار 2 (من غير أرشيف ولا بيانات متعلَّمة)
 * وإصدار 3، ولو ضفنا جدول أو عمود جديد بعد كده الاستيراد يشتغل من غير تعديل.
 *
 * الأمان: كل الصفوف بتتحوّل وتُفحص **قبل** أي حذف أو كتابة — يعني لو الملف بايظ
 * بنوقف قبل ما نلمس القاعدة (مهم خصوصًا في وضع «استبدال كامل»).
 */

/** الجداول بالترتيب الآمن للمفاتيح الأجنبية (الأب الأول) */
const TABLES_IN_ORDER: { key: string; label: string; table: SQLiteTable }[] = [
  { key: "categories", label: "الفئات", table: categories },
  { key: "cards", label: "الحسابات والبطاقات", table: cards },
  { key: "statements", label: "أرشيف الكشوف", table: statements },
  { key: "parserWords", label: "مفردات المحلل", table: parserWords },
  { key: "senderLinks", label: "روابط المرسلين", table: senderLinks },
  { key: "parserRules", label: "قواعد التحليل المخصّصة", table: parserRules },
  { key: "goals", label: "أهداف الادخار", table: goals },
  { key: "recurringRules", label: "المتكررات والاشتراكات", table: recurringRules },
  { key: "debts", label: "الديون", table: debts },
  { key: "messages", label: "رسائل البنك", table: messages },
  { key: "transactions", label: "العمليات", table: transactions },
  { key: "settings", label: "الإعدادات", table: settings },
];

/** مفاتيح الإعدادات اللي ممنوع استيرادها (أسرار/مفاتيح API) */
const SECRET_SETTING_PREFIXES = ["msr_", "token", "secret"];

/** الغلاف الخارجي للنسخة — متسامح مع الحقول الناقصة أو الزيادة */
const BackupEnvelope = z.object({
  app: z.string().optional(),
  version: z.number().optional(),
  generatedAt: z.string().optional(),
  totals: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type RestoreMode = "merge" | "replace";

export interface TableCount {
  key: string;
  label: string;
  /** عدد الصفوف في ملف النسخة */
  inBackup: number;
  /** عدد الصفوف الموجودة في القاعدة دلوقتي */
  current: number;
  /** عدد الصفوف اللي دخلت فعلًا */
  inserted?: number;
}

export interface BackupPreview {
  ok: boolean;
  message?: string;
  version?: number;
  generatedAt?: string | null;
  app?: string;
  counts?: TableCount[];
  warnings?: string[];
}

export interface RestoreResult {
  ok: boolean;
  message?: string;
  mode?: RestoreMode;
  counts?: TableCount[];
  warnings?: string[];
  /**
   * الاستيراد نجح بس مفيش حاجة جديدة دخلت (كل صفوف النسخة موجودة أصلًا).
   * دي مش غلطة — إعادة الاستيراد لازم تكون idempotent — بس بنعلّمها
   * عشان الواجهة تفرق بينها وبين «دخلت بيانات فعلًا».
   */
  noChanges?: boolean;
}

// ── تحويل القيم ──────────────────────────────────────────────────────────────

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "نعم";
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  const text = String(value ?? "").replace(/[,،\s]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** تحويل قيمة عمود واحد حسب نوعه في المخطط */
function coerceColumn(value: unknown, column: Column): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  switch (column.dataType) {
    case "date": {
      const date = toDate(value);
      return date;
    }
    case "boolean":
      return toBool(value);
    case "number":
      return toNumber(value);
    case "json":
      return value;
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

interface PreparedTable {
  key: string;
  label: string;
  table: SQLiteTable;
  rows: Record<string, unknown>[];
  skipped: number;
}

/**
 * تحويل صفوف جدول من النسخة لصفوف جاهزة للكتابة.
 * - بياخد الأعمدة الموجودة في المخطط الحالي بس (أي عمود قديم/غريب بيتجاهل)
 * - لو عمود `notNull` من غير قيمة ⇒ الصف بيتخطّى (أحسن من إدخال بايظ)
 */
function prepareTable(
  entry: { key: string; label: string; table: SQLiteTable },
  rawRows: unknown[],
  warnings: string[],
): PreparedTable {
  const columns = getTableColumns(entry.table) as Record<string, Column>;
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const raw of rawRows) {
    if (!raw || typeof raw !== "object") {
      skipped++;
      continue;
    }
    const source = raw as Record<string, unknown>;
    const row: Record<string, unknown> = {};
    let invalid = false;

    for (const [key, column] of Object.entries(columns)) {
      if (!(key in source)) continue;
      const coerced = coerceColumn(source[key], column);
      if (coerced === undefined) continue;
      if (coerced === null && column.notNull && !column.hasDefault) {
        invalid = true;
        break;
      }
      row[key] = coerced;
    }

    if (invalid || !Object.keys(row).length) {
      skipped++;
      continue;
    }
    rows.push(row);
  }

  if (skipped) warnings.push(`${entry.label}: اتخطّى ${skipped} صف (ناقص حقول مطلوبة أو صيغة غير مفهومة)`);

  // الفئات: الأب يدخل قبل الابن (parentId بيشير لنفس الجدول)
  if (entry.key === "categories") {
    rows.sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
  }
  // الإعدادات: منغير أسرار
  if (entry.key === "settings") {
    const before = rows.length;
    const safe = rows.filter((row) => {
      const key = String(row.key ?? "").toLowerCase();
      return !SECRET_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix));
    });
    if (safe.length !== before) warnings.push(`الإعدادات: استبعدنا ${before - safe.length} مفتاح فيه أسرار/توكنات`);
    return { ...entry, rows: safe, skipped: skipped + (before - safe.length) };
  }

  return { ...entry, rows, skipped };
}

/** عدد الصفوف الحالية في جدول */
async function countTable(table: SQLiteTable): Promise<number> {
  const rows = (await db.select().from(table)) as unknown[];
  return rows.length;
}

// ── القراءة والمعاينة ────────────────────────────────────────────────────────

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** قراءة ملف/نص النسخة والتحقق من غلافه */
export function readBackup(text: string): { ok: true; data: Record<string, unknown>; version: number } | { ok: false; error: string } {
  if (!text.trim()) return { ok: false, error: "الملف فاضي" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "الملف مش JSON صالح — تأكد إنك رفعت نسخة احتياطية من «تصدير → نسخة احتياطية»" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "محتوى الملف مش كائن نسخة احتياطية" };
  }

  const envelope = BackupEnvelope.safeParse(parsed);
  if (!envelope.success) return { ok: false, error: "ترويسة النسخة غير مفهومة" };

  const data = parsed as Record<string, unknown>;
  const hasAnyTable = TABLES_IN_ORDER.some((entry) => asArray(data[entry.key]).length > 0);
  if (!hasAnyTable) {
    return {
      ok: false,
      error: "مفيش أي جدول في النسخة (لا عمليات ولا حسابات) — يمكن ده ملف تصدير عمليات عادي مش نسخة احتياطية",
    };
  }

  return { ok: true, data, version: typeof data.version === "number" ? data.version : 2 };
}

/** معاينة من غير أي كتابة: الأعداد + الفرق عن القاعدة الحالية + تحذيرات */
export async function previewRestore(text: string): Promise<BackupPreview> {
  const read = readBackup(text);
  if (!read.ok) return { ok: false, message: read.error };

  const warnings: string[] = [];
  if (read.version < 3) {
    warnings.push("النسخة إصدار قديم (v2) — أرشيف الكشوف والبيانات المتعلَّمة مش موجودة فيها، وهتترجع فاضية");
  }

  const counts: TableCount[] = [];
  for (const entry of TABLES_IN_ORDER) {
    const rows = asArray(read.data[entry.key]);
    counts.push({
      key: entry.key,
      label: entry.label,
      inBackup: rows.length,
      current: await countTable(entry.table),
    });
  }

  const totalInBackup = counts.reduce((sum, row) => sum + row.inBackup, 0);
  const totalCurrent = counts.reduce((sum, row) => sum + row.current, 0);
  if (totalCurrent > 0) {
    warnings.push(
      `النسخة فيها ${totalInBackup} صف، والقاعدة فيها ${totalCurrent} صف دلوقتي — وضع «الدمج» بيضيف الناقص بس من غير ما يمسح حاجة، ووضع «الاستبدال» بيحذفهم كلهم الأول`,
    );
  }

  return {
    ok: true,
    version: read.version,
    generatedAt: typeof read.data.generatedAt === "string" ? read.data.generatedAt : null,
    app: typeof read.data.app === "string" ? read.data.app : undefined,
    counts,
    warnings,
  };
}

// ── التنفيذ ──────────────────────────────────────────────────────────────────

/**
 * استيراد النسخة.
 *
 * - `merge`: بيدخل الصفوف الناقصة بس (`onConflictDoNothing`) — آمن، مبيمسحش حاجة.
 * - `replace`: بيحذف كل الجداول (بالترتيب العكسي) ثم يكتب النسخة كاملة — مدمّر،
 *   فالواجهة بتطلب تأكيد صريح وبتنصح بتنزيل نسخة من الوضع الحالي الأول.
 *
 * في الحالتين بنعيد حساب أرصدة كل الحسابات في الآخر عشان الأرقام تطلع صح.
 */
export async function applyRestore(text: string, mode: RestoreMode = "merge"): Promise<RestoreResult> {
  const read = readBackup(text);
  if (!read.ok) return { ok: false, message: read.error };

  const warnings: string[] = [];

  // 1) تحويل كل الصفوف الأول (قبل أي حذف) — لو فيه مشكلة نوقف هنا
  const prepared: PreparedTable[] = [];
  for (const entry of TABLES_IN_ORDER) {
    prepared.push(prepareTable(entry, asArray(read.data[entry.key]), warnings));
  }

  const totalRows = prepared.reduce((sum, table) => sum + table.rows.length, 0);
  if (!totalRows) {
    return { ok: false, message: `مفيش صفوف صالحة للاستيراد (${warnings.join(" · ") || "النسخة فاضية"})`, warnings };
  }

  // 2) الاستبدال: حذف بالترتيب العكسي (الابن قبل الأب)
  if (mode === "replace") {
    for (const entry of [...TABLES_IN_ORDER].reverse()) {
      try {
        await db.delete(entry.table);
      } catch (error) {
        return {
          ok: false,
          message: `فشل حذف جدول «${entry.label}» — وقفنا قبل الكتابة عشان البيانات ما تبوظش`,
          warnings: [...warnings, String(error)],
        };
      }
    }
  }

  // 3) الكتابة بالترتيب الآمن
  // أعداد ما قبل الكتابة (لازمة عشان نعرف الدمج ضاف كام صف فعلًا)
  const beforeByTable = new Map<string, number>();
  for (const table of prepared) beforeByTable.set(table.key, await countTable(table.table));

  const counts: TableCount[] = [];
  for (const table of prepared) {
    const before = beforeByTable.get(table.key) ?? 0;
    let inserted = 0;
    if (table.rows.length) {
      try {
        const query =
          mode === "merge"
            ? db.insert(table.table).values(table.rows as never).onConflictDoNothing()
            : db.insert(table.table).values(table.rows as never);
        await query;
        const after = await countTable(table.table);
        inserted = Math.max(0, after - before);
      } catch (error) {
        warnings.push(`«${table.label}»: فشل كتابة ${table.rows.length} صف — ${String(error).slice(0, 160)}`);
      }
    }
    counts.push({
      key: table.key,
      label: table.label,
      inBackup: table.rows.length,
      current: before,
      inserted,
    });
  }

  // 4) الأرصدة تتحسب من جديد بعد ما العمليات دخلت
  try {
    await recomputeAllCards();
  } catch (error) {
    warnings.push(`إعادة حساب الأرصدة فشلت: ${String(error).slice(0, 120)}`);
  }

  const insertedTotal = counts.reduce((sum, row) => sum + (row.inserted ?? 0), 0);
  const txCount = counts.find((row) => row.key === "transactions")?.inserted ?? 0;
  const cardCount = counts.find((row) => row.key === "cards")?.inserted ?? 0;

  return {
    ok: true,
    noChanges: insertedTotal === 0 && mode === "merge",
    mode,
    counts,
    warnings,
    message:
      mode === "replace"
        ? `اتستبدلت القاعدة بالنسخة الاحتياطية: ${txCount} عملية و${cardCount} حساب (و${insertedTotal} صف إجمالًا)، والأرصدة اتحسبت من جديد`
        : insertedTotal
          ? `تم الدمج: ${insertedTotal} صف جديد (${txCount} عملية، ${cardCount} حساب) — الموجود قبل كده ماتغيّرش`
          : "مفيش جديد يتدمج — كل صفوف النسخة موجودة في القاعدة بالفعل",
  };
}

/** ملخص سريع للنسخة (للعرض في الواجهة قبل الاستيراد) */
export function describeBackup(text: string): string {
  const read = readBackup(text);
  if (!read.ok) return read.error;
  const parts = TABLES_IN_ORDER.map((entry) => ({ label: entry.label, count: asArray(read.data[entry.key]).length })).filter(
    (part) => part.count > 0,
  );
  return `إصدار ${read.version} · ${parts.map((part) => `${part.label}: ${part.count}`).join(" · ")}`;
}
