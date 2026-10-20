"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createGoalAction, type GoalFormState } from "@/server/actions/goals";

const EMOJIS = ["🎯", "🏠", "🚗", "✈️", "💍", "🎓", "📱", "🕌", "🏥", "🛟"];

/** نموذج إضافة هدف ادخار مع عرض أخطاء التحقق */
export function GoalForm() {
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(createGoalAction, { ok: false });
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1">
        <span className="field-label">اسم الهدف</span>
        <input name="name" required minLength={2} placeholder="مقدم شقة / عربية / عمرة" className="field" />
        {state.errors?.name ? <span className="text-[11px] text-rose-300">{state.errors.name}</span> : null}
      </label>
      <label className="space-y-1">
        <span className="field-label">المبلغ المستهدف</span>
        <input name="targetAmount" required type="number" min={1} step="0.01" placeholder="200000" className="field" />
        {state.errors?.targetAmount ? <span className="text-[11px] text-rose-300">{state.errors.targetAmount}</span> : null}
      </label>
      <label className="space-y-1">
        <span className="field-label">المدخر حاليًا</span>
        <input name="savedAmount" type="number" min={0} step="0.01" defaultValue="0" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">تاريخ مستهدف (اختياري)</span>
        <input name="dueDate" type="date" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">العملة</span>
        <select name="currency" className="field" defaultValue="EGP">
          <option value="EGP">جنيه مصري</option>
          <option value="USD">دولار</option>
          <option value="EUR">يورو</option>
          <option value="SAR">ريال</option>
          <option value="AED">درهم</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="field-label">أيقونة</span>
        <select name="emoji" className="field" defaultValue="🎯">
          {EMOJIS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 sm:col-span-2 lg:col-span-3">
        <span className="field-label">ملاحظات (اختياري)</span>
        <input name="notes" placeholder="تفاصيل أو خطة التقسيط" className="field" />
      </label>
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "بحفظ…" : "إضافة الهدف"}
        </button>
        {state.message ? (
          <span className={`text-xs ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
