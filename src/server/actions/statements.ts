"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { statements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteStatement } from "@/lib/services/statements";

export interface StatementActionState {
  ok: boolean;
  message?: string;
}

/**
 * حذف كشف من الأرشيف — بيحذف عملياته المستوردة معاه ويرجّع الأرصدة.
 * العمليات اللي اتعدّلت يدويًا بعد الاستيراد بتتحذف كمان (لأنها مرتبطة بالكشف)،
 * فالواجهة بتأكّد قبل التنفيذ.
 */
export async function deleteStatementAction(
  _prev: StatementActionState,
  formData: FormData,
): Promise<StatementActionState> {
  void _prev; // الشكل المطلوب من useActionState
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "مفيش كشف محدّد" };

  const result = await deleteStatement(id);

  revalidatePath("/statements");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/");

  return {
    ok: true,
    message: `اتحذف الكشف و${result.deleted} عملية مرتبطة بيه${result.deleted ? "، والأرصدة اتحسبت من جديد" : ""}`,
  };
}

/** إعادة تسمية كشف في الأرشيف (أو إضافة ملاحظة) */
export async function renameStatementAction(
  _prev: StatementActionState,
  formData: FormData,
): Promise<StatementActionState> {
  void _prev;
  const id = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) return { ok: false, message: "مفيش كشف محدّد" };
  if (!label && !notes) return { ok: false, message: "اكتب اسمًا أو ملاحظة" };

  await db
    .update(statements)
    .set({
      ...(label ? { label: label.slice(0, 140) } : {}),
      ...(notes !== null ? { notes } : {}),
    })
    .where(eq(statements.id, id));

  revalidatePath("/statements");
  return { ok: true, message: "تم تحديث بيانات الكشف" };
}
