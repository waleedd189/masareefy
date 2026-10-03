import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, transactions, type Card, type Transaction } from "@/db/schema";
import { round2 } from "@/lib/format";

/** تطبيق أثر عملية على الرصيد (المستحق للبطاقات الائتمانية، الرصيد النقدي لغيرها) */
function applyTx(balance: number, tx: Pick<Transaction, "direction" | "amount">, isCredit: boolean): number {
  const delta = tx.direction === "OUT" ? tx.amount : -tx.amount;
  return isCredit ? balance + delta : balance - delta;
}

export interface CardBalance {
  /** بطاقة ائتمان = المستحق عليك | غيرها = الرصيد المتاح */
  currentBalance: number;
  availableAmount: number | null;
  balanceSyncedAt: Date | null;
}

export function computeBalance(card: Card, txs: Transaction[]): CardBalance {
  const isCredit = card.type === "CREDIT";
  const ordered = [...txs].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  let anchorIndex = -1;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].availableAfter !== null && ordered[i].availableAfter !== undefined) {
      anchorIndex = i;
      break;
    }
  }

  let balance: number;
  let syncedAt: Date | null = null;

  if (anchorIndex >= 0) {
    const anchor = ordered[anchorIndex];
    const available = anchor.availableAfter as number;
    syncedAt = anchor.occurredAt;
    balance = isCredit && card.creditLimit ? card.creditLimit - available : available;
    for (let i = anchorIndex + 1; i < ordered.length; i++) balance = applyTx(balance, ordered[i], isCredit);
  } else {
    balance = card.openingBalance;
    for (const tx of ordered) balance = applyTx(balance, tx, isCredit);
  }

  const available = isCredit ? (card.creditLimit ? round2(card.creditLimit - balance) : null) : round2(balance);
  return { currentBalance: round2(balance), availableAmount: available, balanceSyncedAt: syncedAt };
}

/** إعادة حساب رصيد بطاقة وتخزينه */
export async function recomputeCard(cardId: string): Promise<CardBalance | null> {
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return null;
  const txs = await db.select().from(transactions).where(eq(transactions.cardId, cardId)).orderBy(asc(transactions.occurredAt));
  const result = computeBalance(card, txs);
  await db
    .update(cards)
    .set({
      currentBalance: result.currentBalance,
      availableAmount: result.availableAmount,
      balanceSyncedAt: result.balanceSyncedAt,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, cardId));
  return result;
}

export async function recomputeAllCards(): Promise<void> {
  const rows = await db.select({ id: cards.id }).from(cards);
  for (const row of rows) await recomputeCard(row.id);
}

/** نسبة استخدام الحد الائتماني */
export function utilization(card: Pick<Card, "type" | "creditLimit" | "currentBalance">): number | null {
  if (card.type !== "CREDIT" || !card.creditLimit) return null;
  return Math.min(100, Math.max(0, Math.round((card.currentBalance / card.creditLimit) * 100)));
}
