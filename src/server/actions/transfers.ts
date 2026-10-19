"use server";

import { revalidatePath } from "next/cache";
import { round2 } from "@/lib/format";
import { cancelTransfer, performTransfer } from "@/lib/services/transfers";

/**
 * Server Actions للتحويل بين الحسابات — المنطق نفسه في
 * `src/lib/services/transfers.ts` (قابل للاختبار من غير واجهة).
 */

export interface TransferFormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function parseAmount(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : null;
}

export async function transferAction(_prev: TransferFormState, formData: FormData): Promise<TransferFormState> {
  void _prev; // الشكل المطلوب من useActionState
  const fromId = String(formData.get("fromCardId") ?? "").trim();
  const toId = String(formData.get("toCardId") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const dateRaw = String(formData.get("occurredAt") ?? "").trim();

  const errors: Record<string, string> = {};
  if (!fromId) errors.fromCardId = "اختر الحساب المصدر";
  if (!toId) errors.toCardId = "اختر الحساب الوجهة";
  if (fromId && fromId === toId) errors.toCardId = "المصدر والوجهة لازم يختلفوا";
  if (!amount) errors.amount = "اكتب مبلغ أكبر من صفر";
  if (Object.keys(errors).length) return { ok: false, message: "فيه حقول ناقصة", errors };

  const result = await performTransfer({
    fromId,
    toId,
    amount: amount!,
    note,
    occurredAt: dateRaw ? new Date(dateRaw) : null,
  });

  if (result.ok) {
    revalidatePath("/cards");
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath("/reports");
  }
  return { ok: result.ok, message: result.message };
}

/** إلغاء تحويل: بيحذف الرجلين مع بعض ويرجّع الأرصدة */
export async function deleteTransferAction(formData: FormData): Promise<void> {
  const transferId = String(formData.get("transferId") ?? "").trim();
  if (!transferId) return;
  const result = await cancelTransfer(transferId);
  if (result.ok) {
    revalidatePath("/cards");
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath("/reports");
  }
}
