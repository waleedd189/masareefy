import { and, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, transactions, type Category } from "@/db/schema";
import { round2 } from "@/lib/format";
import { getMonthlyBudgetTotal } from "@/lib/settings-store";
import { monthRange } from "./stats";
import { isSpend } from "./stats";

/**
 * الميزانيات: إجمالية (من الإعدادات) + لكل فئة (categories.monthlyBudget).
 * نفس فكرة `SmsBudgetPolicy` في Mezanetak: الميزانية بتأثر على القرار وبتظهر
 * كمؤشر استهلاك (burn-down) مع المتبقي ومتوسط اليوم.
 */

export interface CategoryBudget {
  category: Category;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
  tone: "good" | "warn" | "danger";
  txCount: number;
}

export interface BudgetSummary {
  /** الميزانية الإجمالية المحددة (null = مش محددة) */
  totalBudget: number | null;
  /** مجموع ميزانيات الفئات */
  categoriesBudget: number;
  /** المرجع المستخدم في الحساب (الإجمالية لو موجودة، وإلا مجموع الفئات) */
  effectiveBudget: number | null;
  spent: number;
  remaining: number;
  pct: number;
  tone: "good" | "warn" | "danger";
  daysInMonth: number;
  daysPassed: number;
  daysLeft: number;
  /** المتوسط اليومي المسموح باقي الشهر */
  dailyAllowance: number | null;
  /** متوسط صرفك اليومي الفعلي */
  dailyPace: number | null;
  /** لو أكملت بنفس الوتيرة: إجمالي متوقع آخر الشهر */
  projectedTotal: number;
  overBudget: boolean;
  budgets: CategoryBudget[];
  currency: string;
}

export function toneFor(pct: number): "good" | "warn" | "danger" {
  if (pct >= 100) return "danger";
  if (pct >= 80) return "warn";
  return "good";
}

export async function getBudgetSummary(month = new Date()): Promise<BudgetSummary> {
  const { start, end } = monthRange(month);
  const [rows, cats, totalBudget] = await Promise.all([
    db.select().from(transactions).where(and(gte(transactions.occurredAt, start), lt(transactions.occurredAt, end))),
    db.select().from(categories),
    getMonthlyBudgetTotal(),
  ]);

  const spend = rows.filter(isSpend);
  const spent = round2(spend.reduce((sum, t) => sum + t.amount, 0));

  const byCategory = new Map<string, number>();
  for (const tx of spend) {
    if (!tx.categoryId) continue;
    byCategory.set(tx.categoryId, round2((byCategory.get(tx.categoryId) ?? 0) + tx.amount));
  }

  const budgets: CategoryBudget[] = cats
    .filter((c) => c.monthlyBudget && c.monthlyBudget > 0)
    .map((category) => {
      const budget = round2(category.monthlyBudget as number);
      const catSpent = round2(byCategory.get(category.id) ?? 0);
      const pct = budget > 0 ? Math.round((catSpent / budget) * 100) : 0;
      return {
        category,
        budget,
        spent: catSpent,
        remaining: round2(budget - catSpent),
        pct,
        tone: toneFor(pct),
        txCount: spend.filter((t) => t.categoryId === category.id).length,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  const categoriesBudget = round2(budgets.reduce((s, b) => s + b.budget, 0));
  const effectiveBudget = totalBudget ?? (categoriesBudget > 0 ? categoriesBudget : null);

  const now = new Date();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const inSameMonth = now.getFullYear() === month.getFullYear() && now.getMonth() === month.getMonth();
  const daysPassed = inSameMonth ? now.getDate() : daysInMonth;
  const daysLeft = Math.max(0, daysInMonth - daysPassed);

  const pct = effectiveBudget ? Math.round((spent / effectiveBudget) * 100) : 0;
  const dailyPace = daysPassed > 0 ? round2(spent / daysPassed) : null;
  const remaining = effectiveBudget ? round2(effectiveBudget - spent) : 0;
  const dailyAllowance =
    effectiveBudget && daysLeft > 0 ? round2(Math.max(0, remaining) / daysLeft) : null;

  return {
    totalBudget,
    categoriesBudget,
    effectiveBudget,
    spent,
    remaining,
    pct,
    tone: effectiveBudget ? toneFor(pct) : "good",
    daysInMonth,
    daysPassed,
    daysLeft,
    dailyAllowance,
    dailyPace,
    projectedTotal: dailyPace ? round2(dailyPace * daysInMonth) : spent,
    overBudget: Boolean(effectiveBudget && spent > effectiveBudget),
    budgets,
    currency: rows[0]?.currency ?? "EGP",
  };
}
