"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { recomputeCard } from "@/lib/services/balances";
import { suggestCategoryId } from "@/lib/services/categorize";
import { DEFAULT_DIRECTION, type TxType } from "@/lib/sms/types";

export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const schema = z.object({
  cardId: z.string().trim().min(1, "اختر البطاقة"),
  type: z.string().trim().min(1),
  direction: z.enum(["OUT", "IN"]).optional(),
  amount: z
    .string()
    .trim()
    .min(1, "اكتب المبلغ")
    .transform((v) => Number(v.replace(/,/g, "")))
    .refine((v) => Number.isFinite(v) && v > 0, "مبلغ غير صالح"),
  merchant: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  occurredAt: z.string().trim().optional(),
  note: z.string().trim().optional(),
  availableAfter: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v.replace(/,/g, ""))))
    .refine((v) => v === null || Number.isFinite(v), "رقم غير صالح"),
});

function read(formData: FormData) {
  return schema.safeParse({
    cardId: formData.get("cardId") ?? "",
    type: formData.get("type") ?? "PURCHASE",
    direction: (formData.get("direction") as "OUT" | "IN" | null) ?? undefined,
    amount: String(formData.get("amount") ?? ""),
    merchant: String(formData.get("merchant") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    occurredAt: String(formData.get("occurredAt") ?? ""),
    note: String(formData.get("note") ?? ""),
    availableAfter: String(formData.get("availableAfter") ?? ""),
  });
}

export async function createTransactionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = read(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { ok: false, message: "راجع البيانات", errors };
  }
  const data = parsed.data;
  const type = data.type as TxType;
  const categoryId = data.categoryId || (await suggestCategoryId({ merchant: data.merchant, type }));

  await db.insert(transactions).values({
    cardId: data.cardId,
    type,
    direction: data.direction ?? DEFAULT_DIRECTION[type] ?? "OUT",
    amount: data.amount,
    currency: "EGP",
    merchant: data.merchant || null,
    categoryId: categoryId || null,
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    availableAfter: data.availableAfter,
    note: data.note || null,
    source: "MANUAL",
  });

  await recomputeCard(data.cardId);
  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath(`/cards/${data.cardId}`);
  return { ok: true, message: "تم تسجيل العملية ✅" };
}

export async function updateTransactionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const parsed = read(formData);
  if (!id || !parsed.success) return { ok: false, message: "راجع البيانات" };
  const data = parsed.data;
  const type = data.type as TxType;

  await db
    .update(transactions)
    .set({
      cardId: data.cardId,
      type,
      direction: data.direction ?? DEFAULT_DIRECTION[type] ?? "OUT",
      amount: data.amount,
      merchant: data.merchant || null,
      categoryId: data.categoryId || null,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      availableAfter: data.availableAfter,
      note: data.note || null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, id));

  await recomputeCard(data.cardId);
  revalidatePath("/transactions");
  revalidatePath("/");
  return { ok: true, message: "تم التحديث ✅" };
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [tx] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  await db.delete(transactions).where(eq(transactions.id, id));
  if (tx?.cardId) await recomputeCard(tx.cardId);
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function setCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!id) return;
  await db
    .update(transactions)
    .set({ categoryId: categoryId || null, updatedAt: new Date() })
    .where(eq(transactions.id, id));
  revalidatePath("/transactions");
}
