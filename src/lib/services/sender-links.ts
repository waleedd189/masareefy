import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, senderLinks, type SenderLink } from "@/db/schema";
import { foldArabic } from "@/lib/sms/normalize";

/**
 * روابط المرسل — مقابل جدول `source_links` في Mezanetak:
 * (sender_key + last4) ← حساب + فئة + تسمية + عدّاد موافقات + autoFile.
 *
 * كل ما المستخدم يأكد رسالة، الرابط بيتقوّى (approvedCount++) والمرة الجاية
 * نفس المرسل يتسجل تلقائيًا من غير مراجعة.
 */

export function senderKey(sender?: string | null): string {
  return foldArabic(sender ?? "").replace(/\s+/g, " ").trim();
}

export async function findLink(sender?: string | null, last4?: string | null): Promise<SenderLink | null> {
  const key = senderKey(sender);
  const digits = (last4 ?? "").slice(-4);

  if (key && digits) {
    const [exact] = await db
      .select()
      .from(senderLinks)
      .where(and(eq(senderLinks.senderKey, key), eq(senderLinks.last4, digits)))
      .limit(1);
    if (exact) return exact;
  }
  if (key) {
    const [bySender] = await db
      .select()
      .from(senderLinks)
      .where(and(eq(senderLinks.senderKey, key), eq(senderLinks.last4, "")))
      .limit(1);
    if (bySender) return bySender;
  }
  if (digits) {
    const rows = await db.select().from(senderLinks).where(eq(senderLinks.last4, digits)).orderBy(desc(senderLinks.approvedCount));
    if (rows.length === 1) return rows[0];
  }
  return null;
}

export async function listLinks(): Promise<(SenderLink & { cardName: string; cardLast4: string })[]> {
  const rows = await db
    .select({ link: senderLinks, card: cards })
    .from(senderLinks)
    .leftJoin(cards, eq(senderLinks.cardId, cards.id))
    .orderBy(desc(senderLinks.approvedCount), asc(senderLinks.createdAt));
  return rows.map((row) => ({
    ...row.link,
    cardName: row.card?.name ?? "حساب محذوف",
    cardLast4: row.card?.last4 ?? "----",
  }));
}

export async function saveLink(input: {
  sender?: string | null;
  last4?: string | null;
  cardId: string;
  categoryId?: string | null;
  label?: string | null;
  autoFile?: boolean;
}): Promise<SenderLink | null> {
  const key = senderKey(input.sender);
  const digits = (input.last4 ?? "").slice(-4);
  if (!key && !digits) return null;

  const [existing] = await db
    .select()
    .from(senderLinks)
    .where(and(eq(senderLinks.senderKey, key), eq(senderLinks.last4, digits)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(senderLinks)
      .set({
        cardId: input.cardId,
        categoryId: input.categoryId ?? existing.categoryId,
        label: input.label ?? existing.label,
        autoFile: input.autoFile ?? existing.autoFile,
        updatedAt: new Date(),
      })
      .where(eq(senderLinks.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(senderLinks)
    .values({
      senderKey: key,
      last4: digits,
      cardId: input.cardId,
      categoryId: input.categoryId ?? null,
      label: input.label ?? null,
      autoFile: input.autoFile ?? true,
    })
    .returning();
  return created;
}

/** تعلّم من موافقة المستخدم: نربط المرسل+البطاقة ونزوّد العدّاد */
export async function learnFromApproval(input: {
  sender?: string | null;
  last4?: string | null;
  cardId: string;
  categoryId?: string | null;
}): Promise<void> {
  const key = senderKey(input.sender);
  const digits = (input.last4 ?? "").slice(-4);
  if (!key && !digits) return;

  const [existing] = await db
    .select()
    .from(senderLinks)
    .where(and(eq(senderLinks.senderKey, key), eq(senderLinks.last4, digits)))
    .limit(1);

  if (existing) {
    await db
      .update(senderLinks)
      .set({
        cardId: input.cardId,
        categoryId: input.categoryId ?? existing.categoryId,
        approvedCount: existing.approvedCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(senderLinks.id, existing.id));
    return;
  }

  await db.insert(senderLinks).values({
    senderKey: key,
    last4: digits,
    cardId: input.cardId,
    categoryId: input.categoryId ?? null,
    approvedCount: 1,
  });
}

export async function removeLink(id: string): Promise<void> {
  await db.delete(senderLinks).where(eq(senderLinks.id, id));
}

export async function unlinkAccount(cardId: string): Promise<void> {
  const rows = await db.select({ id: senderLinks.id }).from(senderLinks).where(eq(senderLinks.cardId, cardId));
  for (const row of rows) await db.delete(senderLinks).where(eq(senderLinks.id, row.id));
}
