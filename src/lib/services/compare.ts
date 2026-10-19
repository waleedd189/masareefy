import { formatDate, formatMoney, round2 } from "@/lib/format";
import { collectExportData, parseRange, summarize, type DateRange } from "@/lib/export/data";
import type { SheetData } from "@/lib/export/xlsx";
import { TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";

/**
 * مقارنة الفترات — البند الناقص في «إحصاءات متقدمة».
 *
 * بيقارن الفترة المختارة بفترة تانية (افتراضيًا: الفترة اللي قبلها بنفس الطول)
 * ويطلع الفروق بالنسبة المئوية على الإجماليات والفئات وأنواع العمليات.
 */

export interface PeriodSnapshot {
  label: string;
  range: DateRange;
  spent: number;
  income: number;
  net: number;
  count: number;
  days: number;
  dailySpent: number;
  byCategory: { name: string; total: number; pct: number }[];
  byType: { type: string; label: string; total: number }[];
  topMerchants: { merchant: string; total: number }[];
}

export interface Delta {
  current: number;
  previous: number;
  diff: number;
  /** نسبة التغير (null لو الفترة السابقة صفر) */
  pct: number | null;
  /** زيادة = أسوأ في المصروف، وأحسن في الدخل */
  direction: "up" | "down" | "flat";
}

export interface RowDelta {
  name: string;
  current: number;
  previous: number;
  diff: number;
  pct: number | null;
}

export interface Comparison {
  current: PeriodSnapshot;
  previous: PeriodSnapshot;
  spent: Delta;
  income: Delta;
  net: Delta;
  count: Delta;
  dailySpent: Delta;
  categories: RowDelta[];
  types: RowDelta[];
  merchants: RowDelta[];
}

/** الفترة اللي قبل الفترة الحالية بنفس الطول بالظبط */
export function previousPeriod(range: DateRange): DateRange {
  const length = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000));
  const to = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate() - 1);
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - length);
  return { from, to };
}

function delta(current: number, previous: number): Delta {
  const diff = round2(current - previous);
  return {
    current,
    previous,
    diff,
    pct: previous > 0 ? Math.round((diff / previous) * 100) : null,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

function rowsDelta(
  current: { name?: string; type?: string; merchant?: string; total: number }[],
  previous: { name?: string; type?: string; merchant?: string; total: number }[],
  key: "name" | "type" | "merchant",
): RowDelta[] {
  const prevMap = new Map(previous.map((row) => [String(row[key] ?? ""), row.total]));
  const seen = new Set<string>();
  const out: RowDelta[] = [];

  for (const row of current) {
    const name = String(row[key] ?? "");
    if (!name) continue;
    seen.add(name);
    const prev = prevMap.get(name) ?? 0;
    out.push({ name, current: row.total, previous: prev, diff: round2(row.total - prev), pct: prev > 0 ? Math.round(((row.total - prev) / prev) * 100) : null });
  }
  for (const row of previous) {
    const name = String(row[key] ?? "");
    if (!name || seen.has(name)) continue;
    out.push({ name, current: 0, previous: row.total, diff: round2(-row.total), pct: -100 });
  }

  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

async function snapshot(range: DateRange, label: string): Promise<PeriodSnapshot> {
  const data = await collectExportData(range);
  const totals = summarize(data);
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1);
  return {
    label,
    range,
    spent: totals.spent,
    income: totals.income,
    net: totals.net,
    count: data.transactions.length,
    days,
    dailySpent: round2(totals.spent / days),
    byCategory: totals.byCategory.map((row) => ({ name: row.name, total: row.total, pct: row.pct })),
    byType: totals.byType.map((row) => ({
      type: row.type,
      label: TX_TYPE_LABELS[row.type as TxType] ?? row.type,
      total: row.total,
    })),
    topMerchants: totals.topMerchants.map((row) => ({ merchant: row.merchant, total: row.total })),
  };
}

/** مقارنة فترة بفترة تانية (لو مش محددة: اللي قبلها بنفس الطول) */
export async function comparePeriods(
  range: DateRange,
  compareFrom?: string | null,
  compareTo?: string | null,
): Promise<Comparison> {
  const explicit = compareFrom || compareTo;
  const prevRange = explicit
    ? parseRange(compareFrom ?? range.from.toISOString().slice(0, 10), compareTo ?? range.from.toISOString().slice(0, 10))
    : previousPeriod(range);

  const [current, previous] = await Promise.all([
    snapshot(range, `${formatDate(range.from)} → ${formatDate(range.to)}`),
    snapshot(prevRange, `${formatDate(prevRange.from)} → ${formatDate(prevRange.to)}`),
  ]);

  return {
    current,
    previous,
    spent: delta(current.spent, previous.spent),
    income: delta(current.income, previous.income),
    net: delta(current.net, previous.net),
    count: delta(current.count, previous.count),
    dailySpent: delta(current.dailySpent, previous.dailySpent),
    categories: rowsDelta(current.byCategory, previous.byCategory, "name"),
    types: rowsDelta(current.byType, previous.byType, "type"),
    merchants: rowsDelta(current.topMerchants, previous.topMerchants, "merchant"),
  };
}

/** صياغة الفرق بالعربي (مثال: «+12% (‎+1,500 ج.م‎)») */
export function deltaLabel(d: Delta, currency = "EGP"): string {
  if (!d.diff) return "من غير تغيير";
  const sign = d.diff > 0 ? "+" : "−";
  const pct = d.pct !== null ? `${sign}${Math.abs(d.pct)}%` : "";
  return `${pct ? `${pct} · ` : ""}${sign}${formatMoney(Math.abs(d.diff), currency)}`;
}

/** ورقة Excel للمقارنة — بتتضاف لملف التقرير لو المستخدم طلب فترة مقارنة */
export function comparisonSheet(cmp: Comparison, currency = "EGP"): SheetData {
  const row = (label: string, d: Delta) => [
    label,
    d.previous,
    d.current,
    d.diff,
    d.pct !== null ? `${d.pct}%` : "—",
  ];
  return {
    name: "المقارنة",
    widths: [26, 16, 16, 16, 10],
    rows: [
      ["مقارنة الفترات", cmp.previous.label, cmp.current.label, "", ""],
      ["العملة", currency, "", "", ""],
      [],
      ["البيان", "الفترة السابقة", "الفترة الحالية", "الفرق", "النسبة"],
      row("إجمالي الصرف", cmp.spent),
      row("إجمالي الدخل", cmp.income),
      row("الصافي", cmp.net),
      row("متوسط الصرف اليومي", cmp.dailySpent),
      row("عدد العمليات", cmp.count),
      [],
      ["الفئة", "السابق", "الحالي", "الفرق", "النسبة"],
      ...cmp.categories.map((r) => [r.name, r.previous, r.current, r.diff, r.pct !== null ? `${r.pct}%` : "—"]),
      [],
      ["التاجر", "السابق", "الحالي", "الفرق", "النسبة"],
      ...cmp.merchants.slice(0, 20).map((r) => [r.name, r.previous, r.current, r.diff, r.pct !== null ? `${r.pct}%` : "—"]),
    ],
  };
}
