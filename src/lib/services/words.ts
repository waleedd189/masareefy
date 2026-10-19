import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, parserWords, type ParserWord } from "@/db/schema";
import { foldArabic } from "@/lib/sms/normalize";
import type { UserWord, WordKind } from "@/lib/sms/vocabulary";
import { wordKey } from "@/lib/sms/vocabulary";

/**
 * كلمات يتعلّمها المحلل من المستخدم — مقابل جدول `words` و`SmsWordCalls`
 * (saveWord / removeWord / restoreWords) في Mezanetak.
 *
 * الكلمة ممكن تحدد: نوع العملية (شراء/سحب/تحويل…)، أو الفئة، أو تجاهل الرسالة خالص (IGNORE).
 */

export async function listWords(): Promise<ParserWord[]> {
  return db.select().from(parserWords).orderBy(desc(parserWords.hits), asc(parserWords.createdAt));
}

/** الكلمات بصيغة يفهمها المحلل */
export async function getUserWordsForParser(): Promise<UserWord[]> {
  const rows = await db.select().from(parserWords).where(eq(parserWords.hidden, false));
  return rows.map((row) => ({
    wordKey: row.wordKey,
    display: row.display,
    kind: row.kind as WordKind,
    categoryId: row.categoryId,
  }));
}

export async function saveWord(input: {
  word: string;
  kind: string;
  categoryId?: string | null;
  origin?: "USER" | "BUILTIN";
}): Promise<ParserWord | null> {
  const key = wordKey(input.word);
  if (key.length < 2) return null;
  const categoryId = input.categoryId || null;

  const [existing] = await db
    .select()
    .from(parserWords)
    .where(and(eq(parserWords.wordKey, key), eq(parserWords.kind, input.kind)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(parserWords)
      .set({
        display: input.word.trim(),
        categoryId,
        hidden: false,
        origin: existing.isProtected ? existing.origin : (input.origin ?? "USER"),
        updatedAt: new Date(),
      })
      .where(eq(parserWords.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(parserWords)
    .values({
      wordKey: key,
      display: input.word.trim(),
      kind: input.kind,
      categoryId,
      origin: input.origin ?? "USER",
    })
    .returning();
  return created;
}

/** إزالة كلمة (بتتحول لـhidden عشان نقدر نرجعها) */
export async function hideWord(id: string): Promise<void> {
  const [row] = await db.select().from(parserWords).where(eq(parserWords.id, id)).limit(1);
  if (!row) return;
  if (row.origin === "BUILTIN") {
    await db.update(parserWords).set({ hidden: true, updatedAt: new Date() }).where(eq(parserWords.id, id));
    return;
  }
  await db.delete(parserWords).where(eq(parserWords.id, id));
}

export async function restoreWords(): Promise<number> {
  const rows = await db.update(parserWords).set({ hidden: false, updatedAt: new Date() }).where(eq(parserWords.hidden, true)).returning();
  return rows.length;
}

export async function deleteWord(id: string): Promise<void> {
  await db.delete(parserWords).where(eq(parserWords.id, id));
}

/** زيادة عدّاد الاستخدام لما كلمة تتطابق فعلاً في رسالة */
export async function bumpWordHits(word: string | null | undefined): Promise<void> {
  if (!word) return;
  const key = foldArabic(word);
  if (!key) return;
  const rows = await db.select({ id: parserWords.id, hits: parserWords.hits }).from(parserWords).where(eq(parserWords.wordKey, key));
  for (const row of rows) {
    await db.update(parserWords).set({ hits: row.hits + 1 }).where(eq(parserWords.id, row.id));
  }
}

/** اقتراح كلمات جاهزة من التجار المتكررين في عملياتك */
export async function suggestWordsFromHistory(limit = 12): Promise<{ merchant: string; count: number; categoryId: string | null }[]> {
  const { transactions } = await import("@/db/schema");
  const rows = await db
    .select({ merchant: transactions.merchant, categoryId: transactions.categoryId })
    .from(transactions);
  const map = new Map<string, { count: number; categoryId: string | null }>();
  for (const row of rows) {
    const name = (row.merchant ?? "").trim();
    if (name.length < 3) continue;
    const entry = map.get(name) ?? { count: 0, categoryId: row.categoryId };
    entry.count += 1;
    if (row.categoryId) entry.categoryId = row.categoryId;
    map.set(name, entry);
  }
  return [...map.entries()]
    .map(([merchant, v]) => ({ merchant, count: v.count, categoryId: v.categoryId }))
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function listCategoryOptions(): Promise<{ id: string; label: string }[]> {
  const rows = await db.select().from(categories).orderBy(asc(categories.name));
  return rows.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }));
}
