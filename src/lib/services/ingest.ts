import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, messages, parserRules, transactions, type Card } from "@/db/schema";
import { normalizeMessage } from "@/lib/sms/normalize";
import { parseSms } from "@/lib/sms/parse";
import type { ParsedSms, TxType } from "@/lib/sms/types";
import { recomputeCard } from "./balances";
import { suggestCategoryId } from "./categorize";

export const MIN_AUTO_CONFIDENCE = 0.55;

export type IngestStatus = "PARSED" | "NEEDS_REVIEW" | "UNMATCHED" | "IGNORED" | "DUPLICATE" | "FAILED";

export interface IngestInput {
  rawText: string;
  sender?: string | null;
  receivedAt?: Date | null;
  source?: "PASTE" | "WEBHOOK" | "IMPORT";
  /** إجبار الرسالة على بطاقة معيّنة */
  cardId?: string | null;
}

export interface IngestResult {
  messageId: string | null;
  status: IngestStatus;
  transactionId: string | null;
  cardId: string | null;
  parsed: ParsedSms | null;
  reason?: string;
}

export function hashMessage(text: string, sender?: string | null): string {
  return createHash("sha256")
    .update(`${normalizeMessage(text)}::${(sender ?? "").trim().toLowerCase()}`)
    .digest("hex");
}

/** مطابقة الرسالة ببطاقة من آخر 4 أرقام (+ البنك لو فيه أكثر من بطاقة بنفس الأرقام) */
export async function matchCard(parsed: ParsedSms): Promise<{ card: Card | null; ambiguous: boolean }> {
  if (!parsed.last4) return { card: null, ambiguous: false };
  const matches = await db
    .select()
    .from(cards)
    .where(and(eq(cards.last4, parsed.last4), eq(cards.isArchived, false)));
  if (matches.length === 1) return { card: matches[0], ambiguous: false };
  if (matches.length > 1) {
    const byBank = matches.find((c) => c.bankKey === parsed.bankKey);
    return { card: byBank ?? null, ambiguous: !byBank };
  }
  return { card: null, ambiguous: false };
}

