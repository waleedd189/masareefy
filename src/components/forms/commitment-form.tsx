"use client";

import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { createDebtAction, createRecurringAction, type CommitmentFormState } from "@/server/actions/commitments";

interface CardOption {
  id: string;
  name: string;
}
interface CategoryOption {
  id: string;
  name: string;
  emoji: string;
}

/** نموذج إضافة بند متكرر (اشتراك/إيجار/قسط/راتب) */
export function RecurringForm({ cards, categories }: { cards: CardOption[]; categories: CategoryOption[] }) {
  const [state, formAction, pending] = useActionState<CommitmentFormState, FormData>(createRecurringAction, { ok: false });
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1">
        <span className="field-label">اسم البند</span>
        <input name="title" required minLength={2} placeholder="اشتراك نت / إيجار / قسط العربية" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">المبلغ</span>
        <input name="amount" required type="number" min={1} step="0.01" placeholder="450" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">النوع</span>
        <select name="kind" className="field" defaultValue="SUBSCRIPTION">
          <option value="SUBSCRIPTION">اشتراك</option>
          <option value="RENT">إيجار</option>
          <option value="INSTALLMENT">قسط</option>
          <option value="SALARY">راتب/دخل</option>
          <option value="BILL">فاتورة</option>
          <option value="DEBT_PAYMENT">سداد دين</option>
          <option value="OTHER">أخرى</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="field-label">التكرار</span>
        <select name="interval" className="field" defaultValue="MONTHLY">
          <option value="DAILY">يومي</option>
          <option value="WEEKLY">أسبوعي</option>
          <option value="MONTHLY">شهري</option>
          <option value="YEARLY">سنوي</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="field-label">يوم في الشهر (1-28)</span>
        <input name="dayOfMonth" type="number" min={1} max={28} placeholder="5" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">الاتجاه</span>
        <select name="direction" className="field" defaultValue="OUT">
          <option value="OUT">مصروف (خارج)</option>
          <option value="IN">دخل (داخل)</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="field-label">الحساب (اختياري)</span>
        <select name="cardId" className="field" defaultValue="">
          <option value="">بدون حساب</option>
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="field-label">الفئة (اختياري)</span>
        <select name="categoryId" className="field" defaultValue="">
          <option value="">بدون فئة</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.emoji} {cat.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="field-label">ملاحظات</span>
        <input name="notes" className="field" placeholder="رقم العقد / مزوّد الخدمة" />
      </label>
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "بحفظ…" : "إضافة البند"}
        </button>
        {state.message ? (
          <span className={`text-xs ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

/** نموذج إضافة دين (ليّ أو عليّ) */
export function DebtForm({ cards }: { cards: CardOption[] }) {
  const [state, formAction, pending] = useActionState<CommitmentFormState, FormData>(createDebtAction, { ok: false });
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1">
        <span className="field-label">الشخص / الجهة</span>
        <input name="person" required minLength={2} placeholder="أحمد / البنك / جمعية" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">المبلغ</span>
        <input name="amount" required type="number" min={1} step="0.01" placeholder="5000" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">الجهة</span>
        <select name="direction" className="field" defaultValue="OWED_BY_ME">
          <option value="OWED_BY_ME">دين عليّ (هسدد)</option>
          <option value="OWED_TO_ME">دين ليا (هستلم)</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="field-label">المسدد لحد دلوقتي</span>
        <input name="paidAmount" type="number" min={0} step="0.01" defaultValue="0" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">تاريخ الاستحقاق</span>
        <input name="dueDate" type="date" className="field" />
      </label>
      <label className="space-y-1">
        <span className="field-label">الحساب المرتبط</span>
        <select name="cardId" className="field" defaultValue="">
          <option value="">بدون حساب</option>
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 sm:col-span-2 lg:col-span-3">
        <span className="field-label">ملاحظات</span>
        <input name="notes" className="field" placeholder="سبب الدين أو تفاصيل الأقساط" />
      </label>
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "بحفظ…" : "إضافة الدين"}
        </button>
        {state.message ? (
          <span className={`text-xs ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
