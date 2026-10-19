"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";

/**
 * دمج/إعادة تسمية التجار — البند الناقص في «التصنيف الذكي».
 *
 * نفس التاجر بيوصل بأشكال مختلفة من البنوك، فالدمج بيوحّد الاسم
 * (وبياخد أكتر فئة مستخدمة بين الأشكال) عشان التقارير تبقى دقيقة.
 */

function revalidate() {
  revalidatePath("/reports");
  revalidatePath("/transactions");
  revalidatePath("/settings");
  revalidatePath("/");
}

/** قراءة قائمة الأشكال من النموذج (JSON أو أسطر) */
function readVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
  } catch {
    // مش JSON — نتعامل معاه كقائمة مفصولة بسطر أو فاصلة
  }
  return trimmed
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** أكتر فئة مستخدمة بين الأشكال (للتوحيد) */
async function dominantCategoryId(variants: string[]): Promise<string | null> {
  const rows = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(inArray(transactions.merchant, variants));
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.categoryId) continue;
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

export async function mergeMerchantsAction(formData: FormData): Promise<void> {
  const canonical = String(formData.get("canonical") ?? "").trim();
  const variants = readVariants(String(formData.get("variants") ?? ""));
  const unifyCategory = String(formData.get("unifyCategory") ?? "on") !== "off";
  if (!canonical || variants.length < 1) return;

  const targets = [...new Set([...variants, canonical])].filter(Boolean);
  const categoryId = unifyCategory ? await dominantCategoryId(targets) : null;

  await db
    .update(transactions)
    .set({
      merchant: canonical,
      ...(categoryId ? { categoryId } : {}),
      updatedAt: new Date(),
    })
    .where(inArray(transactions.merchant, targets));

  revalidate();
}

/** إعادة تسمية تاجر يدويًا (من أي اسم لأي اسم) */
export async function renameMerchantAction(formData: FormData): Promise<void> {
  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  if (!from || !to || from === to) return;

  const categoryId = await dominantCategoryId([from, to]);
  await db
    .update(transactions)
    .set({
      merchant: to,
      ...(categoryId ? { categoryId } : {}),
      updatedAt: new Date(),
    })
    .where(inArray(transactions.merchant, [from]));

  revalidate();
}
