"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { apiTokens, categories, parserRules } from "@/db/schema";
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
      keywords: String(formData.get("keywords") ?? "").trim(),
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

export async function createTokenAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim() || "تطبيق الموبايل";
  await db.insert(apiTokens).values({ name, token: `msr_${randomBytes(24).toString("hex")}` });
  revalidatePath("/settings");
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
