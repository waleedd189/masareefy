import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, debts, recurringRules } from "@/db/schema";
import { round2 } from "@/lib/format";

/**
 * التنبيهات: مواعيد كشف الحساب والسداد (cards.statementDay / dueDay) +
 * المتكررات والاشتراكات + الديون المستحقة.
 * مقابل `flutter_local_notifications` + `flutter_timezone` + WorkManager في Mezanetak.
 */

export type ReminderKind = "CARD_STATEMENT" | "CARD_DUE" | "RECURRING" | "DEBT" | "GOAL";

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  subtitle?: string;
  date: Date;
  daysLeft: number;
  amount: number | null;
  currency: string;
  tone: "good" | "warn" | "danger" | "info";
  href: string;
}

export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  CARD_STATEMENT: "كشف حساب",
  CARD_DUE: "سداد بطاقة",
  RECURRING: "مصروف متكرر",
  DEBT: "دين مستحق",
  GOAL: "هدف ادخار",
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** تاريخ يوم معيّن في الشهر الحالي (أو الجاي لو فات) */
function nextDayOfMonth(day: number, from = new Date()): Date {
  const safeDay = Math.min(Math.max(1, Math.round(day)), 28);
  const thisMonth = new Date(from.getFullYear(), from.getMonth(), safeDay);
  if (daysBetween(from, thisMonth) >= 0) return thisMonth;
  return new Date(from.getFullYear(), from.getMonth() + 1, safeDay);
}

export function nextOccurrence(rule: {
  interval: string;
  dayOfMonth?: number | null;
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
}): Date {
  const now = new Date();
  if (rule.nextRunAt && rule.nextRunAt >= startOfDay(now)) return rule.nextRunAt;
  const base = rule.lastRunAt ?? now;
  if (rule.interval === "DAILY") return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  if (rule.interval === "WEEKLY") return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
  if (rule.interval === "YEARLY") return new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
  if (rule.dayOfMonth) return nextDayOfMonth(rule.dayOfMonth, now);
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export async function getReminders(horizonDays = 21, now = new Date()): Promise<Reminder[]> {
  const [cardRows, ruleRows, debtRows] = await Promise.all([
    db.select().from(cards).where(eq(cards.isArchived, false)),
    db.select().from(recurringRules).where(eq(recurringRules.isActive, true)),
    db.select().from(debts).where(and(eq(debts.isSettled, false), eq(debts.direction, "OWED_BY_ME"))),
  ]);

  const out: Reminder[] = [];

  for (const card of cardRows) {
    if (card.statementDay) {
      const date = nextDayOfMonth(card.statementDay, now);
      out.push({
        id: `stmt-${card.id}`,
        kind: "CARD_STATEMENT",
        title: `كشف حساب ${card.name}`,
        subtitle: `يطلع يوم ${card.statementDay} من كل شهر`,
        date,
        daysLeft: daysBetween(now, date),
        amount: null,
        currency: card.currency,
        tone: "info",
        href: `/cards/${card.id}`,
      });
    }
    if (card.dueDay) {
      const date = nextDayOfMonth(card.dueDay, now);
      const daysLeft = daysBetween(now, date);
      const amount = card.type === "CREDIT" ? round2(card.currentBalance) : null;
      out.push({
        id: `due-${card.id}`,
        kind: "CARD_DUE",
        title: `سداد ${card.name}`,
        subtitle: amount ? `المستحق حاليًا ${amount.toLocaleString("ar-EG")} ${card.currency}` : `يوم ${card.dueDay} من كل شهر`,
        date,
        daysLeft,
        amount,
        currency: card.currency,
        tone: daysLeft <= 2 ? "danger" : daysLeft <= 5 ? "warn" : "good",
        href: `/cards/${card.id}`,
      });
    }
  }

  for (const rule of ruleRows) {
    const date = nextOccurrence(rule);
    const daysLeft = daysBetween(now, date);
    out.push({
      id: `rec-${rule.id}`,
      kind: "RECURRING",
      title: rule.title,
      subtitle: `${rule.direction === "IN" ? "دخل" : "مصروف"} متكرر · ${intervalLabel(rule.interval)}`,
      date,
      daysLeft,
      amount: round2(rule.amount),
      currency: "EGP",
      tone: daysLeft <= 1 ? "warn" : "info",
      href: "/commitments",
    });
  }

  for (const debt of debtRows) {
    if (!debt.dueDate) continue;
    const daysLeft = daysBetween(now, debt.dueDate);
    if (daysLeft > horizonDays) continue;
    const remaining = round2(debt.amount - debt.paidAmount);
    out.push({
      id: `debt-${debt.id}`,
      kind: "DEBT",
      title: `قسط/دين لـ ${debt.person}`,
      subtitle: `المتبقي ${remaining.toLocaleString("ar-EG")} ${debt.currency}`,
      date: debt.dueDate,
      daysLeft,
      amount: remaining,
      currency: debt.currency,
      tone: daysLeft < 0 ? "danger" : daysLeft <= 3 ? "warn" : "info",
      href: "/commitments",
    });
  }

  return out
    .filter((r) => r.daysLeft <= horizonDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function intervalLabel(interval: string): string {
  switch (interval) {
    case "DAILY":
      return "يومي";
    case "WEEKLY":
      return "أسبوعي";
    case "YEARLY":
      return "سنوي";
    default:
      return "شهري";
  }
}

export function dueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `متأخر ${Math.abs(daysLeft)} يوم`;
  if (daysLeft === 0) return "النهارده";
  if (daysLeft === 1) return "بكرة";
  if (daysLeft === 2) return "بعد يومين";
  return `بعد ${daysLeft} يوم`;
}
