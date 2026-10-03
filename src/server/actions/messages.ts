"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { messages, transactions } from "@/db/schema";
import { recomputeCard } from "@/lib/services/balances";
import { confirmMessage, ingestMessage, type IngestResult } from "@/lib/services/ingest";
import { parseSms, splitMessages } from "@/lib/sms/parse";

export interface PasteState {
  ok: boolean;
  message?: string;
  summary?: { total: number; parsed: number; review: number; unmatched: number; ignored: number; duplicate: number };
}

/** لصق رسالة أو أكثر (مفصولة بسطر فاضي) وتحليلها */
export async function pasteMessagesAction(_prev: PasteState, formData: FormData): Promise<PasteState> {
  const raw = String(formData.get("text") ?? "").trim();
  const sender = String(formData.get("sender") ?? "").trim() || null;
  const cardId = String(formData.get("cardId") ?? "").trim() || null;
  if (!raw) return { ok: false, message: "الصق نص الرسالة الأول" };

  const parts = splitMessages(raw);
  const results: IngestResult[] = [];
  for (const part of parts) {
    results.push(await ingestMessage({ rawText: part, sender, cardId, source: "PASTE" }));
  }

  const summary = {
    total: results.length,
    parsed: results.filter((r) => r.status === "PARSED").length,
    review: results.filter((r) => r.status === "NEEDS_REVIEW").length,
    unmatched: results.filter((r) => r.status === "UNMATCHED").length,
    ignored: results.filter((r) => r.status === "IGNORED").length,
    duplicate: results.filter((r) => r.status === "DUPLICATE").length,
  };

  revalidatePath("/messages");
  revalidatePath("/transactions");
  revalidatePath("/");

  return {
    ok: true,
    message: `تم تحليل ${summary.total} رسالة: ${summary.parsed} اتسجلت تلقائياً، ${summary.review + summary.unmatched} محتاجة مراجعة`,
    summary,
  };
}

/** معاينة فورية لتحليل رسالة بدون حفظ */
export async function previewMessageAction(text: string, sender?: string) {
  if (!text.trim()) return null;
  const parsed = parseSms(text, { sender: sender ?? null, receivedAt: new Date() });
  return {
    ...parsed,
    occurredAt: parsed.occurredAt ? parsed.occurredAt.toISOString() : null,
  };
}

export async function confirmMessageAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const cardId = String(formData.get("cardId") ?? "");
  const amount = Number(String(formData.get("amount") ?? "0").replace(/,/g, ""));
  const type = String(formData.get("type") ?? "PURCHASE");
  const direction = (String(formData.get("direction") ?? "OUT") as "OUT" | "IN") ?? "OUT";
  const merchant = String(formData.get("merchant") ?? "") || null;
  const occurredAt = String(formData.get("occurredAt") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "") || null;

  if (!id || !cardId || !Number.isFinite(amount) || amount <= 0) return;

  await confirmMessage(id, {
    cardId,
    type,
    direction,
    amount,
    merchant,
    occurredAt: occurredAt ? new Date(occurredAt) : undefined,
    categoryId,
  });

  revalidatePath("/messages");
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function ignoreMessageAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.update(messages).set({ status: "IGNORED", error: "تم التجاهل يدوياً" }).where(eq(messages.id, id));
  revalidatePath("/messages");
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [tx] = await db.select().from(transactions).where(eq(transactions.messageId, id)).limit(1);
  if (tx) {
    await db.delete(transactions).where(eq(transactions.id, tx.id));
    if (tx.cardId) await recomputeCard(tx.cardId);
  }
  await db.delete(messages).where(eq(messages.id, id));
  revalidatePath("/messages");
  revalidatePath("/transactions");
  revalidatePath("/");
}

/** إعادة تحليل الرسائل غير المربوطة (بعد إضافة بطاقة جديدة مثلاً) */
export async function reprocessMessagesAction(): Promise<void> {
  const pending = await db
    .select()
    .from(messages)
    .where(inArray(messages.status, ["UNMATCHED", "NEEDS_REVIEW", "FAILED"]));

  for (const message of pending) {
    await db.delete(messages).where(eq(messages.id, message.id));
    await ingestMessage({
      rawText: message.rawText,
      sender: message.sender,
      receivedAt: message.receivedAt,
      source: message.source as "PASTE" | "WEBHOOK" | "IMPORT",
    });
  }

  revalidatePath("/messages");
  revalidatePath("/transactions");
  revalidatePath("/");
}
