"use server";

import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/auth-token";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { apiTokens, cards, categories, messages, parserRules, transactions } from "@/db/schema";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

export async function createCategoryAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db
    .insert(categories)
    .values({
      name,
      emoji: String(formData.get("emoji") ?? "🏷️").trim() || "🏷️",
      color: String(formData.get("color") ?? "slate"),
      keywords: String(formData.get("keywords") ?? "").trim(),
      parentId: String(formData.get("parentId") ?? "").trim() || null,
      monthlyBudget: Number(formData.get("monthlyBudget")) || null,
    })
    .onConflictDoNothing();
  revalidatePath("/settings");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(categories)
    .set({
      name: String(formData.get("name") ?? "").trim() || undefined,
      emoji: String(formData.get("emoji") ?? "").trim() || undefined,
      keywords: String(formData.get("keywords") ?? "").trim(),
      parentId: String(formData.get("parentId") ?? "").trim() || null,
      monthlyBudget: Number(formData.get("monthlyBudget")) || null,
    })
    .where(eq(categories.id, id));
  revalidatePath("/settings");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/settings");
}

export async function restoreDefaultCategoriesAction(): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...category, isSystem: true })
      .onConflictDoNothing();
  }
  revalidatePath("/settings");
}

export interface TokenFormState {
  ok: boolean;
  message?: string;
  /** المفتاح الكامل بيظهر مرة واحدة بس عند الإنشاء */
  token?: string;
}

/**
 * إنشاء مفتاح API: بنخزّن **بصمة SHA-256** بس (مش النص الصريح) وبنعرض
 * المفتاح مرة واحدة — مقابل `KeystoreFieldCipher` في Mezanetak (تشفير الحقول الحساسة).
 */
export async function createTokenAction(_prev: TokenFormState, formData: FormData): Promise<TokenFormState> {
  const name = String(formData.get("name") ?? "").trim() || "تطبيق الموبايل";
  const token = `msr_${randomBytes(24).toString("hex")}`;
  await db.insert(apiTokens).values({
    name,
    token: `${token.slice(0, 8)}…${token.slice(-4)}`,
    tokenHash: hashToken(token),
  });
  revalidatePath("/settings");
  return { ok: true, message: "اتعمل مفتاح جديد — انسخه دلوقتي، مش هيظهر تاني 🔐", token };
}

export async function deleteTokenAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(apiTokens).where(eq(apiTokens.id, id));
  revalidatePath("/settings");
}

export async function createRuleAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const pattern = String(formData.get("pattern") ?? "").trim();
  if (!name || !pattern) return;
  try {
    new RegExp(pattern, "iu");
  } catch {
    return;
  }
  await db.insert(parserRules).values({
    name,
    bankKey: String(formData.get("bankKey") ?? "custom"),
    pattern,
    typeHint: String(formData.get("typeHint") ?? "") || null,
    priority: Number(formData.get("priority")) || 100,
  });
  revalidatePath("/settings");
}

export async function toggleRuleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const [rule] = await db.select().from(parserRules).where(eq(parserRules.id, id)).limit(1);
  if (!rule) return;
  await db.update(parserRules).set({ enabled: !rule.enabled }).where(eq(parserRules.id, id));
  revalidatePath("/settings");
}

export async function deleteRuleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(parserRules).where(eq(parserRules.id, id));
  revalidatePath("/settings");
}

export type ClearDemoDataState = {
  ok?: boolean;
  message?: string;
};

/**
 * يفرّغ بيانات الاستخدام التي ينشئها db:seed، مع الاحتفاظ بإعدادات التطبيق.
 * حذف العمليات والرسائل صراحةً يجعل السلوك ثابتاً حتى لو اختلف إعداد foreign keys.
 */
export async function clearDemoDataAction(
  previousState: ClearDemoDataState,
): Promise<ClearDemoDataState> {
  void previousState;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(transactions);
      await tx.delete(messages);
      await tx.delete(cards);
    });

    revalidatePath("/");
    revalidatePath("/cards");
    revalidatePath("/transactions");
    revalidatePath("/messages");
    revalidatePath("/settings");

    return { ok: true, message: "تم مسح البطاقات والعمليات والرسائل بنجاح." };
  } catch (error) {
    console.error("Failed to clear demo data", error);
    return { ok: false, message: "حصلت مشكلة أثناء المسح. جرّب مرة تانية." };
  }
}
