"use client";

import { useEffect, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { transferAction, type TransferFormState } from "@/server/actions/transfers";

export interface TransferCardOption {
  id: string;
  name: string;
  last4: string;
  currency: string;
  type: string;
  balance: number;
}

/**
 * نموذج التحويل بين الحسابات — مع تبديل سريع بين المصدر والوجهة
 * وعرض الرصيد المتاح لكل طرف قبل ما تحوّل.
 */
export function TransferForm({ cards }: { cards: TransferCardOption[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<TransferFormState, FormData>(transferAction, { ok: false });
  const [fromId, setFromId] = useState(cards[0]?.id ?? "");
  const [toId, setToId] = useState(cards[1]?.id ?? "");

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const from = cards.find((c) => c.id === fromId);
  const to = cards.find((c) => c.id === toId);
  const differentCurrency = Boolean(from && to && from.currency !== to.currency);

  function swap() {
    setFromId(toId);
    setToId(fromId);
  }

  if (cards.length < 2) {
    return (
      <p className="py-4 text-center text-xs text-ink-400">
        التحويل محتاج حسابين على الأقل — أضف حساب تاني من فوق الأول.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <label className="space-y-1">
          <span className="field-label">من حساب</span>
          <select name="fromCardId" value={fromId} onChange={(e) => setFromId(e.target.value)} className="field">
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} ••{card.last4} ({card.currency})
              </option>
            ))}
          </select>
          {from ? (
            <span className="text-[10px] text-ink-500">
              {from.type === "CREDIT" ? "المستحق" : "الرصيد"}: <b data-money>{formatMoney(from.balance, from.currency)}</b>
            </span>
          ) : null}
          {state.errors?.fromCardId ? <span className="block text-[11px] text-rose-300">{state.errors.fromCardId}</span> : null}
        </label>

        <button
          type="button"
          onClick={swap}
          className="btn-ghost !px-3 !py-2 !text-sm"
          title="بدّل المصدر والوجهة"
          aria-label="بدّل المصدر والوجهة"
        >
          ⇄
        </button>

        <label className="space-y-1">
          <span className="field-label">إلى حساب</span>
          <select name="toCardId" value={toId} onChange={(e) => setToId(e.target.value)} className="field">
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} ••{card.last4} ({card.currency})
              </option>
            ))}
          </select>
          {to ? (
            <span className="text-[10px] text-ink-500">
              {to.type === "CREDIT" ? "المستحق" : "الرصيد"}: <b data-money>{formatMoney(to.balance, to.currency)}</b>
            </span>
          ) : null}
          {state.errors?.toCardId ? <span className="block text-[11px] text-rose-300">{state.errors.toCardId}</span> : null}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="field-label">المبلغ</span>
          <input name="amount" type="number" min={1} step="0.01" required placeholder="500" className="field" inputMode="decimal" />
          {state.errors?.amount ? <span className="block text-[11px] text-rose-300">{state.errors.amount}</span> : null}
        </label>
        <label className="space-y-1">
          <span className="field-label">التاريخ (اختياري)</span>
          <input name="occurredAt" type="datetime-local" className="field" />
        </label>
        <label className="space-y-1">
          <span className="field-label">البيان (اختياري)</span>
          <input name="note" placeholder="سداد فيزا من الحساب الجاري" className="field" />
        </label>
      </div>

      {differentCurrency ? (
        <p className="text-[11px] text-amber-300">
          💱 الحسابين بعملتين مختلفتين ({from?.currency} → {to?.currency}) — التحويل هيتم حسب أسعار الصرف المحفوظة في الإعدادات.
        </p>
      ) : null}
      {from?.type === "CREDIT" ? (
        <p className="text-[11px] text-amber-300">💳 التحويل من بطاقة ائتمان بيتسجل كسلفة نقدية (بيزود المستحق عليك).</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary !px-4 !py-2 !text-xs">
          {pending ? "بحوّل…" : "⇄ تنفيذ التحويل"}
        </button>
        {state.message ? (
          <span className={`text-xs ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
