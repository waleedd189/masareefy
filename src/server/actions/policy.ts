"use server";

import { revalidatePath } from "next/cache";
import { setMonthlyBudgetTotal, savePolicy, type PolicySettings } from "@/lib/settings-store";
import { saveFxRates, refreshRatesFromApi, type FxRates } from "@/lib/fx";
import type { TxType } from "@/lib/sms/types";

/**
 * إعدادات محرّك السياسة + الميزانية الإجمالية + أسعار الصرف.
 * (مقابل `setServerGate` / `setSettings` في قناة `cashflow/sms_tracking` بتاعة Mezanetak)
 */

export interface PolicyFormState {
  ok: boolean;
  message?: string;
}

const ALL_KINDS: TxType[] = [
  "PURCHASE",
  "REFUND",
  "PAYMENT",
  "WITHDRAWAL",
  "DEPOSIT",
  "FEE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "UNKNOWN",
];

function readBool(formData: FormData, key: string): boolean {
  return String(formData.get(key) ?? "") === "on" || String(formData.get(key) ?? "") === "true";
}

export async function savePolicyAction(_prev: PolicyFormState, formData: FormData): Promise<PolicyFormState> {
  const kinds = formData.getAll("reviewKinds").map((v) => String(v)) as TxType[];
  const patch: Partial<PolicySettings> = {
    trackingEnabled: readBool(formData, "trackingEnabled"),
    autoPost: readBool(formData, "autoPost"),
    paused: readBool(formData, "paused"),
    requireVerified: readBool(formData, "requireVerified"),
    reviewForeignCurrency: readBool(formData, "reviewForeignCurrency"),
    learnFromApprovals: readBool(formData, "learnFromApprovals"),
    minConfidence: Number(String(formData.get("minConfidence") ?? "0.55")) || 0.55,
    maxAutoAmount: Number(String(formData.get("maxAutoAmount") ?? "").replace(/,/g, "")) || null,
    reviewKinds: kinds.filter((k) => ALL_KINDS.includes(k)),
  };
  await savePolicy(patch);
  revalidatePath("/settings");
  revalidatePath("/messages");
  revalidatePath("/");
  return { ok: true, message: "تم حفظ سياسة الرسائل ✅" };
}

export async function saveBudgetAction(_prev: PolicyFormState, formData: FormData): Promise<PolicyFormState> {
  const value = Number(String(formData.get("monthlyBudget") ?? "").replace(/,/g, ""));
  await setMonthlyBudgetTotal(Number.isFinite(value) && value > 0 ? value : null);
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/reports");
  return { ok: true, message: value > 0 ? "تم حفظ الميزانية الشهرية ✅" : "تم إلغاء الميزانية الإجمالية" };
}

export async function saveFxRatesAction(_prev: PolicyFormState, formData: FormData): Promise<PolicyFormState> {
  const rates: FxRates = {};
  for (const code of ["USD", "EUR", "GBP", "SAR", "AED", "KWD", "QAR", "TRY"]) {
    const raw = String(formData.get(`rate_${code}`) ?? "").replace(/,/g, "").trim();
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) rates[code] = Math.round(value * 10000) / 10000;
  }
  await saveFxRates(rates);
  revalidatePath("/settings");
  revalidatePath("/reports");
  return { ok: true, message: `تم حفظ ${Object.keys(rates).length} سعر صرف ✅` };
}

export async function refreshFxRatesAction(_prev: PolicyFormState): Promise<PolicyFormState> {
  void _prev; // الشكل المطلوب من useActionState
  const result = await refreshRatesFromApi();
  revalidatePath("/settings");
  revalidatePath("/reports");
  return result.ok
    ? { ok: true, message: `تم تحديث ${result.updated} سعر من المصدر ✅` }
    : { ok: false, message: `تعذّر التحديث (${result.error}) — عدّل الأسعار يدويًا` };
}
