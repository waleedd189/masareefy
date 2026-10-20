import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";

/**
 * سلسلة الالتزام (Streak) — مقابل `hub/spending-streak` وLottie `Flame - Streak` في Mezanetak.
 * بتتحسب من أيام متتالية فيها تسجيل عمليات (مش أيام صرف).
 */

export interface StreakInfo {
  current: number;
  best: number;
  lastActiveAt: Date | null;
  activeToday: boolean;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export async function getStreak(now = new Date()): Promise<StreakInfo> {
  const rows = await db
    .select({ occurredAt: transactions.occurredAt })
    .from(transactions)
    .orderBy(desc(transactions.occurredAt))
    .limit(2000);

  if (!rows.length) return { current: 0, best: 0, lastActiveAt: null, activeToday: false };

  const days = new Set(rows.map((row) => dayKey(row.occurredAt)));
  const lastActiveAt = rows[0].occurredAt;
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const activeToday = days.has(todayKey);

  // السلسلة الحالية: من النهارده (أو إمبارح لو لسه مسجلتش النهارده)
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(todayKey)) {
    if (!days.has(yesterdayKey)) return { current: 0, best: bestRun(days), lastActiveAt, activeToday };
    cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }

  return { current, best: Math.max(current, bestRun(days)), lastActiveAt, activeToday };
}

function bestRun(days: Set<string>): number {
  const sorted = [...days]
    .map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y, m - 1, d);
    })
    .sort((a, b) => a.getTime() - b.getTime());

  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const date of sorted) {
    if (previous && Math.round((date.getTime() - previous.getTime()) / 86_400_000) === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}
