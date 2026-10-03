"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { getBank } from "@/lib/sms/banks";
import { recomputeCard } from "@/lib/services/balances";

const numberish = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(/,/g, ""))))
  .refine((v) => v === null || Number.isFinite(v), "رقم غير صالح");

const cardSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسم للبطاقة"),
  bankKey: z.string().trim().default("generic"),
  brand: z.string().trim().default("VISA"),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "آخر 4 أرقام لازم تكون 4 أرقام"),
  type: z.enum(["CREDIT", "DEBIT", "PREPAID"]),
  currency: z.string().trim().default("EGP"),
  creditLimit: numberish,
  openingBalance: numberish,
  statementDay: numberish,
  dueDay: numberish,
  color: z.string().trim().default("emerald"),
  notes: z.string().trim().optional().nullable(),
});

export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function parseForm(formData: FormData) {
  return cardSchema.safeParse({
    name: formData.get("name") ?? "",
    bankKey: formData.get("bankKey") ?? "generic",
    brand: formData.get("brand") ?? "VISA",
    last4: formData.get("last4") ?? "",
    type: formData.get("type") ?? "CREDIT",
    currency: formData.get("currency") ?? "EGP",
    creditLimit: String(formData.get("creditLimit") ?? ""),
    openingBalance: String(formData.get("openingBalance") ?? ""),
    statementDay: String(formData.get("statementDay") ?? ""),
    dueDay: String(formData.get("dueDay") ?? ""),
    color: formData.get("color") ?? "emerald",
    notes: (formData.get("notes") as string) ?? "",
  });
}

function formatErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] = issue.message;
  return out;
}

export async function createCardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, message: "فيه حقول ناقصة", errors: formatErrors(parsed.error) };

  const data = parsed.data;
  const bank = getBank(data.bankKey);
  const [created] = await db
    .insert(cards)
    .values({
      name: data.name,
      bankKey: data.bankKey,
      bankName: bank.nameAr,
      brand: data.brand,
      last4: data.last4,
      type: data.type,
      currency: data.currency || bank.currency,
      creditLimit: data.creditLimit,
      openingBalance: data.openingBalance ?? 0,
      currentBalance: data.type === "CREDIT" ? (data.openingBalance ?? 0) : (data.openingBalance ?? 0),
      statementDay: data.statementDay ?? null,
      dueDay: data.dueDay ?? null,
      color: data.color,
      notes: data.notes || null,
    })
    .returning();

  await recomputeCard(created.id);
  revalidatePath("/cards");
  revalidatePath("/");
  return { ok: true, message: "تمت إضافة البطاقة ✅" };
}

export async function updateCardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "البطاقة غير موجودة" };
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, message: "فيه حقول ناقصة", errors: formatErrors(parsed.error) };

  const data = parsed.data;
  const bank = getBank(data.bankKey);
  await db
    .update(cards)
    .set({
      name: data.name,
      bankKey: data.bankKey,
      bankName: bank.nameAr,
      brand: data.brand,
      last4: data.last4,
      type: data.type,
      currency: data.currency || bank.currency,
      creditLimit: data.creditLimit,
      openingBalance: data.openingBalance ?? 0,
      statementDay: data.statementDay ?? null,
      dueDay: data.dueDay ?? null,
      color: data.color,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id));

  await recomputeCard(id);
  revalidatePath("/cards");
  revalidatePath(`/cards/${id}`);
  revalidatePath("/");
  return { ok: true, message: "تم تحديث البطاقة ✅" };
}

export async function toggleArchiveCardAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const [card] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  if (!card) return;
  await db.update(cards).set({ isArchived: !card.isArchived, updatedAt: new Date() }).where(eq(cards.id, id));
  revalidatePath("/cards");
  revalidatePath("/");
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(cards).where(eq(cards.id, id));
  revalidatePath("/cards");
  revalidatePath("/");
}
