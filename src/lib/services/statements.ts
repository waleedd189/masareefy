import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, messages, statements, transactions } from "@/db/schema";
import { recomputeCard } from "./balances";
import type { StatementRow } from "@/lib/import/statement";

/**
 * أرشيف كشوف الحساب والفواتير المستوردة.
 *
 * كل استيراد (PDF/CSV/نص) بيسجّل «كشف» فيه الفترة والإجماليات وعدد الصفوف،
 * وكل عملية مستوردة بتحمل `statementId` — فالأرشيف يقدر يعرض الكشف بعملياته،
 * وحذفه يحذفها مع بعض ويرجّع الأرصدة لحالتها الصحيحة.
 */

export interface StatementArchive {
  id: string;
  label: string;
  cardId: string | null;
  cardName: string | null;
  source: string;
  periodFrom: Date | null;
  periodTo: Date | null;
  rowsCount: number;
  skippedCount: number;
  totalIn: number;
  totalOut: number;
  currency: string;
  fileHash: string | null;
  notes: string | null;
  importedAt: Date;
}

export interface StatementDetail extends StatementArchive {
  transactions: {
    id: string;
    occurredAt: Date;
    amount: number;
    currency: string;
    merchant: string | null;
    description: string | null;
    type: string;
    direction: string;
  }[];
}

export const STATEMENT_SOURCE_LABELS: Record<string, string> = {
  PDF: "📄 PDF",
  CSV: "📊 CSV",
  TEXT: "📝 نص",
};

export interface CreateArchiveInput {
  label: string;
  cardId?: string | null;
  source?: "PDF" | "CSV" | "TEXT";
  rows: Pick<StatementRow, "date" | "amount" | "direction" | "currency">[];
  skipped?: number;
  fileHash?: string | null;
  notes?: string | null;
}

/** فترة الكشف = أول وآخر تاريخ في الصفوف */
function periodOf(rows: CreateArchiveInput["rows"]): { from: Date | null; to: Date | null } {
  const dates = rows.map((r) => r.date).filter((d): d is Date => d instanceof Date);
  if (!dates.length) return { from: null, to: null };
  const times = dates.map((d) => d.getTime());
  return { from: new Date(Math.min(...times)), to: new Date(Math.max(...times)) };
}

/** تسجيل كشف جديد في الأرشيف */
export async function createStatementArchive(input: CreateArchiveInput): Promise<StatementArchive | null> {
  if (!input.rows.length) return null;

  const totalIn = input.rows.filter((r) => r.direction === "IN").reduce((sum, r) => sum + r.amount, 0);
  const totalOut = input.rows.filter((r) => r.direction !== "IN").reduce((sum, r) => sum + r.amount, 0);
  const { from, to } = periodOf(input.rows);
  const currencies = [...new Set(input.rows.map((r) => r.currency).filter(Boolean))];

  const [record] = await db
    .insert(statements)
    .values({
      label: input.label.slice(0, 140),
      cardId: input.cardId ?? null,
      source: input.source ?? "PDF",
      periodFrom: from,
      periodTo: to,
      rowsCount: input.rows.length,
      skippedCount: input.skipped ?? 0,
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      currency: currencies.length === 1 ? (currencies[0] ?? "EGP") : "EGP",
      fileHash: input.fileHash ?? null,
      notes: input.notes ?? (currencies.length > 1 ? `عملات مختلطة: ${currencies.join("، ")}` : null),
      importedAt: new Date(),
    })
    .returning();

  return record ? toArchive(record, null) : null;
}

function toArchive(row: typeof statements.$inferSelect, cardName: string | null): StatementArchive {
  return {
    id: row.id,
    label: row.label,
    cardId: row.cardId,
    cardName,
    source: row.source,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    rowsCount: row.rowsCount,
    skippedCount: row.skippedCount,
    totalIn: row.totalIn,
    totalOut: row.totalOut,
    currency: row.currency,
    fileHash: row.fileHash,
    notes: row.notes,
    importedAt: row.importedAt,
  };
}

/** كل الكشوف في الأرشيف (الأحدث الأول) */
export async function listStatements(limit = 60): Promise<StatementArchive[]> {
  const rows = await db
    .select({ statement: statements, cardName: cards.name })
    .from(statements)
    .leftJoin(cards, eq(statements.cardId, cards.id))
    .orderBy(desc(statements.importedAt))
    .limit(limit);
  return rows.map((row) => toArchive(row.statement, row.cardName));
}

