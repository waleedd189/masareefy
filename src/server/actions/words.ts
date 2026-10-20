"use server";

import { revalidatePath } from "next/cache";
import { hideWord, restoreWords, saveWord, deleteWord } from "@/lib/services/words";

/**
 * كلمات المحلل المتعلَّمة — مقابل `saveWord` / `removeWord` / `restoreWords`
 * في قناة `cashflow/sms_tracking` بتاعة Mezanetak.
 */

export interface WordFormState {
  ok: boolean;
  message?: string;
}

export async function saveWordAction(_prev: WordFormState, formData: FormData): Promise<WordFormState> {
  const word = String(formData.get("word") ?? "").trim();
  const kind = String(formData.get("kind") ?? "PURCHASE").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  if (word.length < 2) return { ok: false, message: "اكتب كلمة من حرفين على الأقل" };

  const saved = await saveWord({ word, kind, categoryId });
  revalidatePath("/settings");
  revalidatePath("/messages");
  return saved
    ? { ok: true, message: `المحلل اتعلّم: «${word}» ✅` }
    : { ok: false, message: "مش قادر أحفظ الكلمة دي" };
}

export async function hideWordAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await hideWord(id);
  revalidatePath("/settings");
}

export async function deleteWordAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await deleteWord(id);
  revalidatePath("/settings");
}

export async function restoreWordsAction(_prev: WordFormState): Promise<WordFormState> {
  void _prev; // الشكل المطلوب من useActionState
  const count = await restoreWords();
  revalidatePath("/settings");
  return { ok: true, message: count ? `رجّعنا ${count} كلمة مخفية ✅` : "مفيش كلمات مخفية" };
}

/**
 * تعليم سريع من رسالة: بيربط كلمة (تاجر/بيان) بفئة — نفس `saveWord` في
 * قناة `cashflow/sms_tracking` لما المستخدم يصحّح تصنيف.
 */
export async function teachWordFromMessageAction(formData: FormData): Promise<void> {
  const word = String(formData.get("word") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "PURCHASE").trim() || "PURCHASE";
  if (word.length < 2) return;
  await saveWord({ word, kind, categoryId });
  revalidatePath("/messages");
  revalidatePath("/settings");
}
