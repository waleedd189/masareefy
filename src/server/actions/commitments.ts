"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { debts, recurringRules, transactions } from "@/db/schema";
import { round2 } from "@/lib/format";
import { recomputeCard } from "@/lib/services/balances";
import { nextOccurrence } from "@/lib/services/reminders";

/**
 * الالتزامات: مصروفات متكررة + اشتراكات + ديون.
 * مقابل `hub/{recurring-expenses, subscriptions, debts, appointments}` في Mezanetak.
 */

export interface CommitmentFormState {
  ok: boolean;
  message?: string;
}

function num(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function revalidateAll() {
  revalidatePath("/commitments");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/transactions");
}

// ── المتكررات ────────────────────────────────────────────────────────────────

export async function createRecurringAction(_prev: CommitmentFormState, formData: FormData): Promise<CommitmentFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const amount = num(formData.get("amount"));
  if (!title) return { ok: false, message: "اكتب اسم للبند" };
  if (!amount || amount <= 0) return { ok: false, message: "اكتب مبلغ صحيح" };

  const interval = String(formData.get("interval") ?? "MONTHLY");
  const dayOfMonth = num(formData.get("dayOfMonth"));
  const cardId = String(formData.get("cardId") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  const [created] = await db
    .insert(recurringRules)
    .values({
      title,
      amount,
      direction: (String(formData.get("direction") ?? "OUT") as "OUT" | "IN") ?? "OUT",
      kind: String(formData.get("kind") ?? "SUBSCRIPTION"),
      interval,
      dayOfMonth: dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 28 ? dayOfMonth : null,
      cardId,
      categoryId,
      nextRunAt: nextOccurrence({ interval, dayOfMonth, nextRunAt: null, lastRunAt: null }),
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .returning();

  void created;
  revalidateAll();
  return { ok: true, message: "تم إضافة البند المتكرر ✅" };
}

export async function toggleRecurringAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const [row] = await db.select().from(recurringRules).where(eq(recurringRules.id, id)).limit(1);
  if (!row) return;
  await db.update(recurringRules).set({ isActive: !row.isActive, updatedAt: new Date() }).where(eq(recurringRules.id, id));
  revalidateAll();
}

export async function deleteRecurringAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.update(transactions).set({ recurringId: null }).where(eq(transactions.recurringId, id));
  await db.delete(recurringRules).where(eq(recurringRules.id, id));
  revalidateAll();
}

/** سجّل دفعة دلوقتي: ينشئ عملية ويؤجّل الاستحقاق الجاي */
export async function recordRecurringAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const [rule] = await db.select().from(recurringRules).where(eq(recurringRules.id, id)).limit(1);
  if (!rule) return;

  const occurredAt = new Date();
  await db.insert(transactions).values({
    cardId: rule.cardId,
    type: rule.direction === "IN" ? "DEPOSIT" : rule.kind === "DEBT_PAYMENT" ? "PAYMENT" : "PURCHASE",
    direction: rule.direction,
    amount: rule.amount,
    currency: "EGP",
    merchant: rule.title,
    description: rule.notes ?? `${rule.title} (متكرر)`,
    categoryId: rule.categoryId,
    recurringId: rule.id,
    occurredAt,
    source: "MANUAL",
  });

  await db
    .update(recurringRules)
    .set({
      lastRunAt: occurredAt,
      nextRunAt: nextOccurrence({ interval: rule.interval, dayOfMonth: rule.dayOfMonth, nextRunAt: null, lastRunAt: occurredAt }),
      updatedAt: new Date(),
    })
    .where(eq(recurringRules.id, id));

  if (rule.cardId) await recomputeCard(rule.cardId);
  revalidateAll();
}

// ── الديون ───────────────────────────────────────────────────────────────────

export async function createDebtAction(_prev: CommitmentFormState, formData: FormData): Promise<CommitmentFormState> {
  const person = String(formData.get("person") ?? "").trim();
  const amount = num(formData.get("amount"));
  if (!person) return { ok: false, message: "اكتب اسم الشخص/الجهة" };
  if (!amount || amount <= 0) return { ok: false, message: "اكتب مبلغ صحيح" };

  const dueDate = String(formData.get("dueDate") ?? "").trim();
  await db.insert(debts).values({
    person,
    direction: (String(formData.get("direction") ?? "OWED_BY_ME") as "OWED_BY_ME" | "OWED_TO_ME") ?? "OWED_BY_ME",
    amount,
    paidAmount: num(formData.get("paidAmount")) ?? 0,
    currency: String(formData.get("currency") ?? "EGP") || "EGP",
    dueDate: dueDate ? new Date(dueDate) : null,
    cardId: String(formData.get("cardId") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  revalidateAll();
  return { ok: true, message: "تم إضافة الدين ✅" };
}

export async function payDebtAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const amount = num(formData.get("amount"));
  if (!id || !amount || amount <= 0) return;
  const [debt] = await db.select().from(debts).where(eq(debts.id, id)).limit(1);
  if (!debt) return;

  const paid = round2(debt.paidAmount + amount);
  await db
    .update(debts)
    .set({ paidAmount: paid, isSettled: paid >= debt.amount, updatedAt: new Date() })
    .where(eq(debts.id, id));

  // سجّل السداد كعملية على الحساب المرتبط
  if (debt.cardId) {
    await db.insert(transactions).values({
      cardId: debt.cardId,
      type: debt.direction === "OWED_BY_ME" ? "PAYMENT" : "DEPOSIT",
      direction: debt.direction === "OWED_BY_ME" ? "OUT" : "IN",
      amount,
      currency: debt.currency,
      merchant: debt.person,
      description: `سداد دين: ${debt.notes ?? debt.person}`,
      occurredAt: new Date(),
      source: "MANUAL",
    });
    await recomputeCard(debt.cardId);
  }
  revalidateAll();
}

export async function toggleSettleDebtAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const [debt] = await db.select().from(debts).where(eq(debts.id, id)).limit(1);
  if (!debt) return;
  await db
    .update(debts)
    .set({ isSettled: !debt.isSettled, updatedAt: new Date() })
    .where(eq(debts.id, id));
  revalidateAll();
}

export async function deleteDebtAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(debts).where(eq(debts.id, id));
  revalidateAll();
}
