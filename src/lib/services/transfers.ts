import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, transactions } from "@/db/schema";
import { round2 } from "@/lib/format";
import { convert, getRates } from "@/lib/fx";
import { recomputeCard } from "./balances";

/**
 * التحويل بين الحسابات — البند الناقص في «حسابات متعددة الأنواع».
 *
 * كل تحويل = رجلين (TRANSFER_OUT من المصدر + TRANSFER_IN للوجهة) بيتشاركوا
 * `transferId` واحد، فالإلغاء بيرجّع الطرفين والرصيد بيتحسب من جديد.
 */

export interface TransferInput {
  fromId: string;
  toId: string;
  amount: number;
  note?: string | null;
  occurredAt?: Date | null;
}

export interface TransferResult {
  ok: boolean;
  message: string;
  transferId?: string;
  /** المبلغ اللي وصل للوجهة (بيختلف لو العملتين مختلفتين) */
  received?: number;
  fromCurrency?: string;
  toCurrency?: string;
}

export interface TransferLeg {
  transferId: string;
  fromName: string;
  toName: string;
  amount: number;
  currency: string;
  occurredAt: Date;
  description: string | null;
  /** معرّف رجل المصدر (لأي عملية على الصف) */
  id: string;
}

export async function performTransfer(input: TransferInput): Promise<TransferResult> {
  const { fromId, toId } = input;
  const amount = round2(input.amount);

  if (!fromId || !toId) return { ok: false, message: "اختر الحساب المصدر والوجهة" };
  if (fromId === toId) return { ok: false, message: "المصدر والوجهة لازم يختلفوا" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "اكتب مبلغ أكبر من صفر" };

  const [fromRows, toRows] = await Promise.all([
    db.select().from(cards).where(eq(cards.id, fromId)).limit(1),
    db.select().from(cards).where(eq(cards.id, toId)).limit(1),
  ]);
  const from = fromRows[0];
  const to = toRows[0];
  if (!from || !to) return { ok: false, message: "الحساب مش موجود" };

  // تحويل العملة لو الحسابين بعملتين مختلفتين (حسب الأسعار المحفوظة)
  let received = amount;
  if (from.currency !== to.currency) {
    const rates = await getRates();
    const converted = convert(amount, from.currency, to.currency, rates);
    if (converted === null) {
      return {
        ok: false,
        message: `مفيش سعر صرف محفوظ بين ${from.currency} و${to.currency} — احفظه من الإعدادات الأول`,
      };
    }
    received = converted;
  }

  // رصيد كفاية؟ (بطاقة الائتمان = سلفة نقدية، فبنسمح مع تنبيه)
  const isCredit = from.type === "CREDIT";
  if (!isCredit && from.currentBalance < amount) {
    return {
      ok: false,
      message: `الرصيد في «${from.name}» مش كفاية (متاح ${round2(from.currentBalance)} ${from.currency})`,
    };
  }

  const transferId = randomUUID();
  const occurredAt = input.occurredAt && !Number.isNaN(input.occurredAt.getTime()) ? input.occurredAt : new Date();
  const label = input.note?.trim() || `تحويل من ${from.name} إلى ${to.name}`;

  await db.insert(transactions).values({
    cardId: from.id,
    type: "TRANSFER_OUT",
    direction: "OUT",
    amount,
    currency: from.currency,
    merchant: to.name,
    description: label,
    occurredAt,
    transferId,
    source: "MANUAL",
    note: isCredit ? "سلفة نقدية من بطاقة ائتمان" : null,
  });

  await db.insert(transactions).values({
    cardId: to.id,
    type: "TRANSFER_IN",
    direction: "IN",
    amount: received,
    currency: to.currency,
    fxAmount: from.currency !== to.currency ? amount : null,
    fxCurrency: from.currency !== to.currency ? from.currency : null,
    merchant: from.name,
    description: label,
    occurredAt,
    transferId,
    source: "MANUAL",
  });

  await recomputeCard(from.id);
  await recomputeCard(to.id);

  const fxNote = from.currency !== to.currency ? ` (وصل ${received} ${to.currency})` : "";
  return {
    ok: true,
    message: `تم تحويل ${amount} ${from.currency} من «${from.name}» إلى «${to.name}»${fxNote} ✅`,
    transferId,
    received,
    fromCurrency: from.currency,
    toCurrency: to.currency,
  };
}

/** إلغاء تحويل: بيحذف الرجلين ويرجّع الأرصدة */
export async function cancelTransfer(transferId: string): Promise<{ ok: boolean; message: string }> {
  if (!transferId) return { ok: false, message: "مفيش معرّف تحويل" };
  const legs = await db.select().from(transactions).where(eq(transactions.transferId, transferId));
  if (!legs.length) return { ok: false, message: "التحويل مش موجود" };

  await db.delete(transactions).where(eq(transactions.transferId, transferId));
  const touched = new Set(legs.map((leg) => leg.cardId).filter(Boolean) as string[]);
  for (const cardId of touched) await recomputeCard(cardId);

  return { ok: true, message: `اتلغى التحويل (${legs.length} عملية) وتم تحديث الأرصدة` };
}

/** آخر التحويلات (رجل المصدر لكل تحويل) */
export async function listTransfers(limit = 8): Promise<TransferLeg[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(isNotNull(transactions.transferId), eq(transactions.direction, "OUT")))
    .orderBy(desc(transactions.occurredAt))
    .limit(limit);

  const allCards = await db.select().from(cards);
  return rows.map((tx) => {
    const from = allCards.find((c) => c.id === tx.cardId);
    return {
      transferId: tx.transferId as string,
      id: tx.id,
      fromName: from?.name ?? "حساب",
      toName: tx.merchant ?? "حساب",
      amount: tx.amount,
      currency: tx.currency,
      occurredAt: tx.occurredAt,
      description: tx.description,
    };
  });
}
