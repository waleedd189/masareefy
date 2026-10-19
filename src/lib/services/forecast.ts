import { and, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { round2 } from "@/lib/format";
import { isSpend } from "./stats";

/**
 * التوقعات الموسمية — البند الناقص في «إحصاءات متقدمة».
 *
 * الفكرة: متوسط آخر 3 شهور + اتجاه عام (ميل الخط) + عامل موسمية
 * (نفس الشهر السنة اللي فاتت مقارنة بمتوسط السنة)، ومعاهم مدى متوقع
 * (±انحراف معياري) ودرجة ثقة حسب كمية البيانات وانتظامها.
 */

export interface MonthPoint {
  key: string;
  label: string;
  year: number;
  month: number;
  spent: number;
  count: number;
}

export interface ForecastPoint {
  key: string;
  label: string;
  projected: number;
  low: number;
  high: number;
  basis: string;
}

export interface ForecastResult {
  history: MonthPoint[];
  next: ForecastPoint;
  /** نسبة الاتجاه الشهري (مثلاً +8 يعني صرفك بيزيد 8% كل شهر) */
  trendPct: number | null;
  /** عامل الموسمية لنفس الشهر (null لو مفيش بيانات سنة فاتت) */
  seasonalityPct: number | null;
  /** أعلى الفئات المتوقع صرفها الشهر الجاي */
  byCategory: { id: string; name: string; emoji: string; projected: number; last: number }[];
  /** 0—1 حسب عدد الشهور وانتظام الصرف */
  confidence: number;
  currency: string;
}

const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1));
}

/** ميل الخط (انحدار خطي بسيط) على سلسلة زمنية */
function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = average(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * توقع الشهر الجاي (أو أي شهر تحدده) بناءً على آخر `monthsBack` شهر.
 */
export async function getForecast(now = new Date(), monthsBack = 8): Promise<ForecastResult> {
  const historyStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  const [rows, cats] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.occurredAt, historyStart), lt(transactions.occurredAt, nextMonthEnd))),
    db.select().from(categories),
  ]);

  const spendRows = rows.filter(isSpend);

  // تجميع شهري
  const buckets = new Map<string, { spent: number; count: number; year: number; month: number }>();
  for (let i = monthsBack; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d.getFullYear(), d.getMonth()), {
      spent: 0,
      count: 0,
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  for (const tx of spendRows) {
    const key = monthKey(tx.occurredAt.getFullYear(), tx.occurredAt.getMonth());
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.spent = round2(bucket.spent + tx.amount);
    bucket.count += 1;
  }

  const history: MonthPoint[] = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    label: monthLabel(bucket.year, bucket.month),
    year: bucket.year,
    month: bucket.month,
    spent: bucket.spent,
    count: bucket.count,
  }));

  // الشهر الجاري عادةً ناقص — بنستثنيه من حساب المتوسط لو لسه ما خلصش
  const currentMonthKey = monthKey(now.getFullYear(), now.getMonth());
  const isCurrentMonthOver = now >= new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);
  const complete = history.filter((h) => h.spent > 0 && (h.key !== currentMonthKey || isCurrentMonthOver));

  const last3 = complete.slice(-3).map((h) => h.spent);
  const last6 = complete.slice(-6).map((h) => h.spent);

  const base = average(last3.length ? last3 : last6);
  const trend = slope(last6.length >= 3 ? last6 : last3);
  const trendPct = base > 0 ? Math.round((trend / base) * 100) : null;

  // الموسمية: نفس الشهر السنة اللي فاتت مقابل متوسط السنة
  const nextYear = nextMonthStart.getFullYear();
  const nextMonthIndex = nextMonthStart.getMonth();
  const sameMonthLastYear = history.find(
    (h) => h.month === nextMonthIndex && h.year === nextYear - 1 && h.spent > 0,
  );
  const yearAverage = average(history.filter((h) => h.year === nextYear - 1 && h.spent > 0).map((h) => h.spent));
  const seasonalityFactor =
    sameMonthLastYear && yearAverage > 0 ? sameMonthLastYear.spent / yearAverage : null;
  const seasonalityPct = seasonalityFactor !== null ? Math.round((seasonalityFactor - 1) * 100) : null;

  // التوقع = المتوسط + ميل الشهر الجاي، معدّل بالموسمية (بنصف تأثيرها عشان ميبالغش)
  let projected = base + trend;
  if (seasonalityFactor !== null) {
    const damped = 1 + (seasonalityFactor - 1) / 2;
    projected = projected * damped;
  }
  projected = Math.max(0, round2(projected));

  const spread = stdev(last3.length >= 2 ? last3 : last6);
  const low = Math.max(0, round2(projected - spread));
  const high = round2(projected + spread);

  // درجة الثقة: عدد الشهور + انتظام الصرف (معامل التغير)
  const cv = base > 0 ? spread / base : 1;
  const monthsFactor = Math.min(1, complete.length / 4);
  const regularity = Math.max(0, 1 - cv);
  const confidence = round2(Math.min(0.95, monthsFactor * 0.5 + regularity * 0.5));

  // توقع الفئات: نصيب كل فئة في آخر شهر × معامل التوقع العام
  const lastMonthKey = complete.length ? complete[complete.length - 1].key : currentMonthKey;
  const lastMonthTotal = history.find((h) => h.key === lastMonthKey)?.spent ?? 0;
  const categoryFactor = lastMonthTotal > 0 ? projected / lastMonthTotal : 1;

  const byCatLast = new Map<string, number>();
  for (const tx of spendRows) {
    if (monthKey(tx.occurredAt.getFullYear(), tx.occurredAt.getMonth()) !== lastMonthKey) continue;
    if (!tx.categoryId) continue;
    byCatLast.set(tx.categoryId, round2((byCatLast.get(tx.categoryId) ?? 0) + tx.amount));
  }

  const catById = new Map(cats.map((c) => [c.id, c]));
  const byCategory = [...byCatLast.entries()]
    .map(([id, last]) => {
      const category = catById.get(id);
      return {
        id,
        name: category?.name ?? "بدون فئة",
        emoji: category?.emoji ?? "🏷️",
        last,
        projected: round2(last * categoryFactor),
      };
    })
    .sort((a, b) => b.projected - a.projected)
    .slice(0, 5);

  const basisParts = [`متوسط آخر ${last3.length || last6.length} شهور`];
  if (trend) basisParts.push(trend > 0 ? "اتجاه صاعد" : trend < 0 ? "اتجاه هابط" : "اتجاه ثابت");
  if (seasonalityPct !== null) basisParts.push(`موسمية ${seasonalityPct > 0 ? "+" : ""}${seasonalityPct}%`);

  return {
    history,
    next: {
      key: monthKey(nextMonthStart.getFullYear(), nextMonthStart.getMonth()),
      label: monthLabel(nextMonthStart.getFullYear(), nextMonthStart.getMonth()),
      projected,
      low,
      high,
      basis: basisParts.join(" + "),
    },
    trendPct,
    seasonalityPct,
    byCategory,
    confidence,
    currency: "EGP",
  };
}
