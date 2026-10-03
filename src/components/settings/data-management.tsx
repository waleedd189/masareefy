"use client";

import { useActionState } from "react";
import { clearDemoDataAction, type ClearDemoDataState } from "@/server/actions/settings";

const initialState: ClearDemoDataState = {};

export function DataManagement() {
  const [state, formAction, pending] = useActionState(clearDemoDataAction, initialState);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-ink-700/60 bg-ink-950/40 p-4">
        <h3 className="text-sm font-bold text-ink-50">نسخة احتياطية كاملة</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          حمّل ملف JSON فيه البطاقات والعمليات والرسائل والفئات والإعدادات وقواعد التحليل ومفاتيح الربط.
        </p>
        <a href="/api/export?format=backup" download className="btn-ghost mt-4 inline-flex">
          ↓ تحميل نسخة احتياطية
        </a>
        <p className="mt-2 text-[11px] text-amber-300/80">احتفظ بالملف في مكان آمن لأنه يحتوي على مفاتيح الربط.</p>
      </div>

      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
        <h3 className="text-sm font-bold text-rose-200">مسح البيانات التجريبية</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          يمسح كل البطاقات والعمليات والرسائل لتبدأ ببياناتك الحقيقية. لن يمسح الفئات أو الإعدادات أو مفاتيح الربط أو قواعد التحليل.
        </p>
        <form
          action={formAction}
          className="mt-4"
          onSubmit={(event) => {
            if (!window.confirm("متأكد إنك عايز تمسح كل البطاقات والعمليات والرسائل؟ لا يمكن التراجع عن الخطوة دي.")) {
              event.preventDefault();
            }
          }}
        >
          <button type="submit" disabled={pending} className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? "جاري المسح…" : "مسح البيانات التجريبية"}
          </button>
        </form>
        {state.message ? (
          <p className={`mt-3 text-xs font-semibold ${state.ok ? "text-emerald-300" : "text-rose-300"}`} role="status">
            {state.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
