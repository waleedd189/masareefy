"use client";

import { useActionState } from "react";
import type { Card, Category } from "@/db/schema";
import { maskedCard } from "@/lib/format";
import { TX_TYPES, TX_TYPE_LABELS } from "@/lib/sms/types";
import { createTransactionAction, type ActionState } from "@/server/actions/transactions";

const initial: ActionState = { ok: false };

function localDateTimeValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TransactionForm({
  cards,
  categories,
  defaultCardId,
}: {
  cards: Card[];
  categories: Category[];
  defaultCardId?: string;
}) {
  const [state, formAction, pending] = useActionState(createTransactionAction, initial);

  return (
    <form action={formAction} className="surface space-y-4 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="cardId">
            البطاقة
          </label>
          <select id="cardId" name="cardId" defaultValue={defaultCardId ?? cards[0]?.id} className="field" required>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} — {maskedCard(card.last4)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="amount">
            المبلغ
          </label>
          <input id="amount" name="amount" inputMode="decimal" placeholder="250.00" className="field" required />
          {state.errors?.amount ? <p className="mt-1 text-[11px] text-rose-400">{state.errors.amount}</p> : null}
        </div>

        <div>
          <label className="field-label" htmlFor="type">
            نوع العملية
          </label>
          <select id="type" name="type" defaultValue="PURCHASE" className="field">
            {TX_TYPES.filter((t) => t !== "UNKNOWN").map((type) => (
              <option key={type} value={type}>
                {TX_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="merchant">
            التاجر / البيان
          </label>
          <input id="merchant" name="merchant" placeholder="كارفور المعادي" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="categoryId">
            الفئة
          </label>
          <select id="categoryId" name="categoryId" defaultValue="" className="field">
            <option value="">تلقائي حسب التاجر</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.emoji} {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="occurredAt">
            التاريخ والوقت
          </label>
          <input id="occurredAt" name="occurredAt" type="datetime-local" defaultValue={localDateTimeValue()} className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="availableAfter">
            الرصيد المتاح بعد العملية (اختياري)
          </label>
          <input id="availableAfter" name="availableAfter" inputMode="decimal" placeholder="18,400" className="field" />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="note">
            ملاحظة
          </label>
          <input id="note" name="note" placeholder="ملاحظة اختيارية" className="field" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending || !cards.length}>
          {pending ? "جارٍ الحفظ…" : "تسجيل العملية"}
        </button>
        {state.message ? (
          <span className={`text-xs font-semibold ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
