"use client";

import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { saveBudgetAction, savePolicyAction, saveFxRatesAction, refreshFxRatesAction, type PolicyFormState } from "@/server/actions/policy";
import type { PolicySettings } from "@/lib/settings-store";
import { TX_TYPES, TX_TYPE_LABELS } from "@/lib/sms/types";

/**
 * لوحة سياسة الرسائل + الميزانية + أسعار الصرف.
 * مقابل `SmsBudgetPolicy` / `SmsServerGate` / `setSettings` في Mezanetak.
 */
export function PolicyPanel({ policy, monthlyBudget, rates }: { policy: PolicySettings; monthlyBudget: number | null; rates: Record<string, number> }) {
  const router = useRouter();
  const [policyState, policyAction, policyPending] = useActionState<PolicyFormState, FormData>(savePolicyAction, { ok: false });
  const [budgetState, budgetAction, budgetPending] = useActionState<PolicyFormState, FormData>(saveBudgetAction, { ok: false });
  const [fxState, fxAction, fxPending] = useActionState<PolicyFormState, FormData>(saveFxRatesAction, { ok: false });
  const [refreshState, refreshAction, refreshPending] = useActionState<PolicyFormState, FormData>(refreshFxRatesAction, { ok: false });

  useEffect(() => {
    if (policyState.ok || budgetState.ok || fxState.ok || refreshState.ok) router.refresh();
  }, [policyState.ok, budgetState.ok, fxState.ok, refreshState.ok, router]);

  return (
    <div className="space-y-6">
      {/* ── سياسة الرسائل ── */}
      <form action={policyAction} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle name="trackingEnabled" defaultChecked={policy.trackingEnabled} label="تتبّع الرسائل مفعّل" hint="لو مقفول: كل الرسائل هتتحفظ للمراجعة من غير تسجيل" />
          <Toggle name="autoPost" defaultChecked={policy.autoPost} label="التسجيل الآلي (AUTO_POST)" hint="سجّل العملية تلقائيًا لما الثقة عالية" />
          <Toggle name="paused" defaultChecked={policy.paused} label="إيقاف مؤقت" hint="كل حاجة تروح للمراجعة (زي وضع الصيانة)" />
          <Toggle name="requireVerified" defaultChecked={policy.requireVerified} label="اشترط قالب موثّق" hint="التسجيل الآلي فقط من قالب بنك مؤكد (VERIFIED)" />
          <Toggle name="reviewForeignCurrency" defaultChecked={policy.reviewForeignCurrency} label="مراجعة العملات الأجنبية" hint="أي عملية بعملة غير الجنيه تحتاج موافقتك" />
          <Toggle name="learnFromApprovals" defaultChecked={policy.learnFromApprovals} label="اتعلّم من موافقاتي" hint="كل ما تؤكد رسالة، اربط المرسل بالحساب تلقائيًا" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="field-label">أقل درجة ثقة للتسجيل الآلي</span>
            <input
              name="minConfidence"
              type="number"
              min={0}
              max={1}
              step={0.05}
              defaultValue={policy.minConfidence}
              className="field"
            />
            <span className="text-[10px] text-ink-500">0.55 مناسب · 0.9 = محافظ جدًا</span>
          </label>
          <label className="space-y-1">
            <span className="field-label">أقصى مبلغ يتسجل تلقائيًا</span>
            <input name="maxAutoAmount" type="number" min={0} step={1} defaultValue={policy.maxAutoAmount ?? ""} placeholder="بدون حد" className="field" />
            <span className="text-[10px] text-ink-500">أكبر من كده → مراجعة</span>
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="field-label">أنواع تحتاج مراجعة دائمًا</legend>
          <div className="flex flex-wrap gap-1.5">
            {TX_TYPES.map((type) => {
              const checked = policy.reviewKinds.includes(type);
              return (
                <label
                  key={type}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    checked ? "border-amber-400/50 bg-amber-500/10 text-amber-200" : "border-ink-700 text-ink-400"
                  }`}
                >
                  <input type="checkbox" name="reviewKinds" value={type} defaultChecked={checked} className="sr-only" />
                  {TX_TYPE_LABELS[type]}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={policyPending} className="btn-primary !px-4 !py-2 !text-xs">
            {policyPending ? "بحفظ…" : "حفظ سياسة الرسائل"}
          </button>
          {policyState.message ? (
            <span className={`text-xs ${policyState.ok ? "text-emerald-300" : "text-rose-300"}`}>{policyState.message}</span>
          ) : null}
        </div>
      </form>

      {/* ── الميزانية الشهرية ── */}
      <form action={budgetAction} className="space-y-2 border-t border-ink-700/50 pt-4">
        <p className="text-sm font-bold">🎚️ الميزانية الشهرية الإجمالية</p>
        <p className="text-[11px] text-ink-500">
          بتظهر في الرئيسية والتقارير، وبتحسب المتبقي ووتيرتك اليومية والمتوقع آخر الشهر. (ميزانيات الفئات بتتحط في قسم الفئات.)
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <input name="monthlyBudget" type="number" min={0} step={50} defaultValue={monthlyBudget ?? ""} placeholder="مثال: 15000" className="field !w-40" />
          <button type="submit" disabled={budgetPending} className="btn-primary !px-3 !py-2 !text-xs">
            {budgetPending ? "بحفظ…" : "حفظ الميزانية"}
          </button>
          {budgetState.message ? (
            <span className={`text-xs ${budgetState.ok ? "text-emerald-300" : "text-rose-300"}`}>{budgetState.message}</span>
          ) : null}
        </div>
      </form>

      {/* ── أسعار الصرف ── */}
      <form action={fxAction} className="space-y-2 border-t border-ink-700/50 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">💱 أسعار الصرف (كم جنيه لكل وحدة)</p>
            <p className="text-[11px] text-ink-500">بتُستخدم لعرض العمليات الأجنبية بالجنيه في التقارير.</p>
          </div>
          <button formAction={refreshAction} type="submit" disabled={refreshPending} className="btn-ghost !px-3 !py-1.5 !text-xs">
            {refreshPending ? "بحدّث…" : "🔄 تحديث من الإنترنت"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {["USD", "EUR", "GBP", "SAR", "AED", "KWD", "QAR", "TRY"].map((code) => (
            <label key={code} className="space-y-1">
              <span className="field-label">{code}</span>
              <input name={`rate_${code}`} type="number" min={0} step="0.0001" defaultValue={rates[code] ?? ""} placeholder="—" className="field" dir="ltr" />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={fxPending} className="btn-primary !px-3 !py-2 !text-xs">
            {fxPending ? "بحفظ…" : "حفظ الأسعار"}
          </button>
          {fxState.message ? (
            <span className={`text-xs ${fxState.ok ? "text-emerald-300" : "text-rose-300"}`}>{fxState.message}</span>
          ) : null}
          {refreshState.message ? (
            <span className={`text-xs ${refreshState.ok ? "text-emerald-300" : "text-rose-300"}`}>{refreshState.message}</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-ink-700/60 bg-ink-950/40 p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-emerald-500" />
      <span className="min-w-0">
        <span className="block text-xs font-bold text-ink-100">{label}</span>
        {hint ? <span className="block text-[10px] leading-relaxed text-ink-500">{hint}</span> : null}
      </span>
    </label>
  );
}

export function PolicyBadges({ policy }: { policy: PolicySettings }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge className={policy.trackingEnabled ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-ink-700 text-ink-400"}>
        {policy.trackingEnabled ? "تتبّع مفعّل" : "تتبّع مقفول"}
      </Badge>
      <Badge className={policy.autoPost && !policy.paused ? "border-brand-500/30 bg-brand-500/10 text-brand-200" : "border-ink-700 text-ink-400"}>
        {policy.autoPost && !policy.paused ? "تسجيل آلي" : "مراجعة فقط"}
      </Badge>
      {policy.paused ? <Badge className="border-amber-400/40 bg-amber-500/10 text-amber-200">إيقاف مؤقت</Badge> : null}
      {policy.requireVerified ? <Badge className="border-ink-700 text-ink-300">قوالب موثّقة فقط</Badge> : null}
      <Badge className="border-ink-700 text-ink-400">ثقة ≥ {policy.minConfidence}</Badge>
    </div>
  );
}
