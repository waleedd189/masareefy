import { and, asc, desc, eq, gte, like, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, categories, messages, transactions, type Card, type Category, type Message, type Transaction } from "@/db/schema";

export interface TransactionWithRelations extends Transaction {
  card: Card | null;
  category: Category | null;
}

export interface TransactionFilters {
  cardId?: string;
  categoryId?: string;
  type?: string;
  direction?: "IN" | "OUT";
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export async function listTransactions(filters: TransactionFilters = {}): Promise<TransactionWithRelations[]> {
  const conditions: SQL[] = [];
  if (filters.cardId) conditions.push(eq(transactions.cardId, filters.cardId));
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.direction) conditions.push(eq(transactions.direction, filters.direction));
  if (filters.from) conditions.push(gte(transactions.occurredAt, filters.from));
  if (filters.to) conditions.push(lt(transactions.occurredAt, filters.to));
  if (filters.search) {
    const needle = `%${filters.search}%`;
    const searchCondition = or(
      like(transactions.merchant, needle),
      like(transactions.description, needle),
      like(transactions.note, needle),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({ tx: transactions, card: cards, category: categories })
    .from(transactions)
    .leftJoin(cards, eq(transactions.cardId, cards.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);

  return rows.map((row) => ({ ...row.tx, card: row.card, category: row.category }));
}

export async function listCards(includeArchived = false): Promise<Card[]> {
  const rows = await db
    .select()
    .from(cards)
    .where(includeArchived ? undefined : eq(cards.isArchived, false))
    .orderBy(asc(cards.createdAt));
  return rows;
}

export async function getCard(id: string): Promise<Card | null> {
  const [card] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return card ?? null;
}

export async function listCategories(): Promise<Category[]> {
  return db.select().from(categories).orderBy(asc(categories.name));
}

export interface MessageWithRelations extends Message {
  card: Card | null;
  transaction: Transaction | null;
}

export async function listMessages(filters: { status?: string; limit?: number } = {}): Promise<MessageWithRelations[]> {
  const rows = await db
    .select({ message: messages, card: cards, tx: transactions })
    .from(messages)
    .leftJoin(cards, eq(messages.cardId, cards.id))
    .leftJoin(transactions, eq(transactions.messageId, messages.id))
    .where(filters.status ? eq(messages.status, filters.status) : undefined)
    .orderBy(desc(messages.receivedAt))
    .limit(filters.limit ?? 60);

  return rows.map((row) => ({ ...row.message, card: row.card, transaction: row.tx }));
}

export async function getMessage(id: string): Promise<MessageWithRelations | null> {
  const [row] = await db
    .select({ message: messages, card: cards, tx: transactions })
    .from(messages)
    .leftJoin(cards, eq(messages.cardId, cards.id))
    .leftJoin(transactions, eq(transactions.messageId, messages.id))
    .where(eq(messages.id, id))
    .limit(1);
  return row ? { ...row.message, card: row.card, transaction: row.tx } : null;
}

export async function countMessagesByStatus(): Promise<Record<string, number>> {
  const rows = await db.select({ status: messages.status }).from(messages);
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
}