/** استقبال رسالة بنك: تحليل ← مطابقة بطاقة ← إنشاء عملية */
export async function ingestMessage(input: IngestInput): Promise<IngestResult> {
  const rawText = (input.rawText ?? "").trim();
  if (rawText.length < 5) {
    return { messageId: null, status: "FAILED", transactionId: null, cardId: null, parsed: null, reason: "رسالة فارغة" };
  }

  const hash = hashMessage(rawText, input.sender);
  const [existing] = await db.select().from(messages).where(eq(messages.hash, hash)).limit(1);
  if (existing) {
    const [tx] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.messageId, existing.id)).limit(1);
    return {
      messageId: existing.id,
      status: "DUPLICATE",
      transactionId: tx?.id ?? null,
      cardId: existing.cardId,
      parsed: existing.parsed ? (JSON.parse(existing.parsed) as ParsedSms) : null,
      reason: "الرسالة دي مسجلة قبل كده",
    };
  }

  const rules = await db.select().from(parserRules).where(eq(parserRules.enabled, true));
  const receivedAt = input.receivedAt ?? new Date();
  const parsed = parseSms(rawText, {
    sender: input.sender,
    receivedAt,
    customRules: rules
      .sort((a, b) => a.priority - b.priority)
      .map((r) => ({
        id: r.id,
        name: r.name,
        bankKey: r.bankKey,
        pattern: r.pattern,
        typeHint: (r.typeHint as TxType | null) ?? null,
        priority: r.priority,
      })),
  });

  let card: Card | null = null;
  let ambiguous = false;
  if (input.cardId) {
    const [forced] = await db.select().from(cards).where(eq(cards.id, input.cardId)).limit(1);
    card = forced ?? null;
  } else {
    const match = await matchCard(parsed);
    card = match.card;
    ambiguous = match.ambiguous;
  }

  let status: IngestStatus;
  let reason: string | undefined;
  if (!parsed.isFinancial) {
    status = "IGNORED";
    reason = parsed.warnings[0] ?? "رسالة غير مالية";
  } else if (!card) {
    status = "UNMATCHED";
    reason = ambiguous
      ? "أكتر من بطاقة بنفس آخر 4 أرقام – اختر البطاقة يدوياً"
      : parsed.last4
        ? `مفيش بطاقة مسجلة برقم ${parsed.last4}`
        : "لم يتم التعرف على رقم البطاقة";
  } else if (parsed.confidence < MIN_AUTO_CONFIDENCE) {
    status = "NEEDS_REVIEW";
    reason = "درجة الثقة منخفضة – راجع البيانات";
  } else {
    status = "PARSED";
  }

  const [message] = await db
    .insert(messages)
    .values({
      rawText,
      sender: input.sender ?? null,
      receivedAt,
      hash,
      status,
      bankKey: parsed.bankKey,
      confidence: parsed.confidence,
      parsed: JSON.stringify(parsed),
      cardId: card?.id ?? null,
      error: reason ?? null,
      source: input.source ?? "PASTE",
    })
    .returning();

  let transactionId: string | null = null;
  if (status === "PARSED" && card && parsed.amount !== null) {
    const categoryId = await suggestCategoryId({ merchant: parsed.merchant, text: rawText, type: parsed.type });
    const [tx] = await db
      .insert(transactions)
      .values({
        cardId: card.id,
        type: parsed.type === "UNKNOWN" ? "PURCHASE" : parsed.type,
        direction: parsed.direction,
        amount: parsed.amount,
        currency: parsed.currency ?? card.currency,
        fxAmount: parsed.fxAmount,
        fxCurrency: parsed.fxCurrency,
        merchant: parsed.merchant,
        description: parsed.merchant ? null : rawText.slice(0, 140),
        categoryId,
        occurredAt: parsed.occurredAt ?? receivedAt,
        availableAfter: parsed.availableBalance,
        source: "SMS",
        messageId: message.id,
      })
      .returning();
    transactionId = tx.id;
    await recomputeCard(card.id);
  }

  return { messageId: message.id, status, transactionId, cardId: card?.id ?? null, parsed, reason };
}

/** تحويل رسالة تحت المراجعة لعملية فعلية بعد تعديل المستخدم */
export async function confirmMessage(
  messageId: string,
  overrides: {
    cardId: string;
    type: string;
    direction: "OUT" | "IN";
    amount: number;
    currency?: string;
    merchant?: string | null;
    occurredAt?: Date;
    categoryId?: string | null;
    availableAfter?: number | null;
  },
): Promise<string> {
  const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!message) throw new Error("الرسالة غير موجودة");
  const [card] = await db.select().from(cards).where(eq(cards.id, overrides.cardId)).limit(1);
  if (!card) throw new Error("البطاقة غير موجودة");

  const categoryId =
    overrides.categoryId !== undefined && overrides.categoryId !== null
      ? overrides.categoryId
      : await suggestCategoryId({ merchant: overrides.merchant, text: message.rawText, type: overrides.type });

  const values = {
    cardId: card.id,
    type: overrides.type,
    direction: overrides.direction,
    amount: overrides.amount,
    currency: overrides.currency ?? card.currency,
    merchant: overrides.merchant ?? null,
    occurredAt: overrides.occurredAt ?? message.receivedAt,
    availableAfter: overrides.availableAfter ?? null,
    categoryId,
    source: "SMS" as const,
    updatedAt: new Date(),
  };

  const [existingTx] = await db.select().from(transactions).where(eq(transactions.messageId, messageId)).limit(1);
  let transactionId: string;
  if (existingTx) {
    await db.update(transactions).set(values).where(eq(transactions.id, existingTx.id));
    transactionId = existingTx.id;
  } else {
    const [created] = await db
      .insert(transactions)
      .values({ ...values, messageId })
      .returning();
    transactionId = created.id;
  }

  await db.update(messages).set({ status: "PARSED", cardId: card.id, error: null }).where(eq(messages.id, messageId));
  await recomputeCard(card.id);
  return transactionId;
}
