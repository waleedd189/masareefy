import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, categories, messages, transactions, type Transaction } from "@/db/schema";
import { round2 } from "@/lib/format";

export function monthRange(date = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

/** العمليات اللي بتتحسب كمصروف فعلي (سداد البطاقة مش مصروف) */
export const SPEND_TYPES = ["PURCHASE", "WITHDRAWAL", "FEE", "TRANSFER_OUT"];
export const INCOME_TYPES = ["DEPOSIT", "REFUND", "TRANSFER_IN"];

export const isSpend = (t: Pick<Transaction, "type" | "direction">) => SPEND_TYPES.includes(t.type) && t.direction === "OUT";
export const isIncome = (t: Pick<Transaction, "type" | "direction">) => INCOME_TYPES.includes(t.type) && t.direction === "IN";

const sumSpend = (list: Transaction[]) => round2(list.filter(isSpend).reduce((s, t) => s + t.amount, 0));
const sumIncome = (list: Transaction[]) => round2(list.filter(isIncome).reduce((s, t) => s + t.amount, 0));

export interface MonthPoint {
  key: string;
  label: string;
  spent: number;
  received: number;
}

export interface CategorySlice {
  id: string | null;
  name: string;
  emoji: string;
  color: string;
  total: number;
  share: number;
  count: number;
}

export interface DashboardData {
  spentThisMonth: number;
  receivedThisMonth: number;
  spentLastMonth: number;
  changePct: number | null;
  txCountThisMonth: number;
  totalOutstanding: number;
  totalAvailable: number;
  totalCashBalance: number;
  cardsCount: number;
  needsReview: number;
  months: MonthPoint[];
  categories: CategorySlice[];
  topMerchants: { name: string; total: number; count: number }[];
  currency: string;
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const historyStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [cardRows, historyTx, categoryRows, reviewRows] = await Promise.all([
    db.select().from(cards).where(eq(cards.isArchived, false)),
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.occurredAt, historyStart), lt(transactions.occurredAt, monthEnd))),
    db.select().from(categories),
    db
      .select({ id: messages.id })
      .from(messages)
      .where(inArray(messages.status, ["NEEDS_REVIEW", "UNMATCHED"])),
  ]);

  const monthTx = historyTx.filter((t) => t.occurredAt >= monthStart && t.occurredAt < monthEnd);
  const prevTx = historyTx.filter((t) => t.occurredAt >= prevStart && t.occurredAt < monthStart);

  const spentThisMonth = sumSpend(monthTx);
  const spentLastMonth = sumSpend(prevTx);

  const months: MonthPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const slice = historyTx.filter((t) => t.occurredAt >= from && t.occurredAt < to);
    months.push({
      key: `${from.getFullYear()}-${from.getMonth() + 1}`,
      label: new Intl.DateTimeFormat("ar-EG", { month: "short" }).format(from),
      spent: sumSpend(slice),
      received: sumIncome(slice),
    });
  }

  const spendTx = monthTx.filter(isSpend);
  const totalSpend = spentThisMonth || 1;

  const byCategory = new Map<string | null, { total: number; count: number }>();
  for (const tx of spendTx) {
    const entry = byCategory.get(tx.categoryId) ?? { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count += 1;
    byCategory.set(tx.categoryId, entry);
  }
  const categorySlices: CategorySlice[] = [...byCategory.entries()]
    .map(([id, value]) => {
      const category = categoryRows.find((c) => c.id === id);
      return {
        id,
        name: category?.name ?? "بدون فئة",
        emoji: category?.emoji ?? "❔",
        color: category?.color ?? "slate",
        total: round2(value.total),
        count: value.count,
        share: Math.round((value.total / totalSpend) * 100),
      };
    })
    .sort((a, b) => b.total - a.total);

  const merchantMap = new Map<string, { total: number; count: number }>();
  for (const tx of spendTx) {
    const name = (tx.merchant ?? "غير محدد").trim();
    const entry = merchantMap.get(name) ?? { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count += 1;
    merchantMap.set(name, entry);
  }

  const creditCards = cardRows.filter((c) => c.type === "CREDIT");
  const cashCards = cardRows.filter((c) => c.type !== "CREDIT");

  return {
    spentThisMonth,
    receivedThisMonth: sumIncome(monthTx),
    spentLastMonth,
    changePct: spentLastMonth > 0 ? Math.round(((spentThisMonth - spentLastMonth) / spentLastMonth) * 100) : null,
    txCountThisMonth: monthTx.length,
    totalOutstanding: round2(creditCards.reduce((s, c) => s + c.currentBalance, 0)),
    totalAvailable: round2(cardRows.reduce((s, c) => s + (c.availableAmount ?? 0), 0)),
    totalCashBalance: round2(cashCards.reduce((s, c) => s + c.currentBalance, 0)),
    cardsCount: cardRows.length,
    needsReview: reviewRows.length,
    months,
    categories: categorySlices,
    topMerchants: [...merchantMap.entries()]
      .map(([name, v]) => ({ name, total: round2(v.total), count: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    currency: cardRows[0]?.currency ?? "EGP",
  };
}

export interface CardStats {
  spentThisMonth: number;
  receivedThisMonth: number;
  txCount: number;
  lastTransactionAt: Date | null;
  months: MonthPoint[];
}

export async function getCardStats(cardId: string): Promise<CardStats> {
  const now = new Date();
  const { start, end } = monthRange(now);
  const historyStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [history, last] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.cardId, cardId), gte(transactions.occurredAt, historyStart))),
    db.select().from(transactions).where(eq(transactions.cardId, cardId)).orderBy(desc(transactions.occurredAt)).limit(1),
  ]);

  const monthTx = history.filter((t) => t.occurredAt >= start && t.occurredAt < end);
  const months: MonthPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const slice = history.filter((t) => t.occurredAt >= from && t.occurredAt < to);
    months.push({
      key: `${from.getFullYear()}-${from.getMonth() + 1}`,
      label: new Intl.DateTimeFormat("ar-EG", { month: "short" }).format(from),
      spent: sumSpend(slice),
      received: sumIncome(slice),
    });
  }

  return {
    spentThisMonth: sumSpend(monthTx),
    receivedThisMonth: sumIncome(monthTx),
    txCount: monthTx.length,
    lastTransactionAt: last[0]?.occurredAt ?? null,
    months,
  };
}
