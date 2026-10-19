import { and, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { round2 } from "@/lib/format";
import { monthRange } from "./stats";
import { isSpend } from "./stats";
import type { BudgetSummary } from "./budgets";
import type { Reminder } from "./reminders";

/**
 * الإشارات الذكية — مقابل `assets/SVG/home_signals/*` في Mezanetak:
 * pace-over / pace-under / unusual / drift / quiet / repeat / dues / allowance / pulse.
 * كلها قواعد إحصائية محلية على بيانات موجودة (بدون أي خدمة خارجية).
 */

export type SignalId =
  | "pace-over"
  | "pace-under"
  | "unusual"
  | "drift"
  | "quiet"
  | "repeat"
  | "dues"
  | "allowance"
  | "pulse"
  | "cards";

export interface Signal {
  id: SignalId;
  icon: string;
  title: string;
  detail: string;
  tone: "good" | "warn" | "bad" | "info";
  href?: string;
}

export async function getSignals(
  budget: BudgetSummary | null,
  reminders: Reminder[],
  now = new Date(),
): Promise<Signal[]> {
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [rows, prevRows, cats] = await Promise.all([
    db.select().from(transactions).where(and(gte(transactions.occurredAt, prevStart), lt(transactions.occurredAt, monthEnd))),
    db.select().from(transactions).where(and(gte(transactions.occurredAt, prevStart), lt(transactions.occurredAt, monthStart))),
    db.select().from(categories),
  ]);

  const monthTx = rows.filter((t) => t.occurredAt >= monthStart && t.occurredAt < monthEnd && isSpend(t));
  const prevSpend = prevRows.filter(isSpend);
  const signals: Signal[] = [];

  // 1) وتيرة الصرف مقابل الشهر الماضي
  const daysPassed = budget?.daysPassed ?? now.getDate();
  const totalSpend = round2(monthTx.reduce((s, t) => s + t.amount, 0));
  const prevTotal = round2(prevSpend.reduce((s, t) => s + t.amount, 0));
  const pace = daysPassed > 0 ? totalSpend / daysPassed : 0;
  const prevPace = prevSpend.length ? prevTotal / new Date(prevStart.getFullYear(), prevStart.getMonth() + 1, 0).getDate() : 0;

  if (prevPace > 0 && pace > prevPace * 1.2) {
    signals.push({
      id: "pace-over",
      icon: "📈",
      title: "وتيرة صرفك أعلى من المعتاد",
      detail: `بتصرف ≈${Math.round(pace).toLocaleString("ar-EG")} في اليوم مقابل ≈${Math.round(prevPace).toLocaleString("ar-EG")} الشهر الماضي (+${Math.round(((pace - prevPace) / prevPace) * 100)}%)`,
      tone: "warn",
      href: "/transactions",
    });
  } else if (prevPace > 0 && pace < prevPace * 0.8) {
    signals.push({
      id: "pace-under",
      icon: "📉",
      title: "وتيرة صرفك أقل من المعتاد",
      detail: `≈${Math.round(pace).toLocaleString("ar-EG")} في اليوم مقابل ≈${Math.round(prevPace).toLocaleString("ar-EG")} الشهر الماضي — كمل كده 💪`,
      tone: "good",
      href: "/transactions",
    });
  }

  // 2) مصروف غير معتاد (أكبر من 3× متوسط العمليات أو تاجر جديد بمبلغ كبير)
  if (monthTx.length >= 4) {
    const amounts = monthTx.map((t) => t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)] || 0;
    const outlier = monthTx
      .filter((t) => median > 0 && t.amount > median * 4)
      .sort((a, b) => b.amount - a.amount)[0];
    if (outlier) {
      signals.push({
        id: "unusual",
        icon: "🚨",
        title: "عملية أكبر من المعتاد",
        detail: `${outlier.merchant ?? "بدون تاجر"} — ${Math.round(outlier.amount).toLocaleString("ar-EG")} (الوسيط ${Math.round(median).toLocaleString("ar-EG")})`,
        tone: "bad",
        href: "/transactions",
      });
    }
  }

  // 3) انحراف توزيع الفئات (فئة زاد نصيبها ≥ 15 نقطة مئوية)
  const catName = new Map(cats.map((c) => [c.id, `${c.emoji} ${c.name}`]));
  const shareOf = (list: typeof monthTx) => {
    const total = list.reduce((s, t) => s + t.amount, 0) || 1;
    const map = new Map<string | null, number>();
    for (const tx of list) map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
    return new Map([...map.entries()].map(([k, v]) => [k, (v / total) * 100]));
  };
  if (prevSpend.length >= 3 && monthTx.length >= 3) {
    const nowShare = shareOf(monthTx);
    const prevShare = shareOf(prevSpend);
    let worst: { name: string; delta: number } | null = null;
    for (const [id, pct] of nowShare) {
      const delta = pct - (prevShare.get(id) ?? 0);
      if (delta >= 15 && (!worst || delta > worst.delta)) {
        worst = { name: catName.get(id ?? "") ?? "غير مصنّف", delta: Math.round(delta) };
      }
    }
    if (worst) {
      signals.push({
        id: "drift",
        icon: "🧭",
        title: `نصيب ${worst.name} زاد`,
        detail: `+${worst.delta} نقطة مئوية عن الشهر الماضي`,
        tone: "warn",
        href: "/reports",
      });
    }
  }

  // 4) هدوء: مفيش عمليات من فترة
  if (rows.length) {
    const lastAt = rows.reduce((max, t) => (t.occurredAt > max ? t.occurredAt : max), rows[0].occurredAt);
    const quietDays = Math.floor((now.getTime() - lastAt.getTime()) / 86_400_000);
    if (quietDays >= 7) {
      signals.push({
        id: "quiet",
        icon: "🌙",
        title: `مفيش عمليات مسجلة من ${quietDays} يوم`,
        detail: "لو فيه رسائل بنك متأخرة، الصقها في صفحة رسائل البنك",
        tone: "info",
        href: "/messages",
      });
    }
  }

  // 5) تكرار: نفس التاجر 3 مرات أو أكتر الشهر ده
  const merchantCount = new Map<string, { count: number; total: number }>();
  for (const tx of monthTx) {
    const name = (tx.merchant ?? "").trim();
    if (name.length < 2) continue;
    const entry = merchantCount.get(name) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += tx.amount;
    merchantCount.set(name, entry);
  }
  const repeated = [...merchantCount.entries()].filter(([, v]) => v.count >= 3).sort((a, b) => b[1].count - a[1].count)[0];
  if (repeated) {
    signals.push({
      id: "repeat",
      icon: "🔁",
      title: `${repeated[0]} اتكرر ${repeated[1].count} مرات`,
      detail: `إجمالي ${Math.round(repeated[1].total).toLocaleString("ar-EG")} الشهر ده — ينفع يتحوّل لمصروف متكرر`,
      tone: "info",
      href: "/commitments",
    });
  }

  // 6) مستحقات قريبة
  const urgent = reminders.filter((r) => r.daysLeft <= 3);
  if (urgent.length) {
    signals.push({
      id: "dues",
      icon: "⏰",
      title: `${urgent.length} مستحق${urgent.length > 1 ? "ات" : ""} خلال 3 أيام`,
      detail: urgent
        .slice(0, 2)
        .map((r) => r.title)
        .join(" · "),
      tone: "warn",
      href: "/commitments",
    });
  }

  // 7) الميزانية: تجاوز أو اقتراب أو متوسط يومي
  if (budget?.effectiveBudget) {
    if (budget.overBudget) {
      signals.push({
        id: "allowance",
        icon: "⛔",
        title: "عدّيت الميزانية",
        detail: `صرفت ${Math.round(budget.spent).toLocaleString("ar-EG")} من ${Math.round(budget.effectiveBudget).toLocaleString("ar-EG")} (+${budget.pct - 100}%)`,
        tone: "bad",
        href: "/reports",
      });
    } else if (budget.pct >= 80) {
      signals.push({
        id: "allowance",
        icon: "⚠️",
        title: `فاضل ${Math.round(budget.remaining).toLocaleString("ar-EG")} في الميزانية`,
        detail: budget.dailyAllowance !== null
          ? `استخدمت ${budget.pct}% — يسمح لك ≈${Math.round(budget.dailyAllowance).toLocaleString("ar-EG")} يوميًا لآخر ${budget.daysLeft} يوم`
          : `استخدمت ${budget.pct}% من الميزانية`,
        tone: "warn",
        href: "/reports",
      });
    } else if (budget.dailyAllowance !== null) {
      signals.push({
        id: "allowance",
        icon: "🎯",
        title: "ماشي حسب الميزانية",
        detail: `مسموح لك ≈${Math.round(budget.dailyAllowance).toLocaleString("ar-EG")} يوميًا لآخر ${budget.daysLeft} يوم`,
        tone: "good",
        href: "/reports",
      });
    }
  }

  // 8) نبضة: عدد العمليات ومتوسطها
  if (monthTx.length) {
    const avg = Math.round(totalSpend / monthTx.length);
    signals.push({
      id: "pulse",
      icon: "💓",
      title: `${monthTx.length} عملية الشهر ده`,
      detail: `متوسط العملية ${avg.toLocaleString("ar-EG")} — إجمالي ${Math.round(totalSpend).toLocaleString("ar-EG")}`,
      tone: "info",
      href: "/transactions",
    });
  }

  return signals;
}
