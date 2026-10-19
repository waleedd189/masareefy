"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { goals, transactions } from "@/db/schema";
import { round2 } from "@/lib/format";
import { recomputeCard } from "@/lib/services/balances";

/** أهداف الادخار — مقابل `widget_goal` + شاشة Goals في Mezanetak. */

export interface GoalFormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const goalSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسم للهدف"),
  targetAmount: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(/,/g, "")))
    .refine((v) => Number.isFinite(v) && v > 0, "مبلغ الهدف غير صالح"),
  savedAmount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(/,/g, "")) : 0))
    .refine((v) => Number.isFinite(v) && v >= 0, "المبلغ المدخر غير صالح"),
  currency: z.string().trim().default("EGP"),
  dueDate: z.string().trim().optional(),
  emoji: z.string().trim().default("🎯"),
  notes: z.string().trim().optional(),
});

function parse(formData: FormData) {
  return goalSchema.safeParse({
    name: formData.get("name") ?? "",
    targetAmount: String(formData.get("targetAmount") ?? ""),
    savedAmount: String(formData.get("savedAmount") ?? "0"),
    currency: formData.get("currency") ?? "EGP",
    dueDate: String(formData.get("dueDate") ?? ""),
    emoji: formData.get("emoji") ?? "🎯",
    notes: String(formData.get("notes") ?? ""),
  });
}

export async function createGoalAction(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] = issue.message;
    return { ok: false, message: "فيه حقول ناقصة", errors };
  }
  const data = parsed.data;
  await db.insert(goals).values({
    name: data.name,
    targetAmount: data.targetAmount,
    savedAmount: data.savedAmount,
    currency: data.currency || "EGP",
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    emoji: data.emoji || "🎯",
    notes: data.notes || null,
  });
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true, message: "تم إضافة الهدف ✅" };
}

export async function updateGoalAction(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "الهدف غير موجود" };
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, message: "فيه حقول ناقصة" };
  const data = parsed.data;
  await db
    .update(goals)
    .set({
      name: data.name,
      targetAmount: data.targetAmount,
      savedAmount: data.savedAmount,
      currency: data.currency || "EGP",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      emoji: data.emoji || "🎯",
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id));
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true, message: "تم تحديث الهدف ✅" };
}

/** إضافة مبلغ مدخر للهدف (اختياريًا كعملية تحويل لحساب الادخار) */
export async function contributeToGoalAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "0").replace(/,/g, ""));
  if (!id || !Number.isFinite(amount)) return;
  const [goal] = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
  if (!goal) return;
  await db
    .update(goals)
    .set({ savedAmount: round2(Math.max(0, goal.savedAmount + amount)), updatedAt: new Date() })
    .where(eq(goals.id, id));
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.update(transactions).set({ goalId: null }).where(eq(transactions.goalId, id));
  await db.delete(goals).where(eq(goals.id, id));
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function toggleArchiveGoalAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const [goal] = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
  if (!goal) return;
  await db.update(goals).set({ isArchived: !goal.isArchived, updatedAt: new Date() }).where(eq(goals.id, id));
  revalidatePath("/goals");
  revalidatePath("/");
}

/** تسجيل عملية مرتبطة بهدف (ادخار فعلي من حساب) */
export async function saveGoalTransactionAction(formData: FormData): Promise<void> {
  const goalId = String(formData.get("goalId") ?? "");
  const cardId = String(formData.get("cardId") ?? "") || null;
  const amount = Number(String(formData.get("amount") ?? "0").replace(/,/g, ""));
  if (!goalId || !Number.isFinite(amount) || amount <= 0) return;
  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);
  if (!goal) return;

  await db.insert(transactions).values({
    cardId,
    type: "TRANSFER_OUT",
    direction: "OUT",
    amount,
    currency: goal.currency,
    merchant: goal.name,
    description: `ادخار لهدف ${goal.name}`,
    goalId,
    source: "MANUAL",
    occurredAt: new Date(),
  });
  await db.update(goals).set({ savedAmount: round2(goal.savedAmount + amount), updatedAt: new Date() }).where(eq(goals.id, goalId));
  if (cardId) await recomputeCard(cardId);
  revalidatePath("/goals");
  revalidatePath("/transactions");
  revalidatePath("/");
}
