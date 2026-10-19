import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { goals, transactions, type Goal } from "@/db/schema";
import { round2 } from "@/lib/format";

/** أهداف الادخار — مقابل `widget_goal` وشاشة Goals في Mezanetak (تقدّم + متبقي + %). */

export interface GoalProgress extends Goal {
  pct: number;
  remaining: number;
  /** المبلغ المطلوب شهريًا لو فيه تاريخ مستهدف */
  monthlyNeeded: number | null;
  daysLeft: number | null;
  milestones: { pct: number; reached: boolean }[];
}

export async function listGoals(includeArchived = false): Promise<Goal[]> {
  return db
    .select()
    .from(goals)
    .where(includeArchived ? undefined : eq(goals.isArchived, false))
    .orderBy(asc(goals.createdAt));
}

export async function getGoalsWithProgress(): Promise<GoalProgress[]> {
  const rows = await listGoals();
  return rows.map(withProgress);
}

export function withProgress(goal: Goal): GoalProgress {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  const remaining = round2(Math.max(0, goal.targetAmount - goal.savedAmount));
  const daysLeft = goal.dueDate ? Math.ceil((goal.dueDate.getTime() - Date.now()) / 86_400_000) : null;
  const monthsLeft = daysLeft !== null && daysLeft > 0 ? Math.max(1, Math.round(daysLeft / 30)) : null;
  return {
    ...goal,
    pct,
    remaining,
    daysLeft,
    monthlyNeeded: monthsLeft ? round2(remaining / monthsLeft) : null,
    milestones: [25, 50, 75, 100].map((m) => ({ pct: m, reached: pct >= m })),
  };
}

/** العمليات المرتبطة بهدف (لو المستخدم بيسجّل الادخار كعملية) */
export async function goalContributions(goalId: string): Promise<number> {
  const rows = await db
    .select({ amount: transactions.amount })
    .from(transactions)
    .where(eq(transactions.goalId, goalId));
  return round2(rows.reduce((sum, row) => sum + row.amount, 0));
}

export async function getTopGoal(): Promise<GoalProgress | null> {
  const all = await getGoalsWithProgress();
  if (!all.length) return null;
  return all.slice().sort((a, b) => b.pct - a.pct)[0];
}
