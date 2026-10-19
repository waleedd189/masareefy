"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { recomputeCard } from "@/lib/services/balances";
import { getUserWordsForParser } from "@/lib/services/words";
import { parseBrainDump, type BrainDumpCategory, type BrainDumpDraft } from "@/lib/services/braindump";
import { DEFAULT_DIRECTION, type TxType } from "@/lib/sms/types";

/**
 * التفريغ السريع (Brain dump) — مقابل ودجت/شاشة Brain dump في Mezanetak
 * ("اكتب اليوم كله ونحن نقسّمه").
 */

export interface BrainDumpPreviewState {
  ok: boolean;
  message?: string;
  drafts?: (BrainDumpDraft & { occurredAtIso: string | null })[];
}

export async function previewBrainDumpAction(
  text: string,
  categories: BrainDumpCategory[],
): Promise<(BrainDumpDraft & { occurredAtIso: string | null })[]> {
  if (!text.trim()) return [];
  const words = await getUserWordsForParser();
  const drafts = parseBrainDump(text, categories, words, new Date());
  return drafts.map((draft) => ({
    ...draft,
    occurredAtIso: draft.occurredAt ? draft.occurredAt.toISOString() : null,
  }));
}

export interface SaveDraftsState {
  ok: boolean;
  message?: string;
  saved?: number;
}

/** حفظ المسودات المختارة كعمليات فعلية */
export async function saveBrainDumpAction(_prev: SaveDraftsState, formData: FormData): Promise<SaveDraftsState> {
  const raw = String(formData.get("drafts") ?? "");
  const defaultCardId = String(formData.get("cardId") ?? "").trim() || null;
  if (!raw) return { ok: false, message: "مفيش مسودات للحفظ" };

  let drafts: (BrainDumpDraft & { occurredAtIso?: string | null })[];
  try {
    drafts = JSON.parse(raw) as (BrainDumpDraft & { occurredAtIso?: string | null })[];
  } catch {
    return { ok: false, message: "المسودات مش بصيغة صحيحة" };
  }

  const touched = new Set<string>();
  let saved = 0;

  for (const draft of drafts) {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const cardId = defaultCardId;
    const type = (draft.type ?? "PURCHASE") as TxType;
    await db.insert(transactions).values({
      cardId,
      type,
      direction: DEFAULT_DIRECTION[type] ?? "OUT",
      amount,
      currency: draft.currency ?? "EGP",
      merchant: draft.merchant,
      description: draft.raw?.slice(0, 140) ?? null,
      categoryId: draft.categoryId ?? null,
      occurredAt: draft.occurredAtIso ? new Date(draft.occurredAtIso) : new Date(),
      source: "MANUAL",
      note: "Brain dump",
    });
    if (cardId) touched.add(cardId);
    saved += 1;
  }

  for (const cardId of touched) await recomputeCard(cardId);

  revalidatePath("/brain-dump");
  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/reports");
  return { ok: saved > 0, message: saved ? `تم حفظ ${saved} عملية ✅` : "مفيش حاجة اتحفظت", saved };
}
