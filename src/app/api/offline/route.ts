import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { cards, categories, transactions } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { recomputeCard } from "@/lib/services/balances";
import { suggestCategoryId } from "@/lib/services/categorize";
import { ingestMessage } from "@/lib/services/ingest";
import { getBank } from "@/lib/sms/banks";
import { DEFAULT_DIRECTION, type TxType } from "@/lib/sms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cardPayload = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  last4: z.string().regex(/^\d{4}$/),
  bankKey: z.string().trim().default("generic"),
  type: z.enum(["CREDIT", "DEBIT", "PREPAID"]).default("CREDIT"),
  currency: z.string().trim().min(3).max(3).default("EGP"),
  openingBalance: z.number().finite().default(0),
});

const transactionPayload = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  type: z.string().trim().default("PURCHASE"),
  direction: z.enum(["OUT", "IN"]).optional(),
  amount: z.number().positive().finite(),
  merchant: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  occurredAt: z.string().datetime(),
});

const messagePayload = z.object({
  text: z.string().trim().min(5).max(10000),
  sender: z.string().trim().max(100).optional().nullable(),
  cardId: z.string().uuid().optional().nullable(),
  receivedAt: z.string().datetime(),
});

const operationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["card", "transaction", "message"]),
  createdAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

const batchSchema = z.object({ operations: z.array(operationSchema).min(1).max(100) });

export async function GET() {
  await runMigrations();
  const [cardRows, categoryRows, recentTransactions] = await Promise.all([
    db.select().from(cards).where(eq(cards.isArchived, false)),
    db.select().from(categories),
    db.select().from(transactions).orderBy(desc(transactions.occurredAt)).limit(50),
  ]);

  return NextResponse.json(
    { ok: true, cards: cardRows, categories: categoryRows, transactions: recentTransactions },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  await runMigrations();
  const body = await request.json().catch(() => null);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "بيانات المزامنة غير صالحة" }, { status: 400 });
  }

  const rank = { card: 0, transaction: 1, message: 2 } as const;
  const operations = [...parsed.data.operations].sort((a, b) => rank[a.kind] - rank[b.kind]);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const operation of operations) {
    try {
      if (operation.kind === "card") {
        const data = cardPayload.parse(operation.payload);
        const [existing] = await db.select({ id: cards.id }).from(cards).where(eq(cards.id, data.id)).limit(1);
        if (!existing) {
          const bank = getBank(data.bankKey);
          await db.insert(cards).values({
            id: data.id,
            name: data.name,
            last4: data.last4,
            bankKey: data.bankKey,
            bankName: bank.nameAr,
            type: data.type,
            currency: data.currency,
            openingBalance: data.openingBalance,
            currentBalance: data.openingBalance,
          });
          await recomputeCard(data.id);
        }
      } else if (operation.kind === "transaction") {
        const data = transactionPayload.parse(operation.payload);
        const [existing] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, data.id)).limit(1);
        if (!existing) {
          const type = data.type as TxType;
          const categoryId = await suggestCategoryId({ merchant: data.merchant, type });
          await db.insert(transactions).values({
            id: data.id,
            cardId: data.cardId,
            type,
            direction: data.direction ?? DEFAULT_DIRECTION[type] ?? "OUT",
            amount: data.amount,
            currency: "EGP",
            merchant: data.merchant || null,
            note: data.note || null,
            categoryId,
            occurredAt: new Date(data.occurredAt),
            source: "MANUAL",
          });
          await recomputeCard(data.cardId);
        }
      } else {
        const data = messagePayload.parse(operation.payload);
        await ingestMessage({
          rawText: data.text,
          sender: data.sender,
          cardId: data.cardId,
          receivedAt: new Date(data.receivedAt),
          source: "PASTE",
        });
      }
      results.push({ id: operation.id, ok: true });
    } catch (error) {
      console.error(`Offline sync failed for ${operation.id}`, error);
      results.push({ id: operation.id, ok: false, error: "تعذر حفظ العنصر" });
    }
  }

  return NextResponse.json({ ok: results.every((item) => item.ok), results });
}
