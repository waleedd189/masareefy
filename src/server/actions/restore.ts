"use server";

import { revalidatePath } from "next/cache";
import { applyRestore, previewRestore, type RestoreMode, type TableCount } from "@/lib/import/restore";

export interface RestoreState {
  ok: boolean;
  message?: string;
  stage?: "preview" | "done";
  version?: number;
  generatedAt?: string | null;
  counts?: TableCount[];
  warnings?: string[];
  noChanges?: boolean;
}

/** حد حجم معقول للملف (20MB) عشان ما نحمّلش السيرفر */
const MAX_BYTES = 20 * 1024 * 1024;

async function readBackupText(formData: FormData): Promise<{ text: string; error?: string }> {
  const entry = formData.get("file");
  if (entry && typeof entry === "object" && "arrayBuffer" in entry) {
    const file = entry as File;
    if (!file.size) return { text: "", error: "الملف فاضي" };
    if (file.size > MAX_BYTES) return { text: "", error: "الملف أكبر من 20MB — صدّر فترة أصغر" };
    const buffer = Buffer.from(await file.arrayBuffer());
    return { text: buffer.toString("utf8") };
  }
  const text = String(formData.get("text") ?? "");
  if (!text.trim()) return { text: "", error: "ارفع ملف النسخة الاحتياطية أو الصق محتواه" };
  if (text.length > MAX_BYTES) return { text: "", error: "المحتوى أكبر من الحد المسموح (20MB)" };
  return { text };
}

/** فحص النسخة وعرض أعدادها — من غير أي كتابة في القاعدة */
export async function previewRestoreAction(_prev: RestoreState, formData: FormData): Promise<RestoreState> {
  void _prev; // الشكل المطلوب من useActionState
  const { text, error } = await readBackupText(formData);
  if (error) return { ok: false, message: error, stage: "preview" };

  const preview = await previewRestore(text);
  if (!preview.ok) return { ok: false, message: preview.message, stage: "preview" };

  return {
    ok: true,
    stage: "preview",
    message: "النسخة مقروءة — راجع الأعداد واختار الطريقة (دمج ولا استبدال) ثم اضغط استيراد",
    version: preview.version,
    generatedAt: preview.generatedAt,
    counts: preview.counts,
    warnings: preview.warnings,
  };
}

/** تنفيذ الاستيراد (دمج أو استبدال كامل) */
export async function applyRestoreAction(_prev: RestoreState, formData: FormData): Promise<RestoreState> {
  void _prev;
  const { text, error } = await readBackupText(formData);
  if (error) return { ok: false, message: error, stage: "done" };

  const rawMode = String(formData.get("mode") ?? "merge");
  const mode: RestoreMode = rawMode === "replace" ? "replace" : "merge";

  // تأكيد صريح من الواجهة قبل الاستبدال (إجراء مدمّر)
  if (mode === "replace" && formData.get("confirmReplace") !== "yes") {
    return {
      ok: false,
      message: "وضع «الاستبدال الكامل» محتاج تأكيد — علّم على صندوق التأكيد الأول",
      stage: "done",
    };
  }

  const result = await applyRestore(text, mode);

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/cards");
  revalidatePath("/messages");
  revalidatePath("/goals");
  revalidatePath("/commitments");
  revalidatePath("/statements");
  revalidatePath("/badges");
  revalidatePath("/settings");

  return {
    ok: result.ok,
    stage: "done",
    message: result.message,
    counts: result.counts,
    warnings: result.warnings,
    noChanges: result.noChanges,
  };
}
