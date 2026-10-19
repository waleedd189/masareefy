"use server";

import { revalidatePath } from "next/cache";
import { removeLink, saveLink } from "@/lib/services/sender-links";

/** روابط المرسلين (sender + last4 ← حساب/فئة) — مقابل `source_links` في Mezanetak. */

export interface LinkFormState {
  ok: boolean;
  message?: string;
}

export async function saveLinkAction(_prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const sender = String(formData.get("sender") ?? "").trim() || null;
  const last4 = String(formData.get("last4") ?? "").trim().replace(/\D/g, "").slice(-4);
  const cardId = String(formData.get("cardId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const label = String(formData.get("label") ?? "").trim() || null;
  const autoFile = String(formData.get("autoFile") ?? "on") === "on";

  if (!cardId) return { ok: false, message: "اختر الحساب الأول" };
  if (!sender && !last4) return { ok: false, message: "اكتب اسم المرسل أو آخر 4 أرقام" };

  const link = await saveLink({ sender, last4, cardId, categoryId, label, autoFile });
  revalidatePath("/settings");
  revalidatePath("/messages");
  return link ? { ok: true, message: "تم حفظ الربط ✅" } : { ok: false, message: "مش قادر أحفظ الربط" };
}

export async function removeLinkAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await removeLink(id);
  revalidatePath("/settings");
}