/** كشف واحد مع عملياته */
export async function getStatement(id: string): Promise<StatementDetail | null> {
  const [row] = await db
    .select({ statement: statements, cardName: cards.name })
    .from(statements)
    .leftJoin(cards, eq(statements.cardId, cards.id))
    .where(eq(statements.id, id))
    .limit(1);
  if (!row) return null;

  const txs = await db
    .select({
      id: transactions.id,
      occurredAt: transactions.occurredAt,
      amount: transactions.amount,
      currency: transactions.currency,
      merchant: transactions.merchant,
      description: transactions.description,
      type: transactions.type,
      direction: transactions.direction,
    })
    .from(transactions)
    .where(eq(transactions.statementId, id))
    .orderBy(desc(transactions.occurredAt));

  return { ...toArchive(row.statement, row.cardName), transactions: txs };
}

/** هل الكشف ده اتستورد قبل كده؟ (بصمة الملف) */
export async function findStatementByHash(fileHash: string): Promise<StatementArchive | null> {
  if (!fileHash) return null;
  const [row] = await db.select().from(statements).where(eq(statements.fileHash, fileHash)).limit(1);
  return row ? toArchive(row, null) : null;
}

/**
 * حذف كشف من الأرشيف: بيحذف عملياته المرتبطة + بصماتها من سجل الرسائل
 * (عشان إعادة الاستيراد تنفع)، وبعدين يعيد حساب أرصدة الحسابات المتأثرة.
 */
export async function deleteStatement(id: string): Promise<{ deleted: number }> {
  const txs = await db
    .select({ id: transactions.id, cardId: transactions.cardId, messageId: transactions.messageId })
    .from(transactions)
    .where(eq(transactions.statementId, id));

  const touched = new Set<string>();
  const messageIds = txs.map((t) => t.messageId).filter((v): v is string => Boolean(v));
  for (const tx of txs) if (tx.cardId) touched.add(tx.cardId);

  if (txs.length) await db.delete(transactions).where(eq(transactions.statementId, id));
  if (messageIds.length) {
    for (const messageId of messageIds) await db.delete(messages).where(eq(messages.id, messageId));
  }
  await db.delete(statements).where(eq(statements.id, id));

  for (const cardId of touched) await recomputeCard(cardId);

  return { deleted: txs.length };
}

/** أرقام الأرشيف للعرض (عدد الكشوف/الصفوف/الإجماليات + آخر استيراد) */
export async function getArchiveStats(): Promise<{
  count: number;
  rows: number;
  totalIn: number;
  totalOut: number;
  lastImport: Date | null;
  bySource: { source: string; count: number }[];
}> {
  const all = await db.select().from(statements);
  const bySource = new Map<string, number>();
  for (const row of all) bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);

  return {
    count: all.length,
    rows: all.reduce((sum, r) => sum + r.rowsCount, 0),
    totalIn: Math.round(all.reduce((sum, r) => sum + r.totalIn, 0) * 100) / 100,
    totalOut: Math.round(all.reduce((sum, r) => sum + r.totalOut, 0) * 100) / 100,
    lastImport: all.length ? all.reduce((a, b) => (a.importedAt > b.importedAt ? a : b)).importedAt : null,
    bySource: [...bySource.entries()].map(([source, count]) => ({ source, count })),
  };
}

/** كشف متكرر؟ (نفس الحساب + نفس الفترة + نفس عدد الصفوف) */
export async function findDuplicateArchive(input: {
  cardId: string | null;
  periodFrom: Date | null;
  periodTo: Date | null;
  rowsCount: number;
}): Promise<StatementArchive | null> {
  if (!input.periodFrom || !input.periodTo) return null;
  const rows = await db
    .select()
    .from(statements)
    .where(
      and(
        eq(statements.rowsCount, input.rowsCount),
        input.cardId ? eq(statements.cardId, input.cardId) : undefined,
      ),
    )
    .limit(50);

  const hit = rows.find(
    (r) =>
      r.periodFrom?.getTime() === input.periodFrom?.getTime() &&
      r.periodTo?.getTime() === input.periodTo?.getTime(),
  );
  return hit ? toArchive(hit, null) : null;
}
