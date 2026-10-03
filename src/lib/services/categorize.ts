import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { foldArabic } from "@/lib/sms/normalize";
import type { TxType } from "@/lib/sms/types";

const TYPE_FALLBACK: Partial<Record<TxType, string>> = {
  WITHDRAWAL: "سحب نقدي",
  FEE: "رسوم بنكية",
  TRANSFER_OUT: "تحويلات",
  TRANSFER_IN: "تحويلات",
  PAYMENT: "سداد بطاقة",
  DEPOSIT: "دخل",
};

/** اقتراح فئة تلقائياً من اسم التاجر أو نص الرسالة */
export async function suggestCategoryId(input: {
  merchant?: string | null;
  text?: string | null;
  type?: TxType | string | null;
}): Promise<string | null> {
  const rows = await db.select().from(categories);
  if (!rows.length) return null;

  const haystack = foldArabic(`${input.merchant ?? ""} ${input.text ?? ""}`);
  let best: { id: string; score: number } | null = null;

  for (const category of rows) {
    const keywords = category.keywords
      .split(",")
      .map((k) => foldArabic(k))
      .filter(Boolean);
    for (const keyword of keywords) {
      if (keyword.length >= 2 && haystack.includes(keyword)) {
        const score = keyword.length;
        if (!best || score > best.score) best = { id: category.id, score };
      }
    }
  }
  if (best) return best.id;

  const fallbackName = input.type ? TYPE_FALLBACK[input.type as TxType] : undefined;
  if (fallbackName) return rows.find((c) => c.name === fallbackName)?.id ?? null;
  return null;
}
